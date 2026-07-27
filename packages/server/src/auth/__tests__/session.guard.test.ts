import { Test } from '@nestjs/testing'
import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { SessionGuard } from '../session.guard'
import { SessionService } from '../session.service'
import { PrismaService } from '../../prisma/prisma.service'
import { JWT_SECRET } from '../auth.service'
import * as jwt from 'jsonwebtoken'

describe('SessionGuard', () => {
  let guard: SessionGuard
  let sessionService: SessionService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [SessionGuard, SessionService, PrismaService],
    }).compile()

    guard = module.get(SessionGuard)
    sessionService = module.get(SessionService)
  })

  const createMockContext = (options: {
    cookies?: Record<string, string>
    authorization?: string
  }): ExecutionContext => {
    const req = {
      cookies: options.cookies || {},
      headers: {
        authorization: options.authorization,
      },
      user: undefined as any,
    }
    const res = {
      clearCookie: vi.fn(),
    }
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext
  }

  describe('Cookie 认证', () => {
    it('有效 Cookie 通过', async () => {
      const sessionId = await sessionService.create('admin')
      const context = createMockContext({ cookies: { session: sessionId } })

      const result = await guard.canActivate(context)
      expect(result).toBe(true)

      const req = context.switchToHttp().getRequest()
      expect(req.user).toEqual({ role: 'admin' })
    })

    it('无效 Cookie 清除并抛出 401', async () => {
      const context = createMockContext({ cookies: { session: 'invalid-session-id' } })

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)

      const res = context.switchToHttp().getResponse()
      expect(res.clearCookie).toHaveBeenCalledWith('session', expect.any(Object))
    })
  })

  describe('Bearer Token 认证（Client 使用）', () => {
    it('有效 Bearer Token 通过', async () => {
      const token = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })
      const context = createMockContext({ authorization: `Bearer ${token}` })

      const result = await guard.canActivate(context)
      expect(result).toBe(true)

      const req = context.switchToHttp().getRequest()
      expect(req.user.role).toBe('visitor')
    })

    it('过期 Bearer Token 抛出 401', async () => {
      const token = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '-1s' })
      const context = createMockContext({ authorization: `Bearer ${token}` })

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('双认证优先级', () => {
    it('Cookie 优先于 Bearer Token', async () => {
      const sessionId = await sessionService.create('admin')
      const token = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })
      const context = createMockContext({
        cookies: { session: sessionId },
        authorization: `Bearer ${token}`,
      })

      const result = await guard.canActivate(context)
      expect(result).toBe(true)

      const req = context.switchToHttp().getRequest()
      expect(req.user.role).toBe('admin') // Cookie 优先
    })

    it('两者都无效返回 401', async () => {
      const context = createMockContext({})

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
    })
  })
})
