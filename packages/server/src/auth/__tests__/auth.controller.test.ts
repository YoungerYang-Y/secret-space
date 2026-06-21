import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'

describe('POST /auth/verify', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })
  afterAll(() => app.close())

  it('returns JWT with role=owner for correct owner password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify').send({ password: 'guoguo123' }).expect(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.role).toBe('owner')
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify').send({ password: 'wrong' }).expect(401)
    expect(res.body.message).toBe('密码不对哦')
  })

  it('returns 429 after 10 failed attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post('/auth/verify').send({ password: 'wrong' })
    }
    const res = await request(app.getHttpServer())
      .post('/auth/verify').send({ password: 'wrong' }).expect(429)
    expect(res.body.message).toBe('休息一下再试吧')
    expect(res.body.retryAfter).toBeGreaterThan(0)
  })
})
