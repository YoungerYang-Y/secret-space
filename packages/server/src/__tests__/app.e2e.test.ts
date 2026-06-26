import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp } from './test-utils'

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
})
