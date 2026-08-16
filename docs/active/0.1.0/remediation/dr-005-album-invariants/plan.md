# DR-005 相册业务不变量 Plan

**Branch:** codex/dr-005-album-invariants
**Baseline:** main (当前 HEAD)
**Started At:** 2026-07-27

---

## Task 1: 模板约束定义与校验方法

**Depends on:** 无

**Files:**
- Modify: `packages/server/src/album/dto/album.dto.ts`
- Modify: `packages/server/src/album/album.service.ts`
- Modify: `packages/server/src/album/__tests__/album.controller.test.ts`

**Acceptance Criteria:**
- [x] AC1: `TEMPLATE_CONSTRAINTS` 常量定义 5 种模板的 imageCount 和 textRequired
- [x] AC2: `validatePageContent` 方法校验图片数量和文字要求
- [x] AC3: 图片数量不匹配时返回 400，消息明确指出模板、要求数量、实际数量
- [x] AC4: photo-text 缺少文字时返回 400
- [x] AC5: 各模板正向/负向测试用例通过

**Execution:**
- **Status:** done
- **Commit SHA:** 未提交（保留在工作区，等待拆分提交决策）

### Red
```typescript
// album.controller.test.ts 新增
describe('模板图片数量校验', () => {
  it('single 模板需要 1 张图片，传 0 张返回 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [] }, order: 1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('single 模板需要 1 张图片')
  })

  it('single 模板传 1 张图片返回 201', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/t1.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt1] }, order: 1 })
    expect(res.status).toBe(201)
  })

  it('double-h 模板需要 2 张图片，传 1 张返回 400', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/t2.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { imageReceipts: [receipt1] }, order: 1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('double-h 模板需要 2 张图片')
  })

  it('triple 模板传 3 张图片返回 201', async () => {
    const r1 = await createAlbumReceipt('photos/album/t3a.webp')
    const r2 = await createAlbumReceipt('photos/album/t3b.webp')
    const r3 = await createAlbumReceipt('photos/album/t3c.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'triple', content: { imageReceipts: [r1, r2, r3] }, order: 1 })
    expect(res.status).toBe(201)
  })

  it('创建时 imageReceipts 含 null 返回 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [null] }, order: 1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('创建页面时图片不能为空')
  })

  it('更新时修改模板必须提供 imageReceipts', async () => {
    // 先创建 single 页面
    const receipt = await createAlbumReceipt('photos/album/u1.webp')
    const createRes = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt] }, order: 1 })
    const pageId = createRes.body.id

    // 只传 templateId 不传 content
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('修改模板时必须提供图片')
  })

  it('更新时只传 content 不改 templateId 成功', async () => {
    // 先创建 double-h 页面
    const r1 = await createAlbumReceipt('photos/album/u2a.webp')
    const r2 = await createAlbumReceipt('photos/album/u2b.webp')
    const createRes = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'double-h', content: { imageReceipts: [r1, r2] }, order: 1 })
    const pageId = createRes.body.id

    // 只传 content，第二张用 null 保留
    const r3 = await createAlbumReceipt('photos/album/u2c.webp')
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { imageReceipts: [r3, null] } })
    expect(res.status).toBe(200)
  })

  it('更新时 null 保留原图但原图不存在返回 400', async () => {
    // 直接在 DB 创建一个图片为空的页面
    const album = await prisma.album.create({ data: { year: Date.now() } })
    const page = await prisma.page.create({
      data: { albumId: album.id, order: 1, templateId: 'double-h', content: '{"images":["media://photos/album/exist.webp",""]}' },
    })

    // 尝试用 null 保留不存在的第二张图
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${page.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { imageReceipts: [null, null] } })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('原图不存在')
  })
})

describe('photo-text 文字必填', () => {
  it('photo-text 缺少 text 返回 400', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/pt1.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt1] }, order: 1 })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('photo-text 模板需要填写文字')
  })

  it('photo-text 空白 text 返回 400', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/pt2.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt1], text: '   ' }, order: 1 })
    expect(res.status).toBe(400)
  })

  it('photo-text 有效 text 返回 201', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/pt3.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt1], text: '有效文字' }, order: 1 })
    expect(res.status).toBe(201)
  })

  it('non-photo-text 模板 text 可选', async () => {
    const receipt1 = await createAlbumReceipt('photos/album/pt4.webp')
    const res = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt1] }, order: 1 })
    expect(res.status).toBe(201)
  })

  it('photo-text 只更新 text 不传 imageReceipts 成功', async () => {
    // 先创建 photo-text 页面
    const receipt = await createAlbumReceipt('photos/album/pt5.webp')
    const createRes = await request(app.getHttpServer())
      .post(`/api/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'photo-text', content: { imageReceipts: [receipt], text: '原文字' }, order: 1 })
    const pageId = createRes.body.id

    // 只更新 text
    const res = await request(app.getHttpServer())
      .put(`/api/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: { text: '新文字' } })
    expect(res.status).toBe(200)
  })
})
```

### Green
1. 在 `album.dto.ts` 添加 `TEMPLATE_CONSTRAINTS` 常量
2. 在 `album.service.ts` 添加 `validatePageContent` 私有方法
3. 在 `createPage` 和 `updatePage` 开头调用校验方法

### Verify
```bash
pnpm --filter @secret-space/server test -- --testPathPattern album
```

### Commit
```
feat(album): 添加模板图片数量和文字校验

- TEMPLATE_CONSTRAINTS 定义 5 种模板约束
- validatePageContent 校验图片数量和文字要求
- createPage/updatePage 写入前校验
```

---

## Task 2: order 自动分配

**Depends on:** T1

**Files:**
- Modify: `packages/server/src/album/dto/album.dto.ts`
- Modify: `packages/server/src/album/album.service.ts`
- Modify: `packages/server/src/album/__tests__/album.controller.test.ts`

**Acceptance Criteria:**
- [x] AC1: `CreatePageDto.order` 改为可选
- [x] AC2: 未提供 order 时自动分配 max(existing) + 1
- [x] AC3: 空相册首页 order = 1
- [x] AC4: 提供 order 时使用指定值
- [x] AC5: 测试覆盖自动分配场景

**Execution:**
- **Status:** done
- **Commit SHA:** 未提交（保留在工作区，等待拆分提交决策）

### Red
```typescript
describe('order 自动分配', () => {
  it('空相册创建页面 order 自动为 1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/albums/${emptyAlbumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt1] } })
    expect(res.status).toBe(201)
    expect(res.body.order).toBe(1)
  })

  it('已有页面时自动递增 order', async () => {
    // 已有 order=1,2 的页面
    const res = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt1] } })
    expect(res.status).toBe(201)
    expect(res.body.order).toBe(3)
  })

  it('指定 order 时使用指定值', async () => {
    const res = await request(app.getHttpServer())
      .post(`/albums/${albumId}/pages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ templateId: 'single', content: { imageReceipts: [receipt1] }, order: 10 })
    expect(res.status).toBe(201)
    expect(res.body.order).toBe(10)
  })
})
```

### Green
1. `CreatePageDto.order` 加 `@IsOptional()`
2. `createPage` 中：若 `dto.order` 未定义，查询当前最大 order 并 +1

### Verify
```bash
pnpm --filter @secret-space/server test -- --testPathPattern album
```

### Commit
```
feat(album): order 自动分配

