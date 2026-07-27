# P0～P2 实际状态快照

> 建立日期：2026-07-27
> 目的：记录旧 Plan 与实际实现的对照，不修改旧 Plan 文档
> 约定：后续状态只维护于 tracker.md，本快照为历史存档

## 汇总

| Plan | 任务数 | 已实现 | 部分实现 | 偏离项数 |
|------|--------|--------|----------|----------|
| P0 Engineering Base | 7 | 5 | 2 | 6 |
| P1 Map & Photos | 6 | 5 | 1 | 3 |
| P2 Album | 5 | 3 | 2 | 4 |
| **总计** | **18** | **13** | **5** | **13** |

**说明**：
- 已实现：所有预期文件存在且功能符合 Plan
- 部分实现：核心功能存在但缺少部分预期文件（组件/测试）
- 偏离项：实现方式与 Plan 不同（重构、合并、省略）

---

## P0: Engineering Base

### T1: Monorepo 搭建

**Plan 状态**: done (Commit: 0b81a0b)
**实际状态**: ✅ 已实现

**预期文件 (20/20)**:
- ✓ `pnpm-workspace.yaml`
- ✓ `package.json` (root)
- ✓ `.npmrc`
- ✓ `packages/shared/package.json`
- ✓ `packages/shared/src/index.ts`
- ✓ `packages/shared/tsconfig.json`
- ✓ `packages/client/package.json`
- ✓ `packages/client/vite.config.ts`
- ✓ `packages/client/tsconfig.json`
- ✓ `packages/client/index.html`
- ✓ `packages/client/src/main.ts`
- ✓ `packages/client/src/App.vue`
- ✓ `packages/server/package.json`
- ✓ `packages/server/tsconfig.json`
- ✓ `packages/server/src/main.ts`
- ✓ `tsconfig.base.json`
- ✓ `.eslintrc.cjs`
- ✓ `.prettierrc`
- ✓ `.gitignore`
- ✓ `packages/shared/src/__tests__/index.test.ts`

**偏离项**: 无

---

### T2: PixiJS 场景基座

**Plan 状态**: done (Commit: 75d7e4f)
**实际状态**: ✅ 已实现

**预期文件 (6/6)**:
- ✓ `packages/client/src/pixi/SceneManager.ts`
- ✓ `packages/client/src/pixi/zones.ts`
- ✓ `packages/client/src/pixi/cursor.ts`
- ✓ `packages/client/src/stores/scene.ts`
- ✓ `packages/client/src/bus.ts`
- ✓ `packages/client/src/pixi/__tests__/SceneManager.test.ts`

**偏离项**: 无

---

### T3: Camera 系统

**Plan 状态**: done (Commit: df92080)
**实际状态**: ⚠️ 部分实现

**预期文件 (2/4)**:
- ✓ `packages/client/src/pixi/CameraController.ts`
- ✗ `packages/client/src/components/SwipeNav.vue` — **缺失**
- ✗ `packages/client/src/components/BackButton.vue` — **缺失**
- ✓ `packages/client/src/pixi/__tests__/CameraController.test.ts`

**偏离项**:
1. **P0-GAP-002**: SwipeNav.vue 和 BackButton.vue 未实现，竖屏 Camera 未接入手势和导航

---

### T4: 音频系统

**Plan 状态**: done (Commit: 5a610c2)
**实际状态**: ✅ 已实现

**预期文件 (2/2)**:
- ✓ `packages/client/src/audio/AudioManager.ts`
- ✓ `packages/client/src/audio/__tests__/AudioManager.test.ts`

**偏离项**: 无

---

### T5: NestJS 后端基座

**Plan 状态**: done (Commit: fb68335)
**实际状态**: ✅ 已实现

**预期文件 (9/9)**:
- ✓ `packages/server/src/app.module.ts`
- ✓ `packages/server/src/main.ts`
- ✓ `packages/server/prisma/schema.prisma`
- ✓ `packages/server/nest-cli.json`
- ✓ `packages/server/src/tips/tips.module.ts`
- ✓ `packages/server/src/tips/tips.controller.ts`
- ✓ `packages/server/src/tips/tips.service.ts`
- ✓ `packages/server/src/__tests__/app.e2e.test.ts`
- ✓ `packages/server/src/tips/__tests__/tips.controller.test.ts`

**偏离项**: 无

---

### T6: 密码认证 API

