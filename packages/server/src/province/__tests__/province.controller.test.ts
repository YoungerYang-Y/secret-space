import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../auth/auth.service'
import { PrismaService } from '../../prisma/prisma.service'
import { createTestApp } from '../../__tests__/test-utils'
import type { MediaStorage } from '../../media/media-storage'

describe('Province API', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockStorage: MediaStorage
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })
  const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })
  const ownerToken = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '1h' })

  beforeAll(async () => {
    const result = await createTestApp()
    app = result.app
    prisma = result.module.get(PrismaService)
    mockStorage = result.mockStorage
    // Clean up any leftover photos from other tests or previous runs
    await prisma.photo.deleteMany()
  })

  afterAll(() => app.close())

  async function createPhotoReceipt(key: string) {
    return (
      await prisma.mediaUploadReceipt.upsert({
        where: { key },
        create: {
          key,
          scope: 'photo',
          provinceCode: 'hunan',
          expiresAt: new Date(Date.now() + 60_000),
        },
        update: {
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      })
    ).id
  }

  it('GET /provinces 返回 34 个省份', async () => {
    const res = await request(app.getHttpServer()).get('/api/provinces').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(34)
    expect(res.body[0]).toHaveProperty('code')
    expect(res.body[0]).toHaveProperty('visited')
    expect(res.body[0]).toHaveProperty('photoCount')
  })

  // --- AC2: 匿名照片读取返回 401 ---

  it('GET /provinces/:code/photos 匿名返回 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/provinces/hunan/photos')
    expect(res.status).toBe(401)
  })

  // --- AC2: visitor/owner/admin 读取同一媒体返回短期 URL ---

  it('GET /provinces/:code/photos visitor 获取签名 URL', async () => {
    const uploadReceipt = await createPhotoReceipt('photos/hunan/signed-test.webp')
    // 先创建一张照片（用 admin）
    const createRes = await request(app.getHttpServer())
      .post('/api/photos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ provinceCode: 'hunan', uploadReceipt, order: 100 })
    expect(createRes.status).toBe(201)

    const res = await request(app.getHttpServer())
      .get('/api/provinces/hunan/photos')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const photo = res.body.find((p: any) => p.order === 100)
    expect(photo).toBeDefined()
    // URL should be signed, not the raw media:// ref
    expect(photo.url).toMatch(/^https:\/\/signed\.example\.com\/photos\/hunan\/signed-test\.webp/)
    expect(photo.url).not.toMatch(/^media:\/\//)
  })

  it('GET /provinces/:code/photos admin 获取同样的签名 URL 格式', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/provinces/hunan/photos')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const photo = res.body.find((p: any) => p.order === 100)
    expect(photo).toBeDefined()
    expect(photo.url).toMatch(/^https:\/\/signed\.example\.com\//)
  })

  it('GET /provinces/:code/photos owner 获取同样的签名 URL 格式', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/provinces/hunan/photos')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    const photo = res.body.find((p: any) => p.order === 100)
    expect(photo).toBeDefined()
    expect(photo.url).toMatch(/^https:\/\/signed\.example\.com\//)
  })

  // --- AC4: 无照片省份返回 200 空数组 ---

  it('GET /provinces/:code/photos 无照片省份返回 200 空数组且零媒体 URL', async () => {
    // tibet 应该没有照片
    const res = await request(app.getHttpServer())
      .get('/api/provinces/xizang/photos')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    // presignRead should not have been called for empty result
  })

  it('GET /provinces/:code/photos never returns an un-migrated legacy URL', async () => {
    await prisma.photo.create({
      data: {
        provinceCode: 'hunan',
        url: 'https://legacy-public.example.com/photos/hunan/leaked.webp',
        key: '',
        order: 999,
      },
    })
    const res = await request(app.getHttpServer())
      .get('/api/provinces/hunan/photos')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('legacy-public.example.com')
    await prisma.photo.deleteMany({ where: { order: 999 } })
  })

  it('GET /provinces/:code/photos 将存储签名故障映射为通用 503', async () => {
    vi.mocked(mockStorage.presignRead).mockRejectedValueOnce(new Error('r2 endpoint: https://secret.example.com'))
    const res = await request(app.getHttpServer())
      .get('/api/provinces/hunan/photos')
      .set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toContain('secret.example.com')
  })

  it('GET /provinces/invalid/photos 返回 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/provinces/invalid/photos').set('Authorization', `Bearer ${visitorToken}`)
    expect(res.status).toBe(404)
  })

  it('PUT /provinces/:code admin 可修改 visited', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/provinces/beijing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: true })
    expect(res.status).toBe(200)
    expect(res.body.visited).toBe(true)
    // 恢复
    await request(app.getHttpServer())
      .put('/api/provinces/beijing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: false })
  })

  it('PUT /provinces/:code 非 admin 返回 403', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/provinces/beijing')
      .set('Authorization', `Bearer ${visitorToken}`)
      .send({ visited: true })
    expect(res.status).toBe(403)
  })

  it('PUT /provinces/invalid 返回 404', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/provinces/invalid')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ visited: true })
    expect(res.status).toBe(404)
  })
})
