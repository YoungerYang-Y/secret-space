import { INestApplication } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { PrismaService } from '../../prisma/prisma.service'
import { MediaDeletionService } from '../../media/media-deletion.service'
import { createTestApp } from '../../__tests__/test-utils'
import type { MediaStorage } from '../../media/media-storage'

const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
const ownerToken = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })
const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })

describe('Album API', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockStorage: MediaStorage
  let deletionService: MediaDeletionService

  beforeAll(async () => {
    const { app: testApp, module, mockStorage: ms } = await createTestApp()
    app = testApp
    prisma = module.get(PrismaService)
    mockStorage = ms
    deletionService = module.get(MediaDeletionService)
  })

  afterAll(() => app.close())

  async function createAlbumReceipt(key: string) {
    return (
      await prisma.mediaUploadReceipt.upsert({
        where: { key },
        create: {
          key,
          scope: 'album',
          expiresAt: new Date(Date.now() + 60_000),
        },
        update: {
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })
    ).id
  }

  beforeEach(async () => {
    await prisma.page.deleteMany()
    await prisma.album.deleteMany()
  })

  // --- Albums CRUD ---

  it('GET /albums returns empty array initially', async () => {
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  // --- AC2: 匿名相册读取返回 401 ---

  it('GET /albums 匿名返回 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/albums')
    expect(res.status).toBe(401)
  })

  // --- AC4: 过期或失效会话读取相册列表返回 401 ---

  it('GET /albums 失效 token 返回 401', async () => {
    const expiredToken = jwt.sign({ role: 'visitor', iat: 1000000 }, JWT_SECRET, { expiresIn: '1s' })
    // Wait briefly to ensure expiry
    await new Promise((r) => setTimeout(r, 1100))
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${expiredToken}`)
    expect(res.status).toBe(401)
  })

  it('GET /albums returns albums sorted by year asc', async () => {
    await prisma.album.create({ data: { year: 2025 } })
    await prisma.album.create({ data: { year: 2023 } })
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].year).toBe(2023)
    expect(res.body[2].year).toBe(2025)
  })

  // --- AC2: 读取相册时 coverUrl 为 media:// 返回签名 URL ---

  it('GET /albums 返回签名的 coverUrl', async () => {
    await prisma.album.create({ data: { year: 2024, coverUrl: 'media://photos/album/cover.webp' } })
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body[0].coverUrl).toMatch(/^https:\/\/signed\.example\.com\/photos\/album\/cover\.webp/)
  })

  it('GET /albums 将存储签名故障映射为通用 503', async () => {
    await prisma.album.create({ data: { year: 2024, coverUrl: 'media://photos/album/sign-failure.webp' } })
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('R2 endpoint: https://secret.example.com'))
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('secret.example.com')
  })

  // --- AC3: 相册空封面不签名 ---

  it('GET /albums 空封面返回 null 不签名', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body[0].coverUrl).toBeNull()
  })

  // --- AC1: album writes use coverRef and only admin ---

  it('POST /albums creates album with coverRef', async () => {
    const coverUploadReceipt = await createAlbumReceipt('photos/album/cover.webp')
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, title: '2024年的回忆', coverUploadReceipt })
    expect(res.status).toBe(201)
    expect(res.body.year).toBe(2024)
    expect(res.body.title).toBe('2024年的回忆')
    expect(res.body.id).toBeDefined()
    expect(res.body.coverUrl).toMatch(/^https:\/\/signed\.example\.com\/photos\/album\/cover\.webp/)
    expect((await prisma.album.findUnique({ where: { id: res.body.id } }))?.coverUrl).toBe('media://photos/album/cover.webp')
  })

  it('POST /albums 在读取签名故障时不消费回执或写入相册', async () => {
    const key = `photos/album/write-sign-failure-${Date.now()}.webp`
    const coverUploadReceipt = await createAlbumReceipt(key)
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('R2 temporarily unavailable'))
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, coverUploadReceipt })
    expect(res.status).toBe(503)
    expect((await prisma.mediaUploadReceipt.findUnique({ where: { key } }))?.consumedAt).toBeNull()
    expect(await prisma.album.findUnique({ where: { year: 2024 } })).toBeNull()
  })

  // --- AC3: 含 provider 信息的引用返回 400 ---

  it('POST /albums coverRef 含 vendor URL 返回 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, coverRef: 'https://r2.example.com/photos/album/cover.webp' })
    expect(res.status).toBe(400)
  })

  it('POST /albums returns 409 for duplicate year', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024 })
    expect(res.status).toBe(409)
  })

  it('POST /albums maps a concurrent duplicate-year write to 409', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/api/albums')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year: 2040 }),
      request(app.getHttpServer())
        .post('/api/albums')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year: 2040 }),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
  })

  it('POST /albums returns 403 without admin role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ year: 2025 })
    expect(res.status).toBe(403)
  })

  it('POST /albums returns 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .send({ year: 2025 })
    expect(res.status).toBe(401)
  })

  it('PUT /albums/:id updates title', async () => {
    const album = await prisma.album.create({ data: { year: 2024, title: '旧标题' } })
    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '新标题' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('新标题')
  })

  it('PUT /albums/:id updates coverRef', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const coverUploadReceipt = await createAlbumReceipt('photos/album/new-cover.webp')
    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coverUploadReceipt })
    expect(res.status).toBe(200)
    expect(res.body.coverUrl).toMatch(/^https:\/\/signed\.example\.com\/photos\/album\/new-cover\.webp/)
  })

  it('PUT /albums/:id returns 409 for year conflict', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const album2 = await prisma.album.create({ data: { year: 2025 } })
    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album2.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024 })
    expect(res.status).toBe(409)
  })

  it('PUT /albums/:id returns 404 for nonexistent', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/albums/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })

  it('DELETE /albums/:id returns 204 and cascades', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: JSON.stringify({ images: ['media://photos/album/abc.webp'] }) },
    })
    const res = await request(app.getHttpServer())
      .delete(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
    const pages = await prisma.page.findMany({ where: { albumId: album.id } })
    expect(pages).toHaveLength(0)
  })

  it('DELETE /albums/nonexistent returns 404', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/albums/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('DELETE /albums maps a concurrent second deletion to 404', async () => {
    const album = await prisma.album.create({ data: { year: 2041 } })
    const responses = await Promise.all([
      request(app.getHttpServer()).delete(`/api/albums/${album.id}`).set('Authorization', `Bearer ${adminToken}`),
      request(app.getHttpServer()).delete(`/api/albums/${album.id}`).set('Authorization', `Bearer ${adminToken}`),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([204, 404])
  })

  it('DELETE /albums returns 503 for a database timeout when the album still exists', async () => {
    const album = await prisma.album.create({ data: { year: 2042 } })
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Error('Timed out during query execution'),
    )

    const res = await request(app.getHttpServer())
      .delete(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(503)
    expect(await prisma.album.findUnique({ where: { id: album.id } })).not.toBeNull()
    transaction.mockRestore()
  })

  it('DELETE /albums maps a P2028 transaction closure to 503', async () => {
    const album = await prisma.album.create({ data: { year: 2044 } })
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Transaction already closed', {
        code: 'P2028',
        clientVersion: '5.0.0',
      }),
    )

    const res = await request(app.getHttpServer())
      .delete(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(503)
    expect(await prisma.album.findUnique({ where: { id: album.id } })).not.toBeNull()
    transaction.mockRestore()
  })

  it('DELETE /albums sweeps deletion tasks when the commit reported a timeout', async () => {
    const album = await prisma.album.create({
      data: { year: 2045, coverUrl: 'media://photos/album/timeout-gone.webp' },
    })
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (fn: any) => {
      await fn(prisma)
      throw new Error('Timed out during query execution')
    })

    const res = await request(app.getHttpServer())
      .delete(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    // 超时但事务实际已提交：按既有契约返回 404，同时兜底处理已登记的删除任务
    expect(res.status).toBe(404)
    expect(await prisma.album.findUnique({ where: { id: album.id } })).toBeNull()
    const tasks = await prisma.mediaDeletionTask.findMany({ where: { key: 'photos/album/timeout-gone.webp' } })
    expect(tasks.some((task) => task.status === 'done')).toBe(true)
    transaction.mockRestore()
  })

  // --- Pages CRUD ---

  // --- AC2: 匿名页面读取返回 401 ---

  it('GET /albums/:id/pages 匿名返回 401', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer()).get(`/api/albums/${album.id}/pages`)
    expect(res.status).toBe(401)
  })

  it('GET /albums/:id/pages returns pages sorted by order with signed URLs', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":["media://photos/album/a.webp"]}' } })
    await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'double-h', content: '{"images":["media://photos/album/b.webp","media://photos/album/c.webp"]}' } })
    const res = await request(app.getHttpServer()).get(`/api/albums/${album.id}/pages`).set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].order).toBe(1)
    expect(res.body[1].order).toBe(2)
    // Images should be signed
    const content = JSON.parse(res.body[0].content)
    expect(content.images[0]).toMatch(/^https:\/\/signed\.example\.com\/photos\/album\/b\.webp/)
    expect(content.images[1]).toMatch(/^https:\/\/signed\.example\.com\/photos\/album\/c\.webp/)
  })

  it('GET /albums/:id/pages 对同一对象只签名一次', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'double-h',
        content: JSON.stringify({ images: ['media://photos/album/shared.webp', 'media://photos/album/shared.webp'] }),
      },
    })
    const callCountBefore = vi.mocked(mockStorage.presignRead).mock.calls.length
    const res = await request(app.getHttpServer())
      .get(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(vi.mocked(mockStorage.presignRead).mock.calls.length).toBe(callCountBefore + 1)
  })

  // --- AC3: 空图片不签名 ---

  it('GET /albums/:id/pages 空图片数组不触发签名', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    const callCountBefore = vi.mocked(mockStorage.presignRead).mock.calls.length
    const res = await request(app.getHttpServer()).get(`/api/albums/${album.id}/pages`).set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    const content = JSON.parse(res.body[0].content)
    expect(content.images).toEqual([])
    // No new presignRead calls
    expect(vi.mocked(mockStorage.presignRead).mock.calls.length).toBe(callCountBefore)
  })

  it('GET /albums/nonexistent/pages returns 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/albums/nonexistent/pages').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  // --- AC1: page writes use media:// refs and are admin-only ---

  it('POST /albums/:id/pages creates page with media refs', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const imageReceipt = await createAlbumReceipt('photos/album/img.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [imageReceipt] }, order: 1 })
    expect(res.status).toBe(201)
    expect(res.body.templateId).toBe('single')
    expect(res.body.order).toBe(1)
  })

  it('POST /albums/:id/pages validates the template image count', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('single 模板需要 1 张图片')
    expect(res.body.message).toContain('收到 0 张有效图片')
  })

  it('POST /albums/:id/pages rejects single with more than one image', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const r1 = await createAlbumReceipt('photos/album/single-extra-1.webp')
    const r2 = await createAlbumReceipt('photos/album/single-extra-2.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [r1, r2] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('single 模板需要 1 张图片')
    expect(res.body.message).toContain('收到 2 张有效图片')
  })

  it('POST /albums/:id/pages rejects double-h with one image', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const r1 = await createAlbumReceipt('photos/album/double-h-one.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { imageReceipts: [r1] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('double-h 模板需要 2 张图片')
  })

  it('POST /albums/:id/pages rejects double-v with one image', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const r1 = await createAlbumReceipt('photos/album/double-v-one.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-v', content: { imageReceipts: [r1] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('double-v 模板需要 2 张图片')
  })

  it('POST /albums/:id/pages rejects triple with two images', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const r1 = await createAlbumReceipt('photos/album/triple-two-1.webp')
    const r2 = await createAlbumReceipt('photos/album/triple-two-2.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'triple', content: { imageReceipts: [r1, r2] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('triple 模板需要 3 张图片')
  })

  it('POST /albums/:id/pages creates a triple page with exactly three images', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const receipts = await Promise.all([
      createAlbumReceipt('photos/album/triple-ok-1.webp'),
      createAlbumReceipt('photos/album/triple-ok-2.webp'),
      createAlbumReceipt('photos/album/triple-ok-3.webp'),
    ])
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'triple', content: { imageReceipts: receipts } })

    expect(res.status).toBe(201)
    expect(res.body.templateId).toBe('triple')
    expect(res.body.order).toBe(1)
  })

  it('POST /albums/:id/pages rejects photo-text with two images', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const r1 = await createAlbumReceipt('photos/album/photo-text-two-1.webp')
    const r2 = await createAlbumReceipt('photos/album/photo-text-two-2.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [r1, r2], text: '有文字' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('photo-text 模板需要 1 张图片')
  })

  it('POST /albums/:id/pages rejects null and empty image receipts on create', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })

    for (const imageReceipts of [[null], ['']]) {
      const res = await request(app.getHttpServer())
        .post(`/api/albums/${album.id}/pages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateId: 'single', content: { imageReceipts } })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('创建页面时图片不能为空')
    }
  })

  it('POST /albums/:id/pages requires a text field for the photo-text template', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const receipt = await createAlbumReceipt('photos/album/photo-text-no-text.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('photo-text 模板需要填写文字')
  })

  it('POST /albums/:id/pages creates a photo-text page with valid text', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const receipt = await createAlbumReceipt('photos/album/photo-text-ok.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt], text: '有意义的文字' } })

    expect(res.status).toBe(201)
    expect(JSON.parse(res.body.content)).toMatchObject({ text: '有意义的文字' })
  })

  it('POST /albums/:id/pages rejects a photo-scope receipt', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const photoReceipt = (
      await prisma.mediaUploadReceipt.upsert({
        where: { key: 'photos/beijing/cross-scope.webp' },
        create: {
          key: 'photos/beijing/cross-scope.webp',
          scope: 'photo',
          provinceCode: 'beijing',
          expiresAt: new Date(Date.now() + 60_000),
        },
        update: { consumedAt: null, expiresAt: new Date(Date.now() + 60_000) },
      })
    ).id
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [photoReceipt] } })

    expect(res.status).toBe(422)
    expect(res.body.message).toContain('不属于当前资源')
  })

  it('POST /albums/:id/pages requires text for the photo-text template', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const receipt = await createAlbumReceipt('photos/album/photo-text.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt], text: '   ' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('photo-text 模板需要填写文字')
  })

  it('POST /albums/:id/pages assigns the next order when one is not provided', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    await prisma.page.create({
      data: { albumId: album.id, order: 3, templateId: 'single', content: '{"images":[]}' },
    })
    const receipt = await createAlbumReceipt('photos/album/auto-order.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt] } })

    expect(res.status).toBe(201)
    expect(res.body.order).toBe(4)
  })

  it('POST /albums/:id/pages rejects zero and negative order values', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const receipt = await createAlbumReceipt('photos/album/invalid-order.webp')

    for (const order of [0, -1]) {
      const res = await request(app.getHttpServer())
        .post(`/api/albums/${album.id}/pages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ templateId: 'single', content: { imageReceipts: [receipt] }, order })
      expect(res.status).toBe(400)
    }
  })

  it('POST /albums/:id/pages returns 400 for invalid templateId', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'invalid', content: { imageReceipts: [] }, order: 1 })
    expect(res.status).toBe(400)
  })

  it('POST /albums/:id/pages 缺失 content 返回 400', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', order: 1 })
    expect(res.status).toBe(400)
  })

  it('POST /albums/nonexistent/pages returns 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums/nonexistent/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [] }, order: 1 })
    expect(res.status).toBe(404)
  })

  it('PUT /pages/:id updates content', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const firstReceipt = await createAlbumReceipt('photos/album/a.webp')
    const secondReceipt = await createAlbumReceipt('photos/album/b.webp')
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":["media://photos/album/old.webp"]}' },
    })
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { imageReceipts: [firstReceipt, secondReceipt] } })
    expect(res.status).toBe(200)
    expect(res.body.templateId).toBe('double-h')
  })

  it('PUT /pages/:id requires image receipts when changing templates', async () => {
    const album = await prisma.album.create({ data: { year: 2029 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'single',
        content: JSON.stringify({ images: ['media://photos/album/unchanged.webp'] }),
      },
    })
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { text: '不应绕过图片校验' } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('修改模板时必须提供图片')
  })

  it('PUT /pages/:id rejects changing template with mismatched image count', async () => {
    const album = await prisma.album.create({ data: { year: 2031 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'single',
        content: JSON.stringify({ images: ['media://photos/album/count-mismatch.webp'] }),
      },
    })
    const receipt = await createAlbumReceipt('photos/album/count-mismatch-new.webp')
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { imageReceipts: [receipt] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('double-h 模板需要 2 张图片')
  })

  it('PUT /pages/:id replaces one image and keeps the other via null', async () => {
    const album = await prisma.album.create({ data: { year: 2032 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'double-h',
        content: JSON.stringify({
          images: ['media://photos/album/old-first.webp', 'media://photos/album/keep-second.webp'],
        }),
      },
    })
    const receipt = await createAlbumReceipt('photos/album/replacement.webp')
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { imageReceipts: [receipt, null] } })

    expect(res.status).toBe(200)
    const stored = (await prisma.page.findUnique({ where: { id: page.id } }))?.content ?? ''
    expect(stored).toContain('media://photos/album/replacement.webp')
    expect(stored).toContain('media://photos/album/keep-second.webp')
    expect(stored).not.toContain('media://photos/album/old-first.webp')
  })

  it('PUT /pages/:id updates photo-text text without replacing its images', async () => {
    const album = await prisma.album.create({ data: { year: 2027 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'photo-text',
        content: JSON.stringify({ images: ['media://photos/album/kept.webp'], text: '旧文字' }),
      },
    })
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { text: '新文字' } })

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body.content)).toMatchObject({ text: '新文字' })
    expect((await prisma.page.findUnique({ where: { id: page.id } }))?.content).toContain('media://photos/album/kept.webp')
  })

  it('PUT /pages/:id keeps photo-text text when only images are replaced', async () => {
    const album = await prisma.album.create({ data: { year: 2028 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'photo-text',
        content: JSON.stringify({ images: ['media://photos/album/old.webp'], text: '保留的文字' }),
      },
    })
    const receipt = await createAlbumReceipt('photos/album/replaced.webp')
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { imageReceipts: [receipt] } })

    expect(res.status).toBe(200)
    expect(JSON.parse(res.body.content)).toMatchObject({ text: '保留的文字' })
  })

  it('PUT /pages/nonexistent returns 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/pages/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [] } })
    expect(res.status).toBe(404)
  })

  it('PUT /pages/:id rejects null when there is no existing image to preserve', async () => {
    const album = await prisma.album.create({ data: { year: 2030 } })
    const page = await prisma.page.create({
      data: {
        albumId: album.id,
        order: 1,
        templateId: 'double-h',
        content: JSON.stringify({ images: ['media://photos/album/present.webp', ''] }),
      },
    })
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { imageReceipts: [null, null] } })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('原图不存在，无法保留')
  })

  it('DELETE /pages/:id returns 204', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' },
    })
    const res = await request(app.getHttpServer())
      .delete(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('PUT /albums/:id/pages/reorder updates order', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const p1 = await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    const p2 = await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":[]}' } })
    const p3 = await prisma.page.create({ data: { albumId: album.id, order: 3, templateId: 'single', content: '{"images":[]}' } })

    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: [p3.id, p1.id, p2.id] })
    expect(res.status).toBe(200)

    const pages = await request(app.getHttpServer()).get(`/api/albums/${album.id}/pages`).set('Authorization', `Bearer ${adminToken}`)
    expect(pages.body[0].id).toBe(p3.id)
    expect(pages.body[1].id).toBe(p1.id)
    expect(pages.body[2].id).toBe(p2.id)
  })

  it('PUT /albums/:id/pages/reorder returns 400 for incomplete pageIds', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":[]}' } })

    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: ['only-one'] })
    expect(res.status).toBe(400)
  })

  it('PUT /albums/:id/pages/reorder returns 400 for cross-album pageIds', async () => {
    const album1 = await prisma.album.create({ data: { year: 2024 } })
    const album2 = await prisma.album.create({ data: { year: 2025 } })
    const p1 = await prisma.page.create({ data: { albumId: album1.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    const p2 = await prisma.page.create({ data: { albumId: album2.id, order: 1, templateId: 'single', content: '{"images":[]}' } })

    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album1.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: [p2.id] })
    expect(res.status).toBe(400)
  })

  it('PUT /albums/:id/pages/reorder rejects duplicate page IDs', async () => {
    const album = await prisma.album.create({ data: { year: 2026 } })
    const p1 = await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    const p2 = await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":[]}' } })
    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: [p1.id, p1.id] })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('pageIds must be unique')
    expect((await prisma.page.findUnique({ where: { id: p2.id } }))?.order).toBe(2)
  })

  it('concurrent reorders leave every page with a unique continuous order', async () => {
    const album = await prisma.album.create({ data: { year: 2043 } })
    const pages = await Promise.all([1, 2, 3].map((order) => prisma.page.create({
      data: { albumId: album.id, order, templateId: 'single', content: '{"images":[]}' },
    })))
    const responses = await Promise.all([
      request(app.getHttpServer())
        .put(`/api/albums/${album.id}/pages/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pageIds: [pages[2].id, pages[1].id, pages[0].id] }),
      request(app.getHttpServer())
        .put(`/api/albums/${album.id}/pages/reorder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pageIds: [pages[1].id, pages[0].id, pages[2].id] }),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([200, 200])
    const current = await prisma.page.findMany({ where: { albumId: album.id }, orderBy: { order: 'asc' } })
    expect(current.map((page) => page.order)).toEqual([1, 2, 3])
  })

  // --- DR-002: 删除闭环 ---

  describe('删除闭环', () => {
    beforeEach(async () => {
      await prisma.mediaDeletionTask.deleteMany()
      vi.mocked(mockStorage.delete).mockReset()
      vi.mocked(mockStorage.delete).mockResolvedValue(undefined)
    })

    it('删除相册：封面与全部页面图片登记任务，存储正常时全部 done', async () => {
      const album = await prisma.album.create({
        data: { year: 2031, coverUrl: 'media://photos/album/cover-2031.webp' },
      })
      await prisma.page.create({
        data: {
          albumId: album.id,
          order: 1,
          templateId: 'double-h',
          content: JSON.stringify({ images: ['media://photos/album/p1a.webp', 'media://photos/album/p1b.webp'] }),
        },
      })
      await prisma.page.create({
        data: {
          albumId: album.id,
          order: 2,
          templateId: 'single',
          content: JSON.stringify({ images: ['media://photos/album/p2.webp'] }),
        },
      })

      const res = await request(app.getHttpServer())
        .delete(`/api/albums/${album.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)

      const tasks = await prisma.mediaDeletionTask.findMany({ orderBy: { key: 'asc' } })
      expect(tasks.map((t) => t.key)).toEqual([
        'photos/album/cover-2031.webp',
        'photos/album/p1a.webp',
        'photos/album/p1b.webp',
        'photos/album/p2.webp',
      ])
      for (const t of tasks) {
        expect(t.status).toBe('done')
        expect(t.doneAt).not.toBeNull()
      }
      expect(vi.mocked(mockStorage.delete).mock.calls.map((c) => c[0]).sort()).toEqual([
        'photos/album/cover-2031.webp',
        'photos/album/p1a.webp',
        'photos/album/p1b.webp',
        'photos/album/p2.webp',
      ])
    })

    it('删除相册：存储故障仍 204，任务 pending 含 lastError，恢复后重试转 done', async () => {
      const album = await prisma.album.create({
        data: { year: 2032, coverUrl: 'media://photos/album/cover-2032.webp' },
      })
      vi.mocked(mockStorage.delete).mockRejectedValueOnce(new Error('R2 unavailable'))

      const res = await request(app.getHttpServer())
        .delete(`/api/albums/${album.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
      expect(await prisma.album.findUnique({ where: { id: album.id } })).toBeNull()

      let task = await prisma.mediaDeletionTask.findFirst({ where: { key: 'photos/album/cover-2032.webp' } })
      expect(task?.status).toBe('pending')
      expect(task?.attempts).toBe(1)
      expect(task?.lastError).toContain('R2 unavailable')

      await prisma.mediaDeletionTask.update({
        where: { id: task!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      })
      const summary = await deletionService.runDueDeletions()
      expect(summary.failed).toBe(0)
      task = await prisma.mediaDeletionTask.findFirst({ where: { key: 'photos/album/cover-2032.webp' } })
      expect(task?.status).toBe('done')
    })

    it('删除单页：登记该页图片任务（回归：页面删除不再遗留孤儿对象）', async () => {
      const album = await prisma.album.create({ data: { year: 2033 } })
      const page = await prisma.page.create({
        data: {
          albumId: album.id,
          order: 1,
          templateId: 'double-h',
          content: JSON.stringify({ images: ['media://photos/album/pg-a.webp', 'media://photos/album/pg-b.webp'] }),
        },
      })

      const res = await request(app.getHttpServer())
        .delete(`/api/pages/${page.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)

      const tasks = await prisma.mediaDeletionTask.findMany({ orderBy: { key: 'asc' } })
      expect(tasks.map((t) => t.key)).toEqual(['photos/album/pg-a.webp', 'photos/album/pg-b.webp'])
      for (const t of tasks) expect(t.status).toBe('done')
    })
  })
})