**Plan 状态**: done (Commit: b14313e)
**实际状态**: ✅ 已实现

**预期文件 (6/6)**:
- ✓ `packages/server/src/auth/auth.module.ts`
- ✓ `packages/server/src/auth/auth.controller.ts`
- ✓ `packages/server/src/auth/auth.service.ts`
- ✓ `packages/server/src/auth/rate-limit.guard.ts`
- ✓ `packages/server/src/auth/dto/verify.dto.ts`
- ✓ `packages/server/src/auth/__tests__/auth.controller.test.ts`

**偏离项**: 无

**DR-003 后续演进**: 认证模块在 DR-003 中扩展了 Session 机制（HttpOnly Cookie + 服务端 Session 表）

---

### T7: 入口流程集成

**Plan 状态**: done (Commit: 2b593e4)
**实际状态**: ⚠️ 部分实现

**预期文件 (4/9)**:
- ✓ `packages/client/src/views/PasswordPage.vue`
- ✓ `packages/client/src/views/LoadingPage.vue`
- ✓ `packages/client/src/views/ScenePage.vue`
- ✓ `packages/client/src/stores/auth.ts`
- ✗ `packages/client/src/composables/useAuth.ts` — **缺失**（逻辑合并到 store）
- ✗ `packages/client/src/pixi/LoadingOrchestrator.ts` — **缺失**
- ✓ `packages/client/src/stores/__tests__/auth.test.ts`
- ✗ `packages/client/src/views/__tests__/PasswordPage.test.ts` — **缺失**
- ✗ `packages/client/src/pixi/__tests__/LoadingOrchestrator.test.ts` — **缺失**

**偏离项**:
1. **P0-GAP-001**: LoadingOrchestrator 未实现，加载页仍使用随机进度模拟
2. useAuth composable 被省略，逻辑合并到 auth store
3. PasswordPage.test.ts 和 LoadingOrchestrator.test.ts 测试缺失

---

## P1: Map & Photos

### T1: Prisma Schema + Province/Photo API

**Plan 状态**: done (Commit: 50bb156)
**实际状态**: ⚠️ 部分实现

**预期文件 (8/9)**:
- ✓ `packages/server/prisma/seed.ts`
- ✓ `packages/server/src/province/province.module.ts`
- ✓ `packages/server/src/province/province.controller.ts`
- ✓ `packages/server/src/province/province.service.ts`
- ✓ `packages/server/src/photo/photo.module.ts`
- ✓ `packages/server/src/photo/photo.controller.ts`
- ✓ `packages/server/src/photo/photo.service.ts`
- ✓ `packages/server/src/province/__tests__/province.controller.test.ts`
- ✗ `packages/server/src/photo/__tests__/photo.controller.test.ts` — **缺失**

**偏离项**:
1. photo.controller.test.ts 公开读取测试缺失（photo-admin.controller.test.ts 只测管理接口）

---

### T2: Roles Guard + Admin 认证扩展

**Plan 状态**: done
**实际状态**: ✅ 已实现

**预期文件 (3/3)**:
- ✓ `packages/server/src/auth/roles.guard.ts`
- ✓ `packages/server/src/auth/roles.decorator.ts`
- ✓ `packages/server/src/auth/__tests__/roles.guard.test.ts`

**偏离项**: 无

**DR-003 后续演进**: RolesGuard 被拆分为 SessionGuard（认证）+ RolesGuard（授权）双 Guard 模式

---

### T3: R2 Service + Presigned URL + Photo CRUD API

**Plan 状态**: done
**实际状态**: ✅ 已实现（重构）

**预期文件**: 
- ✗ `packages/server/src/r2/r2.module.ts` — **重构为 media 模块**
- ✗ `packages/server/src/r2/r2.service.ts` — **重构为 media/r2-media-storage.ts**
- ✓ `packages/server/src/photo/__tests__/photo-admin.controller.test.ts`

**偏离项**:
1. **DR-001 重构**: r2 模块被重构为 media 模块，`r2.service.ts` 被重构为 `MediaStorage` 接口 + `R2MediaStorage` 实现

**实际文件**:
- `packages/server/src/media/media.module.ts`
- `packages/server/src/media/media-storage.ts`（接口）
- `packages/server/src/media/r2-media-storage.ts`（R2 实现）
- `packages/server/src/media/media.controller.ts`
- `packages/server/src/media/media-deletion.service.ts`（DR-002）
- `packages/server/src/media/media-reference.service.ts`
- `packages/server/src/media/media-upload-receipt.service.ts`

