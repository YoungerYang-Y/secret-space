import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'

describe('Province API', () => {
  let app: INestApplication
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
  const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('GET /provinces 返回 34 个省份', async () => {
    const res = await request(app.getHttpServer()).get('/provinces')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(34)
    expect(res.body[0]).toHaveProperty('code')
    expect(res.body[0]).toHaveProperty('visited')
    expect(res.body[0]).toHaveProperty('photoCount')
  })

  it('GET /provinces/:code/photos 返回照片列表', async () => {
    const res = await request(app.getHttpServer()).get('/provinces/hunan/photos')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /provinces/invalid/photos 返回 404', async () => {
    const res = await request(app.getHttpServer()).get('/provinces/invalid/photos')
    expect(res.status).toBe(404)
  })

  it('PUT /provinces/:code admin 可修改 visited', async () => {
    const res = await request(app.getHttpServer())
      .put('/provinces/beijing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: true })
    expect(res.status).toBe(200)
    expect(res.body.visited).toBe(true)
    // 恢复
    await request(app.getHttpServer())
      .put('/provinces/beijing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: false })
  })

  it('PUT /provinces/:code 非 admin 返回 403', async () => {
    const res = await request(app.getHttpServer())
      .put('/provinces/beijing')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ visited: true })
    expect(res.status).toBe(403)
  })

  it('PUT /provinces/invalid 返回 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/provinces/invalid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: true })
    expect(res.status).toBe(404)
  })
})
