import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { PrismaService } from '../../prisma/prisma.service'
import { createTestApp, adminToken, visitorToken } from '../../__tests__/test-utils'
import type { MediaStorage } from '../media-storage'

const ownerToken = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })

describe('Media Deletion Tasks API', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockStorage: MediaStorage

  beforeAll(async () => {
    const { app: testApp, module, mockStorage: ms } = await createTestApp()
    app = testApp
    prisma = module.get(PrismaService)
    mockStorage = ms
  })

  afterAll(() => app.close())

  beforeEach(async () => {
    await prisma.mediaDeletionTask.deleteMany()
    vi.mocked(mockStorage.delete).mockReset()
    vi.mocked(mockStorage.delete).mockResolvedValue(undefined)
  })

  async function seedTask(data: { key: string; status?: string; attempts?: number; lastError?: string }) {
    return prisma.mediaDeletionTask.create({
      data: {
        key: data.key,
        status: data.status ?? 'pending',
        attempts: data.attempts ?? 0,
        lastError: data.lastError ?? null,
        nextAttemptAt: new Date(),
      },
    })
  }

  describe('GET /media/deletion-tasks', () => {
    it('匿名返回 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/media/deletion-tasks')
      expect(res.status).toBe(401)
    })

    it('visitor 返回 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/media/deletion-tasks')
        .set('Authorization', `Bearer ${visitorToken}`)
      expect(res.status).toBe(403)
    })

    it('owner 返回 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/media/deletion-tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
      expect(res.status).toBe(403)
    })

    it('admin 返回任务列表，字段完整', async () => {
      await seedTask({ key: 'photos/a.webp', status: 'done', attempts: 1 })
      await seedTask({ key: 'photos/b.webp', attempts: 2, lastError: 'Error: R2 down' })

      const res = await request(app.getHttpServer())
        .get('/api/media/deletion-tasks')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
      for (const t of res.body) {
        expect(t).toHaveProperty('key')
        expect(t).toHaveProperty('status')
        expect(t).toHaveProperty('attempts')
        expect(t).toHaveProperty('lastError')
        expect(t).toHaveProperty('nextAttemptAt')
        expect(t).toHaveProperty('doneAt')
      }
    })

    it('status=failing 只返回 pending 且 attempts>0 的任务', async () => {
      await seedTask({ key: 'photos/fresh.webp', attempts: 0 })
      await seedTask({ key: 'photos/retrying.webp', attempts: 3, lastError: 'Error: boom' })
      await seedTask({ key: 'photos/finished.webp', status: 'done', attempts: 2 })

      const res = await request(app.getHttpServer())
        .get('/api/media/deletion-tasks?status=failing')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].key).toBe('photos/retrying.webp')
      expect(res.body[0].attempts).toBe(3)
      expect(res.body[0].lastError).toContain('boom')
    })
  })

  describe('POST /media/deletion-tasks/retry', () => {
    it('匿名返回 401', async () => {
      const res = await request(app.getHttpServer()).post('/api/media/deletion-tasks/retry')
      expect(res.status).toBe(401)
    })

    it('visitor 返回 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/media/deletion-tasks/retry')
        .set('Authorization', `Bearer ${visitorToken}`)
      expect(res.status).toBe(403)
    })

    it('admin 触发清扫并返回汇总', async () => {
      await seedTask({ key: 'photos/retry-ok.webp' })
      vi.mocked(mockStorage.delete).mockResolvedValue(undefined)

      const res = await request(app.getHttpServer())
        .post('/api/media/deletion-tasks/retry')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ processed: 1, succeeded: 1, failed: 0 })
      expect(mockStorage.delete).toHaveBeenCalledWith('photos/retry-ok.webp')

      const task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.status).toBe('done')
    })

    it('存储故障时返回 failed 计数，任务保持 pending', async () => {
      await seedTask({ key: 'photos/retry-fail.webp' })
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(new Error('R2 down'))

      const res = await request(app.getHttpServer())
        .post('/api/media/deletion-tasks/retry')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ processed: 1, succeeded: 0, failed: 1 })

      const task = await prisma.mediaDeletionTask.findFirst()
      expect(task?.status).toBe('pending')
      expect(task?.attempts).toBe(1)
    })
  })
})