---

### T4: 地图 SVG 资源准备 + MapOverlay 组件

**Plan 状态**: done
**实际状态**: ✅ 已实现

**预期文件 (4/4)**:
- ✓ `packages/client/src/assets/china-map.svg`
- ✓ `packages/client/src/components/MapOverlay.vue`
- ✓ `packages/client/src/stores/map.ts`
- ✓ `packages/client/src/stores/__tests__/map.test.ts`

**偏离项**: 无

---

### T5: PhotoPanel 瀑布流组件

**Plan 状态**: done
**实际状态**: ✅ 已实现

**预期文件 (2/2)**:
- ✓ `packages/client/src/components/PhotoPanel.vue`
- ✓ `packages/client/src/components/__tests__/PhotoPanel.test.ts`

**偏离项**: 无

**P1-GAP-002**: PhotoPanel 缺少 loading/error/empty 状态、省份标题、PC hover 与移动端长按标注

---

### T6: 管理后台搭建

**Plan 状态**: done
**实际状态**: ✅ 已实现

**预期文件 (11/11)**:
- ✓ `packages/admin/package.json`
- ✓ `packages/admin/vite.config.ts`
- ✓ `packages/admin/index.html`
- ✓ `packages/admin/src/main.ts`
- ✓ `packages/admin/src/App.vue`
- ✓ `packages/admin/src/router/index.ts`
- ✓ `packages/admin/src/stores/auth.ts`
- ✓ `packages/admin/src/views/LoginPage.vue`
- ✓ `packages/admin/src/views/ProvinceList.vue`
- ✓ `packages/admin/src/views/PhotoManage.vue`
- ✓ `packages/admin/src/stores/__tests__/auth.test.ts`

**偏离项**: 无

**DR-003 后续演进**: auth store 被重写为 Cookie 模式（移除 localStorage）

---

## P2: Album

### T1: Album/Page Schema + CRUD API

**Plan 状态**: pending（Plan 中标记）
**实际状态**: ✅ 已实现

**预期文件 (5/6)**:
- ✓ `packages/server/src/album/album.module.ts`
- ✓ `packages/server/src/album/album.controller.ts`
- ✓ `packages/server/src/album/album.service.ts`
- ✓ `packages/server/src/album/dto/album.dto.ts`
- ✗ `packages/server/src/album/dto/page.dto.ts` — **合并到 album.dto.ts**
- ✓ `packages/server/src/album/__tests__/album.controller.test.ts`

**偏离项**:
1. Page DTO 合并到 album.dto.ts 而非独立文件
2. Plan 状态为 pending 但实际已实现

---

### T2: 管理后台相册管理

**Plan 状态**: pending（Plan 中标记）
**实际状态**: ⚠️ 部分实现

**预期文件 (3/6)**:
- ✓ `packages/admin/src/views/AlbumList.vue`
- ✓ `packages/admin/src/views/PageEditor.vue`
- ✗ `packages/admin/src/components/TemplateSelector.vue` — **缺失**（内联到 PageEditor）
- ✗ `packages/admin/src/components/ImageUploader.vue` — **缺失**（内联到 PageEditor）
- ✓ `packages/admin/src/utils/compress.ts`
- ✗ `packages/admin/src/utils/__tests__/compress.test.ts` — **缺失**

**偏离项**:
1. TemplateSelector 和 ImageUploader 内联到 PageEditor.vue 而非独立组件
2. compress.ts 测试缺失

**额外实现**:
- `packages/admin/src/components/AlbumPreview.vue`（预览功能）

---

### T3: Client 书架交互

**Plan 状态**: pending（Plan 中标记）
**实际状态**: ✅ 已实现

**预期文件 (3/3)**:
- ✓ `packages/client/src/components/BookshelfOverlay.vue`
- ✓ `packages/client/src/stores/album.ts`
- ✓ `packages/client/src/stores/__tests__/album.test.ts`

**偏离项**: 无

---

### T4: Client 翻页视图

**Plan 状态**: pending（Plan 中标记）
**实际状态**: ✅ 已实现

