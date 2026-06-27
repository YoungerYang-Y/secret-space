import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, visitorToken } from '../../__tests__/test-utils'

describe('GET /tips/random', () => {
  let app: INestApplication

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
  })

  afterAll(() => app.close())

  it('returns a random tip with text field', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tips/random')
      .set('Authorization', `Bearer ${visitorToken}`)
      .expect(200)
    expect(res.body.text).toBeDefined()
    expect(typeof res.body.text).toBe('string')
  })
})
