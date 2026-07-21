import { INestApplication } from '@nestjs/common'
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

  // --- AC3: 相册空封面不签名 ---

  it('GET /albums 空封面返回 null 不签名', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer()).get('/api/albums').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body[0].coverUrl).toBeNull()
  })

  // --- AC1: album writes use coverRef and only admin ---

  it('POST /albums creates album with coverRef', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, title: '2024年的回忆', coverRef: 'media://photos/album/cover.webp' })
    expect(res.status).toBe(201)
    expect(res.body.year).toBe(2024)
    expect(res.body.title).toBe('2024年的回忆')
    expect(res.body.id).toBeDefined()
    // Persisted as media:// ref
    expect(res.body.coverUrl).toBe('media://photos/album/cover.webp')
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
    const res = await request(app.getHttpServer())
      .put(`/api/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coverRef: 'media://photos/album/new-cover.webp' })
    expect(res.status).toBe(200)
    expect(res.body.coverUrl).toBe('media://photos/album/new-cover.webp')
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
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['media://photos/album/img.webp'] }, order: 1 })
    expect(res.status).toBe(201)
    expect(res.body.templateId).toBe('single')
    expect(res.body.order).toBe(1)
  })

  it('POST /albums/:id/pages returns 400 for invalid templateId', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'invalid', content: { images: [] }, order: 1 })
    expect(res.status).toBe(400)
  })

  it('POST /albums/nonexistent/pages returns 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/albums/nonexistent/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['media://photos/album/x.webp'] }, order: 1 })
    expect(res.status).toBe(404)
  })

  it('PUT /pages/:id updates content', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":["media://photos/album/old.webp"]}' },
    })
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { images: ['media://photos/album/a.webp', 'media://photos/album/b.webp'] } })
    expect(res.status).toBe(200)
    expect(res.body.templateId).toBe('double-h')
  })

  it('PUT /pages/nonexistent returns 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/pages/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['media://photos/album/x.webp'] } })
    expect(res.status).toBe(404)
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
