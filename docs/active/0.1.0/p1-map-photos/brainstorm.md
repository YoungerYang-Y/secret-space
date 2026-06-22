# P1 地图与照片 — 头脑风暴

> 创建时间：2026-06-22
> 状态：设计共识已达成，待正式文档化

## 背景

P0 工程基座完成后，P1 是 MVP 交付点。目标：进入房间 → zoom-in 墙面 → 交互地图 → 看照片。

## 设计共识

### 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 对象存储 | Cloudflare R2 | 免费额度大，S3 兼容，配合 CF CDN |
| 管理后台 | `packages/admin` + Element Plus | 需要照片上传和省份管理 |
| 地图资源 | DataV GeoAtlas 导出 + 简化 34 省 SVG | 免费、省界准确 |
| 照片资源 | 真实照片（用户提供） | 体验真实 |

### 测试数据

已去过省份（4/34）：湖南、广西、河北、广东

每省 2-3 张照片，用户后续提供。

## 需求摘要（sdd-ready）

### 目标

在果果的房间墙面区域实现中国地图交互 + 省份照片浏览，配合管理后台进行内容管理。

### 用户故事

- As a 访客, I want 看到中国地图上哪些省份被点亮, so that 了解果果去过哪些地方
- As a 访客, I want 点击已点亮的省份查看照片, so that 看到果果在那里的回忆
- As a 管理员, I want 在后台标记省份并上传照片, so that 维护地图数据
- As a 管理员, I want 给照片添加标注, so that 照片有故事说明

### 验收标准

- [ ] AC1: 墙面区域 zoom-in 后显示中国地图 SVG，已去过省份高亮显示
- [ ] AC2: hover 省份时浮出省份名，已去过的有视觉区分
- [ ] AC3: 点击已去过省份弹出照片瀑布流面板
- [ ] AC4: 照片 hover 时显示标注文字（小纸条样式）
- [ ] AC5: 地图显示收集进度 "已点亮 X/34"
- [ ] AC6: 管理后台可登录、标记省份已去过、上传照片到 R2、编辑标注
- [ ] AC7: 照片从 Cloudflare R2 加载，支持 WebP 格式
- [ ] AC8: 关闭照片面板后回到地图视图，无闪烁

### 非功能需求

- 照片懒加载，瀑布流面板打开后 1s 内首屏照片可见
- 地图 SVG 文件 ≤ 100KB（gzipped）
- 管理后台兼容 Chrome 90+

### 已确认的技术决策

- 对象存储：Cloudflare R2（S3 兼容 API）
- 管理后台：packages/admin，Vue 3 + Element Plus
- 地图渲染：SVG DOM 层覆盖在 Canvas 上，响应式跟随 Camera 缩放
- 照片格式：WebP，原图上传后服务端不做转换（上传时由管理员确保格式）
- 数据模型：Province（name, code, visited）+ Photo（provinceCode, url, annotation, order）

### 不做的事（Scope Out）

- 全家福墙、身高尺、日历等其他墙面功能
- 照片 AI 自动归类/识别
- CDN 缓存策略配置（部署阶段）
- 照片裁剪/编辑功能
- 移动端管理后台适配

### 下一步

→ 使用 sdd skill 将本摘要正式化为 spec.md / design.md / plan.md

## Decisions

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| R2 上传路径 | 前端直传(Presigned URL) / 经 server 代理 / 本地+异步同步 | 前端直传 | server 不经手文件流，无内存压力 |
| SVG 与 Camera 同步 | CSS transform 跟随 / PixiJS 内渲染 / 纯 DOM 切换 | CSS transform 跟随 Camera state | hover/click 天然可用，文字清晰不模糊 |
| 管理后台认证 | 复用 auth + admin role / 独立 admin 认证模块 | 复用 auth/verify + role=admin + 强密码 | 单人使用，简单方案足够 |
| 照片面板渲染 | Vue DOM 全屏覆盖 / 侧滑半屏 | Vue DOM 全屏面板覆盖 Canvas | 懒加载/滚动/hover 标注最自然 |
| 34 省数据初始化 | Prisma seed 硬编码 / 管理后台动态创建 | Prisma seed 硬编码 | 固定数据，一次写入永久可用 |

## Decisions (Round 2)

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| 未去过省份点击 | 无反应 / toast 提示 / 锁定空面板 | 无反应，不可点击 | 简单明确 |
| 照片排序 | 上传时间倒序 / 手动 order 拖拽 / EXIF 时间 | 手动排序（order + 后台拖拽） | 完全控制展示顺序 |
| R2 key 命名 | `photos/{provinceCode}/{uuid}.webp` / `photos/{uuid}.webp` | `photos/{provinceCode}/{uuid}.webp` | 按省份分目录，结构清晰 |
| 墙面 zoom-in 触发 | 点击热区 / 悬浮图标按钮 | 点击墙面热区，底图用 isometric-room-pastel.png | 直觉交互，有底图支撑 |
| 照片面板动画 | 底部滑入 / 从省份位置放大展开 | 从省份位置放大展开/缩回 | 空间连续感强 |
