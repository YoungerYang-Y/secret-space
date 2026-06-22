# P1 地图与照片 Implementation Plan

- **Branch:** feat/p1-map-photos
- **Baseline SHA:** c87254569119a73ae908c6fb37b43df3b23dc099
- **Worktree Path:** [待填充]
- **Started At:** [待填充]
- **Updated At:** [待填充]
- **Goal:** 实现墙面中国地图交互 + 照片瀑布流浏览 + 管理后台上传管理
- **Architecture:** NestJS 后端新增 Province/Photo 模块 + R2 presign 服务；前端 DOM 层叠 SVG 地图 + 照片面板组件；独立 admin 包通过 Element Plus 实现管理后台。
- **Tech Stack:** NestJS, Prisma (SQLite), Cloudflare R2 (@aws-sdk/client-s3), Vue 3, Pinia, Vite, Element Plus, SVG DOM overlay

---

## Dependency Graph

```
T1 --> T2
T1 --> T3
T1 --> T4
T1 --> T5
T2 --> T6
T3 --> T6
T4 --> T5
```

可并行组：
- A: T1
- B: T2, T3, T4（依赖 T1，互不依赖）
- C: T5（依赖 T4）
- D: T6（依赖 T2, T3）

---

## Tasks

### Task 1: Prisma Schema + Province/Photo API

**Depends on:** 无

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Create: `packages/server/prisma/seed.ts`
- Create: `packages/server/src/province/province.module.ts`
- Create: `packages/server/src/province/province.controller.ts`
- Create: `packages/server/src/province/province.service.ts`
- Create: `packages/server/src/photo/photo.module.ts`
- Create: `packages/server/src/photo/photo.controller.ts`
- Create: `packages/server/src/photo/photo.service.ts`
- Modify: `packages/server/src/app.module.ts`
- Test: `packages/server/src/province/__tests__/province.controller.test.ts`
- Test: `packages/server/src/photo/__tests__/photo.controller.test.ts`

**Behavior:**
新增 Province 和 Photo 模型，seed 硬编码 34 省数据。Province API 提供 GET /provinces（公开）和 PUT /provinces/:code（admin）。Photo API 提供 GET /provinces/:code/photos（公开）。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// province.controller.test.ts
it('GET /provinces 返回 34 个省份', async () => {
  const res = await request(app.getHttpServer()).get('/provinces')
  expect(res.status).toBe(200)
  expect(res.body).toHaveLength(34)
  expect(res.body[0]).toHaveProperty('code')
  expect(res.body[0]).toHaveProperty('visited')
  expect(res.body[0]).toHaveProperty('photoCount')
})

it('GET /provinces/:code/photos 返回照片列表按 order 升序', async () => {
  const res = await request(app.getHttpServer()).get('/provinces/hunan/photos')
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body)).toBe(true)
})

it('GET /provinces/invalid/photos 返回 404', async () => {
  const res = await request(app.getHttpServer()).get('/provinces/invalid/photos')
  expect(res.status).toBe(404)
})
```

- [ ] **Step 2: Implement**
  - schema.prisma: 新增 Province + Photo 模型
  - seed.ts: 硬编码 34 省（hunan/guangxi/hebei/guangdong visited=true）
  - ProvinceService: findAll（含 photoCount）、findByCode、update
  - PhotoService: findByProvince
  - ProvinceController: GET /provinces, GET /provinces/:code/photos
  - 注册到 AppModule

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/server test`
Expected: 所有省份相关测试通过

- [ ] **Step 4: Commit**
`feat(server): 新增 Province/Photo 模型与公开查询 API`

---

### Task 2: Roles Guard + Admin 认证扩展

**Depends on:** T1

**Files:**
- Create: `packages/server/src/auth/roles.guard.ts`
- Create: `packages/server/src/auth/roles.decorator.ts`
- Modify: `packages/server/src/auth/auth.service.ts`
- Test: `packages/server/src/auth/__tests__/roles.guard.test.ts`

