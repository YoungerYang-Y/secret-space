# 果果的秘密空间 — 技术选型

> 确认时间：2026-06-10

## 前端

| 层 | 技术 | 说明 |
|---|------|------|
| 场景渲染 | PixiJS v8 | 2D WebGL 引擎，房间/猫/粒子/动画 |
| UI 层 | Vue 3 + Vite | 弹窗、编辑器、表单、相册等 DOM 内容 |
| 场景↔UI 通信 | Vue 组件覆盖在 Canvas 上，事件总线/状态管理协调 | |
| zoom-in 过渡 | PixiJS 内部 camera 动画（根容器 scale+pivot），动画结束后 Vue UI 淡入 | |
| 动画控制 | GSAP | 开门动画、UI 过渡、时间线编排 |
| 猫动画 | Rive + @rive-app/canvas | 免费编辑器、文件极小、状态机内置 |
| 粒子特效 | @pixi/particle-emitter | 萤火虫、蒲公英、灰尘 |
| 翻页相册 | StPageFlip（page-flip） | 纯 TS、触摸支持、拟真翻页 |
| 涂鸦画板 | Fabric.js | JSON 持久化、可继续编辑、撤销重做 |
| 日记编辑器 | 纯 textarea + Markdown 渲染 | 3岁小朋友不需要富文本，简单为主 |
| 拖拽交互 | PixiJS 内建事件（pointermove + hitTest）| 积木/拼图在 Canvas 内，不需要额外库 |
| 语音录制 | MediaRecorder API | 前端录制，WebM 格式上传 |
| 设备传感器 | DeviceMotion API（摇一摇）| iOS 13+ 需 requestPermission，首次触摸时申请 |
| PWA | vite-plugin-pwa (Workbox) | Service Worker 缓存静态资源 |
| 中国地图 | SVG path（DataV 导出 + 后期简化圆角化）| DOM 层覆盖，原生 hover/click |
| 音频 | Howler.js | 多轨管理、audio sprite、淡入淡出 |
| 状态管理 | Pinia + mitt | Pinia 管持久状态，mitt 传瞬时事件 |
| CSS | UnoCSS / Tailwind | UI 层样式 |

## 后端

| 层 | 技术 | 说明 |
|---|------|------|
| 框架 | NestJS | TypeScript 全栈一致 |
| 数据库 | SQLite (WAL 模式) | 数据量极小、零运维、备份简单、WAL 避免并发写锁 |
| ORM | Prisma | 类型安全、迁移方便 |
| 对象存储 | S3 兼容（Cloudflare R2 / MinIO） | |
| 前台认证 | 简单密码校验（bcrypt hash） | 访客密码 + 果果密码，两级 |
| 管理后台认证 | JWT + bcrypt | 独立管理员账号，session 级别 |
| 定时任务 | @nestjs/schedule (cron) | 时间胶囊定时解锁 |
| 天气 | 代理转发和风天气/OpenWeather API | |
| 语音录制存储 | WebM/OGG 格式，上传到对象存储 | 前端 MediaRecorder API 录制 |

## 部署

| 部分 | 方案 |
|------|------|
| 前端 | Nginx（Docker 内）或 Vercel |
| 后端 | Docker 自建 |
| 数据库 | SQLite 文件（Docker volume 持久化）|
| 对象存储 | Cloudflare R2 或 MinIO（Docker 内） |
| CDN | Cloudflare |
| 编排 | Docker Compose |

## 工程化

- Monorepo（pnpm workspace）：`packages/client` + `packages/server` + `packages/shared`
- TypeScript 全栈
- ESLint + Prettier
- Docker Compose 本地开发 + 生产部署

## 架构示意

```
packages/
├── client/          # Vue 3 + PixiJS 前端
│   ├── src/
│   │   ├── pixi/    # PixiJS 场景层（房间、camera、猫、粒子）
│   │   ├── views/   # Vue UI 层（相册、日记、游戏等）
│   │   ├── stores/  # Pinia 状态
│   │   └── ...
│   └── ...
├── admin/           # Vue 3 + Element Plus 管理后台
│   ├── src/
│   │   ├── views/   # 各管理页面
│   │   └── ...
│   └── ...
├── server/          # NestJS 后端
│   ├── src/
│   │   ├── modules/ # 功能模块（diary, album, map, mailbox, capsule...）
│   │   └── ...
│   └── ...
└── shared/          # 共享类型/常量
```

## 关键技术决策记录

