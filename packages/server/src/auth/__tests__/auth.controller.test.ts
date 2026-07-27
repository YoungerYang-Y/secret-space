import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { RateLimitGuard } from '../rate-limit.guard'
import { createTestApp } from '../../__tests__/test-utils'

describe('POST /auth/verify', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })
  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  it('returns role + Set-Cookie for correct owner password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'guoguo123' })
      .expect(200)
    expect(res.body.token).toBeUndefined() // 不再返回 token
    expect(res.body.role).toBe('owner')
    expect(res.headers['set-cookie']).toBeDefined()
    const cookie = res.headers['set-cookie'][0]
    expect(cookie).toMatch(/session=.{64}/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/api')
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'wrong' })
      .expect(401)
    expect(res.body.message).toBe('密码不对哦')
  })

  it('returns 429 after 10 failed attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ password: 'wrong' })
    }
    const res = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'wrong' })
      .expect(429)
    expect(res.body.message).toBe('休息一下再试吧')
    expect(res.body.retryAfter).toBeGreaterThan(0)
  })
})

describe('POST /auth/logout', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })
  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  it('clears cookie and returns success', async () => {
    // 先登录获取 Cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'admin888' })
    
    expect(loginRes.status).toBe(200)
    
    const cookie = loginRes.headers['set-cookie'][0]

    // 登出
    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(200)
    expect(logoutRes.body.success).toBe(true)

    // 确认 Cookie 被清除后请求返回 401
    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
    expect(meRes.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })
  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  it('returns role for valid Cookie', async () => {
    // 先登录获取 Cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'admin888' })
    const cookie = loginRes.headers['set-cookie'][0]

    // 获取当前用户角色
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200)
    expect(res.body.role).toBe('admin')
  })

  it('returns 401 for no Cookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('Session management', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })
  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  it('并发登录创建多个独立 Session', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'admin888' })
    const res2 = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'admin888' })

    const cookie1 = res1.headers['set-cookie'][0].match(/session=([^;]+)/)?.[1]
    const cookie2 = res2.headers['set-cookie'][0].match(/session=([^;]+)/)?.[1]

    expect(cookie1).toBeDefined()
    expect(cookie2).toBeDefined()
    expect(cookie1).not.toBe(cookie2)

    // 两个 Session 都应该有效
    const me1 = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `session=${cookie1}`)
    const me2 = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `session=${cookie2}`)

    expect(me1.status).toBe(200)
    expect(me2.status).toBe(200)
  })

  it('admin 第 6 次登录后最旧 Session 被删除', async () => {
    const sessions: string[] = []

    // 创建 6 个 Session
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ password: 'admin888' })
      const sessionId = res.headers['set-cookie'][0].match(/session=([^;]+)/)?.[1]
      if (sessionId) sessions.push(sessionId)
    }

    expect(sessions).toHaveLength(6)

    // 第一个 Session 应该已被删除（超过 5 个限制）
    const res1 = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `session=${sessions[0]}`)
    expect(res1.status).toBe(401)

    // 最后一个 Session 应该有效
    const res6 = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `session=${sessions[5]}`)
    expect(res6.status).toBe(200)
  })
})
