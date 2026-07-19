import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, adminToken, visitorToken } from './test-utils'

describe('App (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
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
})
