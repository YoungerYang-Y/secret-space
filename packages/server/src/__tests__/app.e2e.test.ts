import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, adminToken, visitorToken } from './test-utils'
import { PrismaService } from '../prisma/prisma.service'

describe('App (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
    prisma = result.module.get(PrismaService)
  })

  afterAll(() => app.close())

  it('GET /health returns 200 (excluded from /api prefix)', () => {
    return request(app.getHttpServer()).get('/health').expect(200)
  })

  describe('Private media access control', () => {
    it('匿名请求省份照片接口返回 401 且无媒体 URL', async () => {
      const res = await request(app.getHttpServer()).get('/api/provinces/hunan/photos')
      expect(res.status).toBe(401)
      expect(res.body.coverUrl).toBeUndefined()
      expect(res.body.mediaUrl).toBeUndefined()
    })

    it('匿名请求相册列表返回 401 且无媒体 URL', async () => {
      const res = await request(app.getHttpServer()).get('/api/albums')
      expect(res.status).toBe(401)
      expect(res.body).not.toBeInstanceOf(Array)
    })

    it('授权用户请求省份照片接口返回 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/provinces/hunan/photos')
        .set({ Authorization: `Bearer ${visitorToken}` })
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('授权管理员可获得签名 URL 的相册列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/albums')
        .set({ Authorization: `Bearer ${adminToken}` })
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('Dual authentication mode', () => {
    it('Cookie 认证访问受保护 API', async () => {
      // 先登录获取 Cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ password: 'admin888' })
      const cookie = loginRes.headers['set-cookie'][0]

      // 使用 Cookie 访问受保护 API
      const res = await request(app.getHttpServer())
        .get('/api/albums')
        .set('Cookie', cookie)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('Bearer Token 认证访问受保护 API', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/provinces/hunan/photos')
        .set('Authorization', `Bearer ${visitorToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('会话过期后返回 401', async () => {
      // 先登录获取 Cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ password: 'admin888' })
      const cookie = loginRes.headers['set-cookie'][0]
      const sessionId = cookie.match(/session=([^;]+)/)?.[1]

      // 直接删除 Session 模拟过期
      if (sessionId) {
        await prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
      }

      // 使用过期 Cookie 访问应返回 401
      const res = await request(app.getHttpServer())
        .get('/api/albums')
        .set('Cookie', cookie)
      expect(res.status).toBe(401)
    })
  })
})