**Behavior:**
AuthService.verify 新增 admin 角色检查。RolesGuard 从 JWT 提取 role 并校验 @Roles('admin') 装饰器，非 admin 返回 403。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// roles.guard.test.ts
it('admin role 放行', () => {
  // JWT payload { role: 'admin' } → canActivate returns true
})
it('owner role 拒绝管理 API', () => {
  // JWT payload { role: 'owner' } → throws ForbiddenException
})
it('未认证请求拒绝', () => {
  // 无 Authorization header → throws ForbiddenException
})
```

- [ ] **Step 2: Implement**
  - roles.decorator.ts: `@Roles(...roles)` 自定义装饰器
  - roles.guard.ts: 解析 JWT → 提取 role → 对比 Reflector 中的 roles
  - auth.service.ts: verify 中新增 admin_password_hash 检查（优先级：owner → visitor → admin）

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/server test`
Expected: RolesGuard 单元测试通过

- [ ] **Step 4: Commit**
`feat(auth): 新增 RolesGuard 与 admin 角色认证`

---

### Task 3: R2 Service + Presigned URL + Photo CRUD API

**Depends on:** T1

**Files:**
- Create: `packages/server/src/r2/r2.module.ts`
- Create: `packages/server/src/r2/r2.service.ts`
- Modify: `packages/server/src/photo/photo.controller.ts`
- Modify: `packages/server/src/photo/photo.service.ts`
- Modify: `packages/server/src/app.module.ts`
- Test: `packages/server/src/photo/__tests__/photo-admin.controller.test.ts`

**Behavior:**
R2Service 封装 @aws-sdk/client-s3 的 presign 和 delete 操作。Photo 管理 API（POST /photos/presign, POST /photos, PUT /photos/reorder, PUT /photos/:id, DELETE /photos/:id）需 admin 角色。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// photo-admin.controller.test.ts
it('POST /photos/presign 返回 uploadUrl 和 key', async () => {
  const res = await request(app.getHttpServer())
    .post('/photos/presign')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ provinceCode: 'hunan', filename: 'test.webp', contentType: 'image/webp' })
  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('uploadUrl')
  expect(res.body).toHaveProperty('key')
})

it('POST /photos 创建照片记录', async () => {
  const res = await request(app.getHttpServer())
    .post('/photos')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ provinceCode: 'hunan', url: 'https://r2.example.com/photos/hunan/test.webp', order: 1 })
  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('id')
})

it('DELETE /photos/:id 非 admin 返回 403', async () => {
  const res = await request(app.getHttpServer())
    .delete('/photos/1')
    .set('Authorization', `Bearer ${visitorToken}`)
  expect(res.status).toBe(403)
})
```

- [ ] **Step 2: Implement**
  - r2.service.ts: presign(key, contentType) → uploadUrl; delete(key); 环境变量注入 R2_*
  - photo.controller.ts: 新增 presign/create/reorder/update/delete 端点，@Roles('admin') + @UseGuards(RolesGuard)
  - photo.service.ts: create/reorder/update/delete 逻辑

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/server test`
Expected: Photo admin API 测试通过

- [ ] **Step 4: Commit**
`feat(server): R2 presign 服务与照片管理 CRUD API`

---

### Task 4: 地图 SVG 资源准备 + MapOverlay 组件

**Depends on:** T1

**Files:**
- Create: `packages/client/src/assets/china-map.svg`
- Create: `packages/client/src/components/MapOverlay.vue`
- Create: `packages/client/src/stores/map.ts`
- Test: `packages/client/src/stores/__tests__/map.test.ts`

**Behavior:**
从 DataV GeoAtlas 获取简化中国地图 SVG 放入 assets。MapOverlay 组件在 Camera zoom-in 墙面时显示，渲染 SVG 地图，已去过省份高亮可点击，未去过省份灰色不可点。mapStore 管理省份列表数据。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// map.test.ts
it('fetchProvinces 填充 state', async () => {
  const store = useMapStore()
  await store.fetchProvinces()
  expect(store.provinces).toHaveLength(34)
})

it('visitedCount 计算正确', () => {
  const store = useMapStore()
  store.provinces = [{ code: 'hunan', name: '湖南', visited: true, photoCount: 3 }]
  expect(store.visitedCount).toBe(1)
})
```

- [ ] **Step 2: Implement**
  - china-map.svg: DataV GeoAtlas 简化版（< 100KB gzipped），每个省份 path 带 data-code 属性
  - mapStore: state(provinces, loading), actions(fetchProvinces), getters(visitedCount)
  - MapOverlay.vue: props(visible, cameraTransform), emit('province-click'), SVG 内联渲染，省份 hover/click 交互

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/client test`
Expected: mapStore 测试通过