| 决策点 | 结论 | 理由 |
|--------|------|------|
| 场景+UI集成 | Canvas底层 + DOM覆盖层 | 成熟可靠，性能天花板高 |
| zoom-in 实现 | PixiJS 内部 camera | 避免 CSS transform 缩放模糊 |
| 猫动画 | Rive | 免费、状态机内置、文件极小、Web 原生 |
| 涂鸦持久化 | Fabric.js JSON | 支持继续编辑、撤销重做 |
| 翻页相册 | StPageFlip | 纯 TS、免费、触摸友好 |
| 地图 SVG | DataV 导出 + 简化 | 省界准确、制作快 |
| 后端部署 | Docker 自建 | 支持长连接、定时任务、无冷启动 |
| 移动端竖屏 | 区域级展示 + 左右滑动切换 | 保持可用性，不强迫横屏 |
| 管理后台 | 自建 Vue Admin（Element Plus） | 完全可控、风格统一 |

## 架构设计细节

### 响应式策略

- PC/平板横屏：房间底图 16:9，letterbox 适配
- 手机竖屏：区域级展示，左右滑动切换区域，顶部导航指示器

### 装饰层系统（四季/节日/天气统一架构）

```
触发条件 → 装饰层配置 → 叠加渲染
- 四季：客户端本地月份判断
- 时间（日夜）：客户端本地时间
- 天气：后端代理 API，客户端定时拉取
- 节日：后端配置（管理后台），客户端启动时拉取
- 优先级：生日 > 节日 > 四季（冲突时高优先级覆盖）
```

### 猫行为系统

- 轻量行为树（Selector → 条件判断 → 动作）
- 预设路径点巡逻（不需要复杂寻路）
- 两只猫独立行为树 + 偶尔同步行为

### 音频架构

- Layer 0：环境音（循环，随四季切换）
- Layer 1：音乐盒（播放列表，用户控制）
- Layer 2：音效（一次性触发，audio sprite 打包）
- 密码解锁时解锁 Audio Context（移动端）

### Camera 性能优化

- zoom-in 后视口外精灵设 renderable=false
- 粒子系统离开视口时暂停
- 区域高清素材异步加载替换

## 性能预算

| 资源 | 预算 |
|------|------|
| 房间底图（压缩） | ~500KB |
| PixiJS + Vue + 框架代码 | ~300KB (gzipped) |
| 猫 Rive 动画文件 | ~50-100KB |
| 音频 sprite | ~200KB |
| **首屏总计** | **~1.2-1.5MB** |

### 优化策略

- 图片：WebP/AVIF + CDN + 响应式尺寸
- 猫 Rive：文件本身很小，按需加载非首屏状态
- 代码：路由级 code splitting
- 音频：首屏只加载环境音，其他触发时加载
- 相册图片/游戏：完全懒加载

## 备份与迁移策略

- SQLite 文件：定时 cron 拷贝到对象存储（每日备份 + 7 天保留）
- 对象存储：R2/MinIO 本身有冗余，跨区备份可选
- Docker volume：数据目录挂载宿主机，方便迁移
- 迁移方式：拷贝 SQLite 文件 + 对象存储数据 → 新服务器 docker-compose up
- Prisma 迁移：schema 变更通过 prisma migrate 管理，迁移文件入 Git

## 压力测试决策记录

> 2026-06-10 grill-me 环节

| 决策点 | 选项 | 选择 | 理由 |
|--------|------|------|------|
| PixiJS 版本 | v8(新) / v7(稳定) | v8 | 官方维护插件，项目周期长有试错空间 |
| 双系统复杂度 | 接受分层 / 去 Vue / 去 PixiJS | 接受，严格分层 | 场景渲染和富内容交互最佳工具不同 |
| 后端框架 | NestJS / Express / Hono | NestJS | 模块数量多，结构化价值高 |
| 状态同步 | 纯 Pinia / 纯事件总线 / 混合 | Pinia + mitt 混合 | 持久状态用 Pinia，瞬时事件用 mitt，各司其职 |
| Fabric.js 移动端 | 适配 / 降级 / 不支持 | 做触摸适配 | 主要场景是平板，适配量可控 |
| 音频库 | Howler.js / 原生 API / Tone.js | Howler.js | 10KB 覆盖所有需求，性价比最高 |
| 仓库结构 | Monorepo / 多仓库 / 单包 | pnpm workspace monorepo | 共享类型方便，一人开发无协调成本 |
| 数据库 | PostgreSQL / SQLite | SQLite | 数据量极小、零运维、备份=拷贝文件 |
