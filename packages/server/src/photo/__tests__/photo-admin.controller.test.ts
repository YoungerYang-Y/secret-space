import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'

describe('Photo Admin API', () => {
  let app: INestApplication
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
  const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('POST /photos/presign 返回 uploadUrl 和 key', async () => {
    const res = await request(app.getHttpServer())
      .post('/photos/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.webp', contentType: 'image/webp' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('uploadUrl')
    expect(res.body).toHaveProperty('key')
    expect(res.body).toHaveProperty('publicUrl')
    expect(res.body.key).toMatch(/^photos\/hunan\//)
  })

  it('POST /photos/presign 拒绝非 image 类型', async () => {
    const res = await request(app.getHttpServer())
      .post('/photos/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
  })

  it('POST /photos 创建照片记录', async () => {
    const res = await request(app.getHttpServer())
      .post('/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', url: 'https://r2.example.com/photos/hunan/test.webp', order: 1 })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.url).toBe('https://r2.example.com/photos/hunan/test.webp')
  })

  it('PUT /photos/:id 更新标注', async () => {
    // 先创建
    const created = await request(app.getHttpServer())
      .post('/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', url: 'https://r2.example.com/photos/hunan/ann.webp', order: 2 })
    const res = await request(app.getHttpServer())
      .put(`/photos/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annotation: '长沙橘子洲' })
    expect(res.status).toBe(200)
    expect(res.body.annotation).toBe('长沙橘子洲')
  })

  it('DELETE /photos/:id 非 admin 返回 403', async () => {
    const res = await request(app.getHttpServer())
      .delete('/photos/1')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(403)
  })

  it('DELETE /photos/999 返回 404', async () => {
    const res = await request(app.getHttpServer())
      .delete('/photos/999')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
