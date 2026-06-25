import { Test } from '@nestjs/testing'
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'
import { RolesGuard } from '../roles.guard'
import { Roles } from '../roles.decorator'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth.service'

@Controller('test-guard')
@UseGuards(RolesGuard)
class TestController {
  @Get('admin-only')
  @Roles('admin')
  adminOnly() {
    return { ok: true }
  }
}

describe('RolesGuard', () => {
  let app: INestApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestController],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('admin role 放行', async () => {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
    const res = await request(app.getHttpServer())
      .get('/test-guard/admin-only')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('owner role 拒绝管理 API', async () => {
    const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })
    const res = await request(app.getHttpServer())
      .get('/test-guard/admin-only')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('未认证请求返回 401', async () => {
    const res = await request(app.getHttpServer()).get('/test-guard/admin-only')
    expect(res.status).toBe(401)
  })
})
