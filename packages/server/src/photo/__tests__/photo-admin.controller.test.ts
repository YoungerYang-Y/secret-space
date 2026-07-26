import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { createTestApp } from '../../__tests__/test-utils'
import { PrismaService } from '../../prisma/prisma.service'
import { MediaDeletionService } from '../../media/media-deletion.service'
import { MediaUploadReceiptService } from '../../media/media-upload-receipt.service'
import type { MediaStorage } from '../../media/media-storage'

describe('Photo Admin API', () => {
  let app: INestApplication
  let mockStorage: MediaStorage
  let prisma: PrismaService
  let deletionService: MediaDeletionService
  let receiptService: MediaUploadReceiptService
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
  const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
    mockStorage = result.mockStorage
    prisma = result.module.get(PrismaService)
    deletionService = result.module.get(MediaDeletionService)
    receiptService = result.module.get(MediaUploadReceiptService)
  })

  afterAll(() => app.close())

  async function createPhotoReceipt(key: string, provinceCode = 'hunan') {
    return (
      await prisma.mediaUploadReceipt.upsert({
        where: { key },
        create: {
          key,
          scope: 'photo',
          provinceCode,
          expiresAt: new Date(Date.now() + 60_000),
        },
        update: {
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })
    ).id
  }

  // --- AC1: presign and photo writes only allow admin ---

  it('POST /photos/presign 仅返回 staging uploadUrl 和 key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos/presign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', filename: 'test.webp', contentType: 'image/webp' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('uploadUrl')
    expect(res.body).toHaveProperty('key')
    expect(res.body.key).toMatch(/^tmp\/photos\/hunan\//)
    expect(res.body).not.toHaveProperty('mediaRef')
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

  it('POST /media/confirm admin 确认上传返回 uploadReceipt + readUrl', async () => {
    const key = `tmp/photos/hunan/confirm-${Date.now()}.webp`
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    expect(res.status).toBe(200)
    expect(res.body.uploadReceipt).toEqual(expect.any(String))
    expect(res.body).not.toHaveProperty('mediaRef')
    expect(res.body.readUrl).toMatch(/^https:\/\/signed\.example\.com\//)
    expect(res.body.readExpiresIn).toBe(300)
  })

  it('POST /media/confirm visitor 得到 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ key: 'tmp/photos/hunan/test-uuid.webp' })
    expect(res.status).toBe(403)
  })

  it('POST /media/confirm 匿名得到 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .send({ key: 'tmp/photos/hunan/test-uuid.webp' })
    expect(res.status).toBe(401)
  })

  it('POST /media/confirm 非法对象返回 422', async () => {
    vi.mocked(mockStorage.confirmUpload).mockRejectedValueOnce(
      Object.assign(new Error('Object not found'), { name: 'ConfirmUploadError' }),
    )
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'tmp/photos/hunan/nonexistent.webp' })
    expect(res.status).toBe(422)
  })

  it('POST /media/confirm 将读取签名故障映射为通用 503', async () => {
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('R2 endpoint: https://secret.example.com'))
    const res = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: `tmp/photos/hunan/sign-failure-${Date.now()}.webp` })
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('secret.example.com')
  })

  it('POST /media/confirm 在预览签名故障后可用同一 key 恢复未消费回执', async () => {
    const key = `tmp/photos/hunan/recover-${Date.now()}.webp`
    const finalRef = `media://${key.slice('tmp/'.length)}`
    vi.mocked(mockStorage.confirmUpload)
      .mockResolvedValueOnce({ mediaRef: finalRef, size: 12345 })
      .mockRejectedValueOnce(Object.assign(new Error('Object not found'), { name: 'ConfirmUploadError' }))
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('R2 temporarily unavailable'))

    const first = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    const recovered = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })

    expect(first.status).toBe(503)
    expect(recovered.status).toBe(200)
    expect(recovered.body.uploadReceipt).toEqual(expect.any(String))
  })

  it('POST /media/confirm 在回执持久化故障后可重试确认', async () => {
    const key = `tmp/photos/hunan/receipt-recover-${Date.now()}.webp`
    vi.spyOn(receiptService, 'issue').mockRejectedValueOnce(new Error('database temporarily unavailable'))
    const first = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    const recovered = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    expect(first.status).toBe(503)
    expect(recovered.status).toBe(200)
    expect(recovered.body.uploadReceipt).toEqual(expect.any(String))
  })

  // --- AC1: photo writes consume a confirmed upload receipt ---

  it('POST /photos rejects an unconfirmed upload receipt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt: 'missing-receipt', order: 1 })
    expect(res.status).toBe(422)
  })

  it('POST /photos 使用 uploadReceipt 创建照片记录', async () => {
    const uploadReceipt = await createPhotoReceipt('photos/hunan/test.webp')
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 1 })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.url).toMatch(/^https:\/\/signed\.example\.com\/photos\/hunan\/test\.webp/)
    const persisted = await prisma.photo.findUnique({ where: { id: res.body.id } })
    expect(persisted?.url).toBe('media://photos/hunan/test.webp')
  })

  it('POST /photos 将读取签名故障映射为通用 503', async () => {
    const key = `photos/hunan/write-sign-failure-${Date.now()}.webp`
    const uploadReceipt = await createPhotoReceipt(key)
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('R2 endpoint: https://secret.example.com'))
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 7 })
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('secret.example.com')
    expect((await prisma.mediaUploadReceipt.findUnique({ where: { key } }))?.consumedAt).toBeNull()
    expect(await prisma.photo.findFirst({ where: { url: `media://${key}` } })).toBeNull()
  })

  it('POST /photos 拒绝重放已经消费的 uploadReceipt', async () => {
    const uploadReceipt = await createPhotoReceipt(`photos/hunan/replay-${Date.now()}.webp`)
    const first = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 3 })
    const replay = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 4 })
    expect(first.status).toBe(201)
    expect(replay.status).toBe(422)
  })

  it('POST /photos 拒绝其他省份的 uploadReceipt', async () => {
    const uploadReceipt = await createPhotoReceipt(`photos/beijing/scope-${Date.now()}.webp`, 'beijing')
    const res = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 5 })
    expect(res.status).toBe(422)
  })

  it('POST /photos 拒绝过期或相册范围的 uploadReceipt', async () => {
    const expiredKey = `photos/hunan/expired-${Date.now()}.webp`
    const expired = await createPhotoReceipt(expiredKey)
    await prisma.mediaUploadReceipt.update({ where: { id: expired }, data: { expiresAt: new Date(Date.now() - 1_000) } })
    const albumReceipt = await prisma.mediaUploadReceipt.create({
      data: { key: `photos/album/not-a-photo-${Date.now()}.webp`, scope: 'album', expiresAt: new Date(Date.now() + 60_000) },
    })
    const expiredResponse = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt: expired, order: 8 })
    const wrongScopeResponse = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt: albumReceipt.id, order: 9 })
    expect(expiredResponse.status).toBe(422)
    expect(wrongScopeResponse.status).toBe(422)
    expect(JSON.stringify([expiredResponse.body, wrongScopeResponse.body])).not.toContain('media://')
  })

  it('POST /media/confirm 不会重新激活已消费的 uploadReceipt', async () => {
    const key = `tmp/photos/hunan/confirmed-once-${Date.now()}.webp`
    const confirmed = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    const created = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt: confirmed.body.uploadReceipt, order: 6 })
    const reconfirmed = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key })
    expect(created.status).toBe(201)
    expect(reconfirmed.status).toBe(422)
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
    const uploadReceipt = await createPhotoReceipt('photos/hunan/ann.webp')
    const created = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 2 })
    const res = await request(app.getHttpServer())
      .put(`/api/photos/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ annotation: '长沙橘子洲' })
    expect(res.status).toBe(200)
    expect(res.body.annotation).toBe('长沙橘子洲')
    expect(res.body.url).toMatch(/^https:\/\/signed\.example\.com\//)
    expect(res.body.url).not.toMatch(/^media:\/\//)
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

  // --- DR-002: 删除闭环 ---

  describe('DELETE /photos/:id 删除闭环', () => {
    beforeEach(async () => {
      await prisma.mediaDeletionTask.deleteMany()
      vi.mocked(mockStorage.delete).mockReset()
      vi.mocked(mockStorage.delete).mockResolvedValue(undefined)
    })

    it('存储正常：204 + 对象删除 + 任务 done + 记录已删', async () => {
      const uploadReceipt = await createPhotoReceipt('photos/hunan/del-ok.webp')
      const created = await request(app.getHttpServer())
        .post('/api/photos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ provinceCode: 'hunan', uploadReceipt, order: 90 })
      const res = await request(app.getHttpServer())
        .delete(`/api/photos/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
      expect(mockStorage.delete).toHaveBeenCalledWith('photos/hunan/del-ok.webp')

      const task = await prisma.mediaDeletionTask.findFirst({ where: { key: 'photos/hunan/del-ok.webp' } })
      expect(task?.status).toBe('done')
      expect(task?.doneAt).not.toBeNull()
      expect(await prisma.photo.findUnique({ where: { id: created.body.id } })).toBeNull()
    })

    it('存储故障：仍 204 + 任务 pending 含 lastError；恢复后重试转 done', async () => {
      const uploadReceipt = await createPhotoReceipt('photos/hunan/del-fail.webp')
      const created = await request(app.getHttpServer())
        .post('/api/photos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ provinceCode: 'hunan', uploadReceipt, order: 91 })
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(new Error('R2 down'))
      const res = await request(app.getHttpServer())
        .delete(`/api/photos/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
      expect(await prisma.photo.findUnique({ where: { id: created.body.id } })).toBeNull()

      let task = await prisma.mediaDeletionTask.findFirst({ where: { key: 'photos/hunan/del-fail.webp' } })
      expect(task?.status).toBe('pending')
      expect(task?.attempts).toBe(1)
      expect(task?.lastError).toContain('R2 down')

      // 存储恢复 + 到达重试时点 → 重试成功
      await prisma.mediaDeletionTask.update({
        where: { id: task!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      })
      const summary = await deletionService.runDueDeletions()
      expect(summary.failed).toBe(0)
      task = await prisma.mediaDeletionTask.findFirst({ where: { key: 'photos/hunan/del-fail.webp' } })
      expect(task?.status).toBe('done')
    })
  })
})
