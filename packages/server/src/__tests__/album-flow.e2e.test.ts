import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma/prisma.service'

/**
 * 相册业务完整生命周期 E2E 测试
 * 模拟管理员从创建相册到删除的全流程
 */
describe('Album Lifecycle (E2E)', () => {
  let app: INestApplication
  let adminToken: string

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
    // 清理测试数据
    const prisma = module.get(PrismaService)
    await prisma.page.deleteMany()
    await prisma.album.deleteMany()
  })

  afterAll(() => app.close())

  it('完整流程：登录 → 创建相册 → 添加页面 → 排序 → 查询 → 更新 → 删除', async () => {
    // Step 1: 管理员登录拿 token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ password: 'admin888' })
    expect(loginRes.status).toBe(200)
    expect(loginRes.body.role).toBe('admin')
    adminToken = loginRes.body.token

    const headers = { Authorization: `Bearer ${adminToken}` }

    // Step 2: 未认证访问写接口被拒绝
    const noAuthRes = await request(app.getHttpServer())
      .post('/albums')
      .send({ year: 2099 })
    expect(noAuthRes.status).toBe(401)

    // Step 3: 创建相册
    const createRes = await request(app.getHttpServer())
      .post('/albums')
      .set(headers)
      .send({ year: 2025, title: '2025年的回忆' })
    expect(createRes.status).toBe(201)
    const albumId = createRes.body.id
    expect(createRes.body.year).toBe(2025)

    // Step 4: 重复创建同年份被拒绝
    const dupRes = await request(app.getHttpServer())
      .post('/albums')
      .set(headers)
      .send({ year: 2025 })
    expect(dupRes.status).toBe(409)

    // Step 5: 添加 3 个页面（不同模板）
    const page1Res = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set(headers)
      .send({ templateId: 'single', content: { images: ['https://example.com/img1.webp'] }, order: 1 })
    expect(page1Res.status).toBe(201)
    const page1Id = page1Res.body.id

    const page2Res = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set(headers)
      .send({ templateId: 'double-h', content: { images: ['https://example.com/a.webp', 'https://example.com/b.webp'] }, order: 2 })
    expect(page2Res.status).toBe(201)
    const page2Id = page2Res.body.id

    const page3Res = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set(headers)
      .send({ templateId: 'photo-text', content: { images: ['https://example.com/c.webp'], text: '夏日海边' }, order: 3 })
    expect(page3Res.status).toBe(201)
    const page3Id = page3Res.body.id

    // Step 6: 无效模板被拒绝
    const badTplRes = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set(headers)
      .send({ templateId: 'nonexistent', content: { images: [] }, order: 4 })
    expect(badTplRes.status).toBe(400)

    // Step 7: 公开查询相册列表（无需 token）
    const listRes = await request(app.getHttpServer()).get('/albums')
    expect(listRes.status).toBe(200)
    const album = listRes.body.find((a: any) => a.id === albumId)
    expect(album).toBeDefined()
    expect(album.year).toBe(2025)

    // Step 8: 公开查询页面列表，验证按 order 排序
    const pagesRes = await request(app.getHttpServer()).get(`/albums/${albumId}/pages`)
    expect(pagesRes.status).toBe(200)
    expect(pagesRes.body).toHaveLength(3)
    expect(pagesRes.body[0].order).toBe(1)
    expect(pagesRes.body[2].order).toBe(3)

    // Step 9: 重排序 (3, 1, 2)
    const reorderRes = await request(app.getHttpServer())
      .put(`/albums/${albumId}/pages/reorder`)
      .set(headers)
      .send({ pageIds: [page3Id, page1Id, page2Id] })
    expect(reorderRes.status).toBe(200)

    // Step 10: 验证新顺序
    const reorderedRes = await request(app.getHttpServer()).get(`/albums/${albumId}/pages`)
    expect(reorderedRes.body[0].id).toBe(page3Id)
    expect(reorderedRes.body[1].id).toBe(page1Id)
    expect(reorderedRes.body[2].id).toBe(page2Id)

    // Step 11: 更新页面内容
    const updatePageRes = await request(app.getHttpServer())
      .put(`/pages/${page1Id}`)
      .set(headers)
      .send({ templateId: 'photo-text', content: { images: ['https://example.com/new.webp'], text: '更新后的描述' } })
    expect(updatePageRes.status).toBe(200)
    expect(updatePageRes.body.templateId).toBe('photo-text')

    // Step 12: 更新相册标题
    const updateAlbumRes = await request(app.getHttpServer())
      .put(`/albums/${albumId}`)
      .set(headers)
      .send({ title: '2025年·美好记忆' })
    expect(updateAlbumRes.status).toBe(200)
    expect(updateAlbumRes.body.title).toBe('2025年·美好记忆')

    // Step 13: 删除一个页面
    const deletePageRes = await request(app.getHttpServer())
      .delete(`/pages/${page2Id}`)
      .set(headers)
    expect(deletePageRes.status).toBe(204)

    // Step 14: 验证页面减少
    const afterDeleteRes = await request(app.getHttpServer()).get(`/albums/${albumId}/pages`)
    expect(afterDeleteRes.body).toHaveLength(2)
    expect(afterDeleteRes.body.find((p: any) => p.id === page2Id)).toBeUndefined()

    // Step 15: 删除相册（级联删除页面）
    const deleteAlbumRes = await request(app.getHttpServer())
      .delete(`/albums/${albumId}`)
      .set(headers)
    expect(deleteAlbumRes.status).toBe(204)

    // Step 16: 验证相册和页面都已消失
    const finalListRes = await request(app.getHttpServer()).get('/albums')
    expect(finalListRes.body.find((a: any) => a.id === albumId)).toBeUndefined()

    const finalPagesRes = await request(app.getHttpServer()).get(`/albums/${albumId}/pages`)
    expect(finalPagesRes.status).toBe(404)
  })

  it('权限隔离：owner 角色无法操作管理接口', async () => {
    // owner 登录
    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ password: 'guoguo123' })
    expect(loginRes.status).toBe(200)
    const ownerToken = loginRes.body.token
    const headers = { Authorization: `Bearer ${ownerToken}` }

    // owner 可以读取相册列表
    const listRes = await request(app.getHttpServer()).get('/albums').set(headers)
    expect(listRes.status).toBe(200)

    // owner 无法创建相册
    const createRes = await request(app.getHttpServer())
      .post('/albums')
      .set(headers)
      .send({ year: 2099 })
    expect(createRes.status).toBe(403)
  })
})
