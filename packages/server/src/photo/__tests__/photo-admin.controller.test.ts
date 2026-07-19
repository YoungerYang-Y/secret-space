import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { createTestApp } from '../../__tests__/test-utils'
import type { MediaStorage } from '../../media/media-storage'

describe('Photo Admin API', () => {
  let app: INestApplication
  let mockStorage: MediaStorage
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
  const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
    mockStorage = result.mockStorage
  })

  afterAll(() => app.close())

  // --- AC1: presign and photo writes only allow admin ---

  it('POST /photos/presign 返回 uploadUrl、key 和 mediaRef', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.webp', contentType: 'image/webp' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('uploadUrl')
    expect(res.body).toHaveProperty('key')
    expect(res.body).toHaveProperty('mediaRef')
    expect(res.body.key).toMatch(/^photos\/hunan\//)
    expect(res.body.mediaRef).toMatch(/^media:\/\/photos\/hunan\//)
  })

  it('POST /photos/presign 拒绝非 image 类型', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
  })

  it('POST /photos/presign visitor 得到 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos/presign')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.webp', contentType: 'image/webp' })
    expect(res.status).toBe(403)
  })

  // --- AC1: POST /media/confirm admin only ---

  it('POST /media/confirm admin 确认上传返回 mediaRef + readUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'photos/hunan/test-uuid.webp' })
    expect(res.status).toBe(200)
    expect(res.body.mediaRef).toBe('media://photos/hunan/test-uuid.webp')
    expect(res.body.readUrl).toMatch(/^https:\/\/signed\.example\.com\//)
    expect(res.body.readExpiresIn).toBe(300)
  })

  it('POST /media/confirm visitor 得到 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ key: 'photos/hunan/test-uuid.webp' })
    expect(res.status).toBe(403)
  })

  it('POST /media/confirm 匿名得到 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .send({ key: 'photos/hunan/test-uuid.webp' })
    expect(res.status).toBe(401)
  })

  it('POST /media/confirm 非法对象返回 422', async () => {
    vi.mocked(mockStorage.confirmUpload).mockRejectedValueOnce(
      Object.assign(new Error('Object not found'), { name: 'ConfirmUploadError' }),
    )
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'photos/hunan/nonexistent.webp' })
    expect(res.status).toBe(422)
  })

  // --- AC1: photo writes use mediaRef ---

  it('POST /photos 使用 mediaRef 创建照片记录', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', mediaRef: 'media://photos/hunan/test.webp', order: 1 })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.url).toBe('media://photos/hunan/test.webp')
  })

  it('POST /photos 非法 mediaRef 返回 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', mediaRef: 'https://r2.example.com/photos/hunan/test.webp', order: 1 })
    expect(res.status).toBe(400)
  })

  it('POST /photos visitor 得到 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ provinceCode: 'hunan', mediaRef: 'media://photos/hunan/test.webp', order: 1 })
    expect(res.status).toBe(403)
  })

  it('PUT /photos/:id 更新标注', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', mediaRef: 'media://photos/hunan/ann.webp', order: 2 })
    const res = await request(app.getHttpServer())
      .put(`/api/photos/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annotation: '长沙橘子洲' })
    expect(res.status).toBe(200)
    expect(res.body.annotation).toBe('长沙橘子洲')
  })

  it('DELETE /photos/:id 非 admin 返回 403', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/photos/1')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(403)
  })

  it('DELETE /photos/999 返回 404', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/photos/999')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