**预期文件 (9/9)**:
- ✓ `packages/client/src/components/AlbumViewer.vue`
- ✓ `packages/client/src/components/templates/SingleTemplate.vue`
- ✓ `packages/client/src/components/templates/DoubleHTemplate.vue`
- ✓ `packages/client/src/components/templates/DoubleVTemplate.vue`
- ✓ `packages/client/src/components/templates/TripleTemplate.vue`
- ✓ `packages/client/src/components/templates/PhotoTextTemplate.vue`
- ✓ `packages/client/src/components/templates/CoverPage.vue`
- ✓ `packages/client/src/components/templates/BackCoverPage.vue`
- ✓ `packages/client/src/components/__tests__/AlbumViewer.test.ts`

**偏离项**: 无

**P2-GAP-001/002**: PageFlip 响应式和懒加载偏离约定（tracker 已追踪）

---

### T5: 联调与收尾

**Plan 状态**: pending（Plan 中标记）
**实际状态**: ⚠️ 部分实现

**预期**: 完整流程串联 + Admin 预览

**实际**:
- ✓ 书架 → 书脊点击 → 加载 pages → 翻页视图 流程可用
- ✓ Admin AlbumPreview 组件实现
- ⚠️ E2E/NFR 验证不完整（P1-GAP-003 追踪）

**偏离项**:
1. Plan 状态为 pending 但实际已有基本流程

---

## 偏离项汇总

### 代码架构偏离

| 偏离 | 原 Plan | 实际实现 | 原因 |
|------|---------|----------|------|
| R2 模块重构 | `r2/r2.service.ts` | `media/r2-media-storage.ts` | DR-001 抽象为 MediaStorage 接口 |
| Page DTO 合并 | `album/dto/page.dto.ts` | 合并到 `album.dto.ts` | 简化文件结构 |
| 组件内联 | TemplateSelector/ImageUploader 独立 | 内联到 PageEditor | 减少组件碎片化 |
| useAuth 省略 | `composables/useAuth.ts` | 逻辑在 auth store | 避免重复抽象 |

### 缺失文件

| 文件 | Plan 任务 | 影响 | 追踪 ID |
|------|-----------|------|---------|
| SwipeNav.vue | P0-T3 | 竖屏导航不可用 | P0-GAP-002 |
| BackButton.vue | P0-T3 | 返回按钮缺失 | P0-GAP-002 |
| LoadingOrchestrator.ts | P0-T7 | 进度模拟非真实 | P0-GAP-001 |
| PasswordPage.test.ts | P0-T7 | 测试覆盖不足 | - |
| LoadingOrchestrator.test.ts | P0-T7 | 测试覆盖不足 | - |
| photo.controller.test.ts | P1-T1 | 公开接口测试缺失 | - |
| compress.test.ts | P2-T2 | 工具测试缺失 | - |

### Plan 状态失真

P2 所有任务在 Plan 中标记为 `pending`，但实际均已实现。这是 DR-004 要解决的核心问题——Plan 状态与实际不同步。

---

## 验收结果

### 构建验证
```bash
pnpm build  # 退出码 0，全部构建成功
```

### 测试验证
```bash
pnpm test   # 退出码 0，257/257 通过
```

### 核心功能验证

| 功能 | 状态 | 证据 |
|------|------|------|
| Monorepo 结构 | ✓ | pnpm-workspace.yaml 定义 4 包 |
| PixiJS 场景 | ✓ | SceneManager.ts + 测试通过 |
| Camera 系统 | ⚠️ | 横屏可用，竖屏导航缺失 |
| 音频系统 | ✓ | AudioManager.ts + 测试通过 |
| NestJS 后端 | ✓ | app.e2e.test.ts 通过 |
| 密码认证 | ✓ | auth.controller.test.ts 通过 |
| 省份照片 API | ✓ | province/photo 模块 + 测试通过 |
| 媒体存储 | ✓ | media 模块 + DR-001/002 重构完成 |
| 地图交互 | ✓ | MapOverlay.vue + 测试通过 |
| 管理后台 | ✓ | admin 包 + 测试通过 |
| 相册系统 | ✓ | album 模块 + 前端组件 + 测试通过 |
| Session 认证 | ✓ | DR-003 完成，HttpOnly Cookie |

---

## 后续行动

1. **不修改旧 Plan**：Plan 文件保持原样作为历史记录
2. **状态追踪迁移**：后续状态只维护于 tracker.md 的 GAP 条目
3. **缺失文件处理**：
   - P0-GAP-001/002 已在 tracker 追踪
   - 测试缺失项可视优先级补充或接受为技术债务