- [ ] **Step 4: Commit**
`feat(client): 地图 SVG 资源与 MapOverlay 组件`

---

### Task 5: PhotoPanel 瀑布流组件

**Depends on:** T4

**Files:**
- Create: `packages/client/src/components/PhotoPanel.vue`
- Modify: `packages/client/src/views/ScenePage.vue`
- Test: `packages/client/src/components/__tests__/PhotoPanel.test.ts`

**Behavior:**
PhotoPanel 接收 provinceCode，从 API 加载照片列表，瀑布流布局展示。支持懒加载、标注 hover 显示、空状态提示。面板从省份位置展开动画打开/关闭。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// PhotoPanel.test.ts
it('照片按 order 排列渲染', async () => {
  // mock GET /provinces/hunan/photos 返回 [{id:1,order:2},{id:2,order:1}]
  const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
  await flushPromises()
  const imgs = wrapper.findAll('img')
  expect(imgs).toHaveLength(2)
})

it('空照片显示提示文案', async () => {
  // mock 返回空数组
  const wrapper = mount(PhotoPanel, { props: { provinceCode: 'guangxi', originRect: null } })
  await flushPromises()
  expect(wrapper.text()).toContain('还没有照片')
})
```

- [ ] **Step 2: Implement**
  - PhotoPanel.vue: props(provinceCode, originRect), emit('close'), 瀑布流 CSS grid, IntersectionObserver 懒加载, 标注 tooltip, 展开/收起动画
  - ScenePage.vue: 集成 MapOverlay + PhotoPanel，province-click → PhotoPanel 打开

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/client test`
Expected: PhotoPanel 测试通过

- [ ] **Step 4: Commit**
`feat(client): PhotoPanel 瀑布流照片面板`

---

### Task 6: 管理后台搭建

**Depends on:** T2, T3

**Files:**
- Create: `packages/admin/package.json`
- Create: `packages/admin/vite.config.ts`
- Create: `packages/admin/index.html`
- Create: `packages/admin/src/main.ts`
- Create: `packages/admin/src/App.vue`
- Create: `packages/admin/src/router/index.ts`
- Create: `packages/admin/src/stores/auth.ts`
- Create: `packages/admin/src/views/LoginPage.vue`
- Create: `packages/admin/src/views/ProvinceList.vue`
- Create: `packages/admin/src/views/PhotoManage.vue`
- Modify: `pnpm-workspace.yaml`

**Behavior:**
独立 admin 包，Vue 3 + Vite + Element Plus + Pinia。登录页验证 admin 密码获取 JWT。省份管理页展示 34 省可切换 visited。照片管理页支持 presign 直传 R2 + 拖拽排序 + 标注编辑 + 删除。

**Execution:**
- **Status:** pending
- **Commit SHA:** null
- **Attempts:** 0
- **Blocked Reason:** null

- [ ] **Step 1: Write failing test**
```typescript
// admin/src/stores/__tests__/auth.test.ts
it('login 成功存储 token', async () => {
  // mock POST /auth/verify → { token, role: 'admin' }
  const store = useAdminAuthStore()
  await store.login('admin-password')
  expect(store.token).toBeTruthy()
  expect(store.isAuthenticated).toBe(true)
})
```

- [ ] **Step 2: Implement**
  - package.json: @secret-space/admin, 依赖 vue/vite/element-plus/pinia/vue-router/axios
  - 路由: /login, /provinces, /provinces/:code/photos
  - LoginPage: El-Form 输入密码 → POST /auth/verify → 存 token → 跳转
  - ProvinceList: El-Table 展示省份 + El-Switch 切换 visited
  - PhotoManage: El-Upload presign 直传 + 照片列表 + 拖拽排序(vuedraggable) + 标注编辑 + 删除

- [ ] **Step 3: Verify**
Run: `pnpm --filter @secret-space/admin build`
Expected: 构建成功无报错

- [ ] **Step 4: Commit**
`feat(admin): 管理后台省份管理与照片上传`
