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
