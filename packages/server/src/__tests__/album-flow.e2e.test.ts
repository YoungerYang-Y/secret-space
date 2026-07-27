import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PrismaService } from '../prisma/prisma.service'
import { createTestApp } from './test-utils'
import type { MediaStorage } from '../media/media-storage'
import { RateLimitGuard } from '../auth/rate-limit.guard'

/**
 * 相册业务完整生命周期 E2E 测试
 * 模拟管理员从创建相册到删除的全流程（使用 media:// 引用）
 */
describe('Album Lifecycle (E2E)', () => {
  let app: INestApplication
  let adminCookie: string
  let mockStorage: MediaStorage

  beforeAll(async () => {
    const { app: testApp, module, mockStorage: ms } = await createTestApp()
    app = testApp
    mockStorage = ms
    // 清理测试数据
    const prisma = module.get(PrismaService)
    await prisma.page.deleteMany()
    await prisma.album.deleteMany()
  })

  afterAll(() => app.close())
  beforeEach(() => {
    RateLimitGuard.attempts.clear()
  })

  it('完整流程：登录 → 确认上传 → 创建相册 → 添加页面 → 排序 → 查询 → 更新 → 删除', async () => {
    // Step 1: 管理员登录拿 Cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'admin888' })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.role).toBe('admin')
    adminCookie = loginRes.headers['set-cookie'][0]

    const runId = Date.now().toString()

    async function confirmUpload(key: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post('/api/media/confirm')
        .set('Cookie', adminCookie)
        .send({ key })
      expect(response.status).toBe(200)
      expect(response.body.uploadReceipt).toEqual(expect.any(String))
      expect(response.body).not.toHaveProperty('mediaRef')
      return response.body.uploadReceipt
    }

    // Step 2: 未认证访问写接口被拒绝
    const noAuthRes = await request(app.getHttpServer())
      .post('/api/albums')
      .send({ year: 2099 })
    expect(noAuthRes.status).toBe(401)

    // Step 3: 确认上传 — 管理员确认媒体文件
    const coverUploadReceipt = await confirmUpload(`tmp/photos/album/cover-2025-${runId}.webp`)

    // Step 4: 创建相册（消费确认回执）
    const createRes = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Cookie', adminCookie)
      .send({ year: 2025, title: '2025年的回忆', coverUploadReceipt })
    expect(createRes.status).toBe(201)
    const albumId = createRes.body.id
    expect(createRes.body.year).toBe(2025)
    expect(createRes.body.coverUrl).toMatch(new RegExp(`^https://signed\\.example\\.com/photos/album/cover-2025-${runId}\\.webp`))

    // Step 5: 重复创建同年份被拒绝
    const dupRes = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Cookie', adminCookie)
      .send({ year: 2025 })
    expect(dupRes.status).toBe(409)

    // Step 6: 添加 3 个页面（消费各自的确认回执）
    const page1Receipt = await confirmUpload(`tmp/photos/album/img1-${runId}.webp`)
    const page1Res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Cookie', adminCookie)
      .send({ templateId: 'single', content: { imageReceipts: [page1Receipt] }, order: 1 })
    expect(page1Res.status).toBe(201)
    const page1Id = page1Res.body.id

    const page2ReceiptA = await confirmUpload(`tmp/photos/album/a-${runId}.webp`)
    const page2ReceiptB = await confirmUpload(`tmp/photos/album/b-${runId}.webp`)
    const page2Res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Cookie', adminCookie)
      .send({ templateId: 'double-h', content: { imageReceipts: [page2ReceiptA, page2ReceiptB] }, order: 2 })
    expect(page2Res.status).toBe(201)
    const page2Id = page2Res.body.id

    const page3Receipt = await confirmUpload(`tmp/photos/album/c-${runId}.webp`)
    const page3Res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Cookie', adminCookie)
      .send({ templateId: 'photo-text', content: { imageReceipts: [page3Receipt], text: '夏日海边' }, order: 3 })
    expect(page3Res.status).toBe(201)
    const page3Id = page3Res.body.id

    // Step 7: 无效模板被拒绝
    const badTplRes = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Cookie', adminCookie)
      .send({ templateId: 'nonexistent', content: { imageReceipts: [] }, order: 4 })
    expect(badTplRes.status).toBe(400)

    // Step 8: 查询相册列表（认证用户获取签名 URL）
    const listRes = await request(app.getHttpServer()).get('/api/albums').set('Cookie', adminCookie)
    expect(listRes.status).toBe(200)
    const album = listRes.body.find((a: any) => a.id === albumId)
    expect(album).toBeDefined()
    expect(album.year).toBe(2025)
    // coverUrl should be signed, not raw media://
    expect(album.coverUrl).toMatch(new RegExp(`^https://signed\\.example\\.com/photos/album/cover-2025-${runId}\\.webp`))

    // Step 9: 查询页面列表，验证按 order 排序 + 图片签名
    const pagesRes = await request(app.getHttpServer()).get(`/api/albums/${albumId}/pages`).set('Cookie', adminCookie)
    expect(pagesRes.status).toBe(200)
    expect(pagesRes.body).toHaveLength(3)
    expect(pagesRes.body[0].order).toBe(1)
    expect(pagesRes.body[2].order).toBe(3)
    // Page images should be signed
    const pageContent = JSON.parse(pagesRes.body[0].content)
    expect(pageContent.images[0]).toMatch(new RegExp(`^https://signed\\.example\\.com/photos/album/img1-${runId}\\.webp`))

    // Step 10: 重排序 (3, 1, 2)
    const reorderRes = await request(app.getHttpServer())
      .put(`/api/albums/${albumId}/pages/reorder`)
      .set('Cookie', adminCookie)
      .send({ pageIds: [page3Id, page1Id, page2Id] })
    expect(reorderRes.status).toBe(200)

    // Step 11: 验证新顺序
    const reorderedRes = await request(app.getHttpServer()).get(`/api/albums/${albumId}/pages`).set('Cookie', adminCookie)
    expect(reorderedRes.body[0].id).toBe(page3Id)
    expect(reorderedRes.body[1].id).toBe(page1Id)
    expect(reorderedRes.body[2].id).toBe(page2Id)

    // Step 12: 更新页面内容
    const updatePageRes = await request(app.getHttpServer())
      .put(`/api/pages/${page1Id}`)
      .set('Cookie', adminCookie)
      .send({ templateId: 'photo-text', content: { imageReceipts: [await confirmUpload(`tmp/photos/album/new-${runId}.webp`)], text: '更新后的描述' } })
    expect(updatePageRes.status).toBe(200)
    expect(updatePageRes.body.templateId).toBe('photo-text')

    // Step 13: 更新相册标题
    const updateAlbumRes = await request(app.getHttpServer())
      .put(`/api/albums/${albumId}`)
      .set('Cookie', adminCookie)
      .send({ title: '2025年·美好记忆' })
    expect(updateAlbumRes.status).toBe(200)
    expect(updateAlbumRes.body.title).toBe('2025年·美好记忆')

    // Step 14: 删除一个页面
    const deletePageRes = await request(app.getHttpServer())
      .delete(`/api/pages/${page2Id}`)
      .set('Cookie', adminCookie)
    expect(deletePageRes.status).toBe(204)

    // Step 15: 验证页面减少
    const afterDeleteRes = await request(app.getHttpServer()).get(`/api/albums/${albumId}/pages`).set('Cookie', adminCookie)
    expect(afterDeleteRes.body).toHaveLength(2)
    expect(afterDeleteRes.body.find((p: any) => p.id === page2Id)).toBeUndefined()

    // Step 16: 删除相册（级联删除页面）
    const deleteAlbumRes = await request(app.getHttpServer())
      .delete(`/api/albums/${albumId}`)
      .set('Cookie', adminCookie)
    expect(deleteAlbumRes.status).toBe(204)

    // Step 17: 验证相册和页面都已消失
    const finalListRes = await request(app.getHttpServer()).get('/api/albums').set('Cookie', adminCookie)
    expect(finalListRes.body.find((a: any) => a.id === albumId)).toBeUndefined()

    const finalPagesRes = await request(app.getHttpServer()).get(`/api/albums/${albumId}/pages`).set('Cookie', adminCookie)
    expect(finalPagesRes.status).toBe(404)
  })

  it('权限隔离：owner 角色无法操作管理接口', async () => {
    // owner 登录
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ password: 'guoguo123' })
    expect(loginRes.status).toBe(200)
    const ownerCookie = loginRes.headers['set-cookie'][0]

    // owner 可以读取相册列表
    const listRes = await request(app.getHttpServer()).get('/api/albums').set('Cookie', ownerCookie)
    expect(listRes.status).toBe(200)

    // owner 无法创建相册
    const createRes = await request(app.getHttpServer())
      .post('/api/albums')
      .set('Cookie', ownerCookie)
      .send({ year: 2099 })
    expect(createRes.status).toBe(403)

    // owner 无法确认上传
    const confirmRes = await request(app.getHttpServer())
      .post('/api/media/confirm')
      .set('Cookie', ownerCookie)
      .send({ key: 'tmp/photos/album/x.webp' })
    expect(confirmRes.status).toBe(403)
  })

  it('匿名用户无法读取相册和页面', async () => {
    // 匿名读相册列表
    const albumsRes = await request(app.getHttpServer()).get('/api/albums')
    expect(albumsRes.status).toBe(401)

    // 匿名读页面
    const pagesRes = await request(app.getHttpServer()).get('/api/albums/any-id/pages')
    expect(pagesRes.status).toBe(401)
  })
})
