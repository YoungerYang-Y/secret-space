import { INestApplication } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { createTestApp } from '../../__tests__/test-utils'
import type { MediaStorage } from '../media-storage'
import {
  MediaDeletionService,
  backoffMs,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
} from '../media-deletion.service'

describe('MediaDeletionService', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: MediaDeletionService
  let mockStorage: MediaStorage

  beforeAll(async () => {
    const { app: testApp, module, mockStorage: ms } = await createTestApp()
    app = testApp
    prisma = module.get(PrismaService)
    service = module.get(MediaDeletionService)
    mockStorage = ms
  })

  afterAll(() => app.close())

  beforeEach(async () => {
    await prisma.mediaDeletionTask.deleteMany()
    vi.clearAllMocks()
  })

  describe('backoffMs', () => {
    it('按 60s 起步指数退避并封顶', () => {
      expect(backoffMs(1)).toBe(RETRY_BASE_MS)
      expect(backoffMs(2)).toBe(RETRY_BASE_MS * 2)
      expect(backoffMs(3)).toBe(RETRY_BASE_MS * 4)
      expect(backoffMs(10)).toBe(RETRY_MAX_MS)
      expect(backoffMs(100)).toBe(RETRY_MAX_MS)
    })
  })

  describe('enqueueMany', () => {
    it('批内去重、非法 key 跳过、初始字段正确', async () => {
      const before = Date.now()
      const count = await prisma.$transaction(async (tx) => {
        return service.enqueueMany(
          [
            'photos/a.webp',
            'photos/a.webp', // 重复
            'photos/b.webp',
            '', // 空
            'tmp/photos/x.webp', // 非 photos/ 前缀
            'photos/../secret.webp', // 路径穿越
          ],
          tx,
        )
      })
      expect(count).toBe(2)

      const tasks = await prisma.mediaDeletionTask.findMany({ orderBy: { key: 'asc' } })
      expect(tasks).toHaveLength(2)
      expect(tasks.map((t) => t.key)).toEqual(['photos/a.webp', 'photos/b.webp'])
      for (const t of tasks) {
        expect(t.status).toBe('pending')
        expect(t.attempts).toBe(0)
        expect(t.lastError).toBeNull()
        expect(Math.abs(t.nextAttemptAt.getTime() - before)).toBeLessThan(5000)
        expect(t.doneAt).toBeNull()
      }
    })

    it('全部非法时返回 0 且不写入', async () => {
      const count = await prisma.$transaction(async (tx) =>
        service.enqueueMany(['tmp/x.webp', '../y.webp', ''], tx),
      )
      expect(count).toBe(0)
      expect(await prisma.mediaDeletionTask.count()).toBe(0)
    })
  })

  describe('runDueDeletions', () => {
    it('存储正常时任务转为 done 且记录 doneAt', async () => {
      await prisma.$transaction((tx) => service.enqueueMany(['photos/ok.webp'], tx))
      const summary = await service.runDueDeletions()
      expect(summary).toEqual({ processed: 1, succeeded: 1, failed: 0 })
      expect(mockStorage.delete).toHaveBeenCalledWith('photos/ok.webp')

      const task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.status).toBe('done')
      expect(task?.doneAt).not.toBeNull()
    })

    it('存储失败时任务保持 pending，记录 attempts/lastError 并按退避调度', async () => {
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(new Error('R2 unavailable'))
      const before = Date.now()
      await prisma.$transaction((tx) => service.enqueueMany(['photos/fail.webp'], tx))

      const first = await service.runDueDeletions()
      expect(first).toEqual({ processed: 1, succeeded: 0, failed: 1 })

      let task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.status).toBe('pending')
      expect(task?.attempts).toBe(1)
      expect(task?.lastError).toContain('R2 unavailable')
      // 第一次失败后退避 60s，未到 nextAttemptAt 时不应再被处理
      expect(task!.nextAttemptAt.getTime()).toBeGreaterThan(before + RETRY_BASE_MS - 5000)
      const second = await service.runDueDeletions()
      expect(second).toEqual({ processed: 0, succeeded: 0, failed: 0 })

      // 把调度时间改到过去，模拟到达重试时点；再次失败则 attempts=2、退避 120s
      await prisma.mediaDeletionTask.update({
        where: { id: task!.id },
        data: { nextAttemptAt: new Date(before - 1000) },
      })
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(new Error('R2 still down'))
      const third = await service.runDueDeletions()
      expect(third).toEqual({ processed: 1, succeeded: 0, failed: 1 })
      task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.attempts).toBe(2)
      expect(task!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + RETRY_BASE_MS * 2 - 5000)

      // 存储恢复后重试成功
      await prisma.mediaDeletionTask.update({
        where: { id: task!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      })
      const fourth = await service.runDueDeletions()
      expect(fourth).toEqual({ processed: 1, succeeded: 1, failed: 0 })
      task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.status).toBe('done')
      expect(task?.doneAt).not.toBeNull()
    })

    it('lastError 不包含 URL', async () => {
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(
        new Error('delete failed for https://signed.example.com/photos/secret.webp?token=abc'),
      )
      await prisma.$transaction((tx) => service.enqueueMany(['photos/secret.webp'], tx))
      await service.runDueDeletions()
      const task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.lastError).not.toContain('https://')
      expect(task?.lastError).not.toContain('token=abc')
    })

    it('单条失败不影响其他任务；done 任务不再处理', async () => {
      await prisma.$transaction((tx) =>
        service.enqueueMany(['photos/bad.webp', 'photos/good.webp'], tx),
      )
      vi.mocked(mockStorage.delete).mockImplementation(async (key: string) => {
        if (key === 'photos/bad.webp') throw new Error('boom')
      })
      const summary = await service.runDueDeletions()
      expect(summary).toEqual({ processed: 2, succeeded: 1, failed: 1 })

      // 再次清扫：done 的不重处理，pending 的因退避未到期也不处理
      vi.clearAllMocks()
      const second = await service.runDueDeletions()
      expect(second).toEqual({ processed: 0, succeeded: 0, failed: 0 })
      expect(mockStorage.delete).not.toHaveBeenCalled()
    })
  })
})
