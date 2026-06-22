import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'

describe('GET /tips/random', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('returns a random tip with text field', async () => {
    const res = await request(app.getHttpServer())
      .get('/tips/random')
      .expect(200)
    expect(res.body.text).toBeDefined()
    expect(typeof res.body.text).toBe('string')
  })
})
