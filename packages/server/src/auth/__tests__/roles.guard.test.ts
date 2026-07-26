import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.service'
import { createTestApp } from '../../__tests__/test-utils'
import { RateLimitGuard } from '../rate-limit.guard'

/**
 * RolesGuard 测试
 * 测试 SessionGuard + RolesGuard 组合的认证授权行为
 * 使用 /api/photos/presign 作为 admin-only 端点进行测试
 */
describe('RolesGuard', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })

  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  describe('Bearer Token 认证（Client 使用）', () => {
    it('admin role 放行', async () => {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app.getHttpServer())
        .post('/api/photos/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({ provinceCode: 'hunan', filename: 'test.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(200)
    })

    it('owner role 拒绝管理 API', async () => {
      const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })
      const res = await request(app.getHttpServer())
        .post('/api/photos/presign')
        .set('Authorization', `Bearer ${token}`)
        .send({ provinceCode: 'hunan', filename: 'test.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(403)
    })
  })

  describe('Cookie 认证（Admin 使用）', () => {
    it('admin Cookie 放行', async () => {
      // 先登录获取 Cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ password: 'admin888' })
      const cookie = loginRes.headers['set-cookie'][0]

      const res = await request(app.getHttpServer())
        .post('/api/photos/presign')
        .set('Cookie', cookie)
        .send({ provinceCode: 'hunan', filename: 'test.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(200)
    })
  })

  it('未认证请求返回 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos/presign')
      .send({ provinceCode: 'hunan', filename: 'test.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(401)
  })
})