- CreatePageDto.order 改为可选
- 未提供时自动分配 max(existing) + 1
```

---

## Task 3: 并发安全测试

**Depends on:** T2

**Files:**
- Modify: `packages/server/src/album/__tests__/album.controller.test.ts`

**Acceptance Criteria:**
- [x] AC1: 并发创建相同年份相册，一个 201 一个 409
- [x] AC2: 并发删除同一相册，一个 204 一个 404
- [x] AC3: 测试使用 `Promise.allSettled` 验证并发行为（实现采用 `Promise.all`，并发语义等价且失败显式抛出，偏离记录见 worklog）

**Execution:**
- **Status:** done
- **Commit SHA:** 未提交（保留在工作区，等待拆分提交决策）

### Red
```typescript
describe('并发安全', () => {
  it('并发创建相同年份相册', async () => {
    const year = Date.now() // 唯一年份
    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post('/albums')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year, title: 'A' }),
      request(app.getHttpServer())
        .post('/albums')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year, title: 'B' }),
    ])
    const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : 500)
    expect(statuses).toContain(201)
    expect(statuses).toContain(409)
  })

  it('并发删除同一相册', async () => {
    // 先创建一个相册
    const createRes = await request(app.getHttpServer())
      .post('/albums')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: Date.now(), title: 'to-delete' })
    const albumId = createRes.body.id

    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .delete(`/albums/${albumId}`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app.getHttpServer())
        .delete(`/albums/${albumId}`)
        .set('Authorization', `Bearer ${adminToken}`),
    ])
    const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : 500)
    expect(statuses.sort()).toEqual([204, 404])
  })
})
```

### Green
当前实现依赖 SQLite 事务隔离 + unique 约束，应已满足。若测试失败则调整。

### Verify
```bash
pnpm --filter @secret-space/server test -- --testPathPattern album
```

### Commit
```
test(album): 添加并发安全测试

- 并发创建相同年份相册
- 并发删除同一相册
```

---

## Task 4: 现有测试修正与回归验证

**Depends on:** T3

**Files:**
- Modify: `packages/server/src/album/__tests__/album.controller.test.ts`
- Modify: `packages/server/src/__tests__/album-flow.e2e.test.ts`

**Acceptance Criteria:**
- [x] AC1: 现有测试数据符合模板约束（图片数量正确）
- [x] AC2: 全仓测试通过 (`pnpm test`)
- [x] AC3: 全仓构建通过 (`pnpm build`)

**Execution:**
- **Status:** done
- **Commit SHA:** 未提交（保留在工作区，等待拆分提交决策）

### Red
运行 `pnpm test`，检查因新增校验导致的失败。

### Green
1. 检查所有 `createPage` 调用，确保 imageReceipts 数量匹配模板
2. 检查 photo-text 模板是否提供 text
3. 修正不符合的测试数据

### Verify
```bash
pnpm test && pnpm build
```

### Commit
```
test(album): 修正测试数据符合模板约束

- 调整 imageReceipts 数量匹配各模板要求
- photo-text 模板添加 text 字段
```

---

## 完成标准核对

| 标准 | Task |
|------|------|
| 服务端校验模板图片数量 | T1 |
| 服务端校验文字要求 | T1 |
| 服务端校验顺序 | T2 (order 自动分配) |
| 异常路径测试通过 | T1, T2 |
| 并发路径测试通过 | T3 |
| 回归测试通过 | T4 |
