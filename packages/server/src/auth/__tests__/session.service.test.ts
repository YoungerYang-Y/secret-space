import { Test } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { SessionService } from '../session.service'

describe('SessionService', () => {
  let service: SessionService
  let prisma: PrismaService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [SessionService, PrismaService],
    }).compile()

    service = module.get(SessionService)
    prisma = module.get(PrismaService)
  })

  beforeEach(async () => {
    // 清理 Session 表
    await prisma.session.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('create', () => {
    it('返回 64 字符 hex，admin 有效期 8h', async () => {
      const id = await service.create('admin')
      expect(id).toHaveLength(64)
      const session = await prisma.session.findUnique({ where: { id } })
      expect(session?.role).toBe('admin')
      // 8 小时 = 8 * 3600 * 1000 = 28800000 ms
      const expectedExpiry = Date.now() + 8 * 3600 * 1000
      expect(session?.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -4) // 精度到秒
    })

    it('visitor/owner 有效期 24h', async () => {
      const id = await service.create('visitor')
      const session = await prisma.session.findUnique({ where: { id } })
      const expectedExpiry = Date.now() + 24 * 3600 * 1000
      expect(session?.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -4)
    })

    it('admin 超过 5 个 Session 时删除最旧的', async () => {
      // 创建 6 个 admin session
      for (let i = 0; i < 6; i++) {
        await service.create('admin')
        // 稍微延迟确保 createdAt 不同
        await new Promise((r) => setTimeout(r, 10))
      }
      const sessions = await prisma.session.findMany({ where: { role: 'admin' } })
      expect(sessions).toHaveLength(5)
    })
  })

  describe('validate', () => {
    it('有效 Session 返回 { role }', async () => {
      const id = await service.create('admin')
      const result = await service.validate(id)
      expect(result).toEqual({ role: 'admin' })
    })

    it('不存在的 Session 返回 null', async () => {
      const result = await service.validate('nonexistent')
      expect(result).toBeNull()
    })

    it('过期 Session 返回 null 并删除记录', async () => {
      // 手动创建一个过期的 session
      const id = 'a'.repeat(64)
      await prisma.session.create({
        data: {
          id,
          role: 'admin',
          expiresAt: new Date(Date.now() - 1000), // 1 秒前过期
        },
      })
      const result = await service.validate(id)
      expect(result).toBeNull()
      // 确认已删除
      const session = await prisma.session.findUnique({ where: { id } })
      expect(session).toBeNull()
    })
  })

  describe('revoke', () => {
    it('删除指定 Session', async () => {
      const id = await service.create('admin')
      await service.revoke(id)
      const session = await prisma.session.findUnique({ where: { id } })
      expect(session).toBeNull()
    })

    it('删除不存在的 Session 不报错', async () => {
      await expect(service.revoke('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('cleanupExpired', () => {
    it('删除所有过期 Session', async () => {
      // 创建一个过期的和一个有效的
      await prisma.session.create({
        data: {
          id: 'expired'.padEnd(64, '0'),
          role: 'admin',
          expiresAt: new Date(Date.now() - 1000),
        },
      })
      const validId = await service.create('admin')

      const deleted = await service.cleanupExpired()
      expect(deleted).toBe(1)

      // 过期的被删除
      const expired = await prisma.session.findUnique({
        where: { id: 'expired'.padEnd(64, '0') },
      })
      expect(expired).toBeNull()

      // 有效的保留
      const valid = await prisma.session.findUnique({ where: { id: validId } })
      expect(valid).not.toBeNull()
    })
  })
})
