import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../../app.module'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { PrismaService } from '../../prisma/prisma.service'

const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
const ownerToken = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })

describe('Album API', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
    prisma = module.get(PrismaService)
  })

  afterAll(() => app.close())

  beforeEach(async () => {
    await prisma.page.deleteMany()
    await prisma.album.deleteMany()
  })

  // --- Albums CRUD ---

  it('GET /albums returns empty array initially', async () => {
    const res = await request(app.getHttpServer()).get('/albums')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('GET /albums returns albums sorted by year asc', async () => {
    await prisma.album.create({ data: { year: 2025 } })
    await prisma.album.create({ data: { year: 2023 } })
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer()).get('/albums')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(3)
    expect(res.body[0].year).toBe(2023)
    expect(res.body[2].year).toBe(2025)
  })

  it('POST /albums creates album with admin token', async () => {
    const res = await request(app.getHttpServer())
      .post('/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, title: '2024年的回忆', coverUrl: 'https://example.com/cover.jpg' })
    expect(res.status).toBe(201)
    expect(res.body.year).toBe(2024)
    expect(res.body.title).toBe('2024年的回忆')
    expect(res.body.id).toBeDefined()
  })

  it('POST /albums returns 409 for duplicate year', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post('/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024 })
    expect(res.status).toBe(409)
  })

  it('POST /albums returns 403 without admin role', async () => {
    const res = await request(app.getHttpServer())
      .post('/albums')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ year: 2025 })
    expect(res.status).toBe(403)
  })

  it('POST /albums returns 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/albums')
      .send({ year: 2025 })
    expect(res.status).toBe(401)
  })

  it('PUT /albums/:id updates title', async () => {
    const album = await prisma.album.create({ data: { year: 2024, title: '旧标题' } })
    const res = await request(app.getHttpServer())
      .put(`/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '新标题' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('新标题')
  })

  it('PUT /albums/:id returns 409 for year conflict', async () => {
    await prisma.album.create({ data: { year: 2024 } })
    const album2 = await prisma.album.create({ data: { year: 2025 } })
    const res = await request(app.getHttpServer())
      .put(`/albums/${album2.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024 })
    expect(res.status).toBe(409)
  })

  it('PUT /albums/:id returns 404 for nonexistent', async () => {
    const res = await request(app.getHttpServer())
      .put('/albums/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'x' })
    expect(res.status).toBe(404)
  })

  it('DELETE /albums/:id returns 204 and cascades', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: JSON.stringify({ images: ['https://r2.example.com/photos/test/abc.webp'] }) },
    })
    const res = await request(app.getHttpServer())
      .delete(`/albums/${album.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
    const pages = await prisma.page.findMany({ where: { albumId: album.id } })
    expect(pages).toHaveLength(0)
  })

  it('DELETE /albums/nonexistent returns 404', async () => {
    const res = await request(app.getHttpServer())
      .delete('/albums/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  // --- Pages CRUD ---

  it('GET /albums/:id/pages returns pages sorted by order', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":["a.jpg"]}' } })
    await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'double-h', content: '{"images":["b.jpg","c.jpg"]}' } })
    const res = await request(app.getHttpServer()).get(`/albums/${album.id}/pages`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].order).toBe(1)
    expect(res.body[1].order).toBe(2)
  })

  it('GET /albums/nonexistent/pages returns 404', async () => {
    const res = await request(app.getHttpServer()).get('/albums/nonexistent/pages')
    expect(res.status).toBe(404)
  })

  it('POST /albums/:id/pages creates page', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post(`/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['url.jpg'] }, order: 1 })
    expect(res.status).toBe(201)
    expect(res.body.templateId).toBe('single')
    expect(res.body.order).toBe(1)
  })

  it('POST /albums/:id/pages returns 400 for invalid templateId', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const res = await request(app.getHttpServer())
      .post(`/albums/${album.id}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'invalid', content: { images: [] }, order: 1 })
    expect(res.status).toBe(400)
  })

  it('POST /albums/nonexistent/pages returns 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/albums/nonexistent/pages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['x.jpg'] }, order: 1 })
    expect(res.status).toBe(404)
  })

  it('PUT /pages/:id updates content', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":["old.jpg"]}' },
    })
    const res = await request(app.getHttpServer())
      .put(`/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { images: ['a.jpg', 'b.jpg'] } })
    expect(res.status).toBe(200)
    expect(res.body.templateId).toBe('double-h')
  })

  it('PUT /pages/nonexistent returns 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/pages/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { images: ['x.jpg'] } })
    expect(res.status).toBe(404)
  })

  it('DELETE /pages/:id returns 204', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' },
    })
    const res = await request(app.getHttpServer())
      .delete(`/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('PUT /albums/:id/pages/reorder updates order', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    const p1 = await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    const p2 = await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":[]}' } })
    const p3 = await prisma.page.create({ data: { albumId: album.id, order: 3, templateId: 'single', content: '{"images":[]}' } })

    const res = await request(app.getHttpServer())
      .put(`/albums/${album.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: [p3.id, p1.id, p2.id] })
    expect(res.status).toBe(200)

    const pages = await request(app.getHttpServer()).get(`/albums/${album.id}/pages`)
    expect(pages.body[0].id).toBe(p3.id)
    expect(pages.body[1].id).toBe(p1.id)
    expect(pages.body[2].id).toBe(p2.id)
  })

  it('PUT /albums/:id/pages/reorder returns 400 for incomplete pageIds', async () => {
    const album = await prisma.album.create({ data: { year: 2024 } })
    await prisma.page.create({ data: { albumId: album.id, order: 1, templateId: 'single', content: '{"images":[]}' } })
    await prisma.page.create({ data: { albumId: album.id, order: 2, templateId: 'single', content: '{"images":[]}' } })

    const res = await request(app.getHttpServer())
      .put(`/albums/${album.id}/pages/reorder`)
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
      .put(`/albums/${album1.id}/pages/reorder`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pageIds: [p2.id] })
    expect(res.status).toBe(400)
  })
})
