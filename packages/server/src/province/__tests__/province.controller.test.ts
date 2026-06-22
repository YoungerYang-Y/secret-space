import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'

describe('Province API', () => {
  let app: INestApplication

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
})
