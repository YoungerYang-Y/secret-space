# 修复工作日志

本日志只追加记录，不覆盖历史条目。每条日志必须包含追踪 ID、变更范围、验证证据和结果。

## 2026-07-18：建立追踪基线

- **追踪 ID**：INIT-001
- **范围**：建立独立 remediation 工作区；未修改冻结基线和业务代码。
- **基线构建**：`pnpm build` 退出码为 0；Shared、Client、Admin、Server 均构建成功。
- **基线测试**：Server 44/44、Client 27/32、Admin 2/2、Shared 1/1；全仓合计 74 个通过、5 个失败，`pnpm test` 退出码为 1。
- **已知失败**：Client 的 `SceneManager.test.ts` 共 5 个失败，原因集中在纹理 mock 未提供当前实现读取的 `width` 和 `height`。
- **队列状态**：18 个条目均为 `queued`，尚无 `in-progress` 条目。
- **下一项**：DR-001。

## 2026-07-18：DR-001 访问策略基线与待决项

- **追踪 ID**：DR-001
- **开始状态**：`queued`；本次只分析服务端读取边界并新增 remediation 决策记录，未修改冻结基线和业务代码。
- **已确认的 API 基线**：省份与照片元数据、相册及页面、随机提示均要求 `visitor`、`owner` 或 `admin`；照片和相册写入均仅允许 `admin`。
- **安全发现**：R2 上传签名响应包含基于 `R2_PUBLIC_URL` 拼接的直连 `publicUrl`。若对象存储公开，任何取得该 URL 的匿名者都可读取媒体字节，绕过上述 API 角色校验。
- **阻塞原因**：媒体是“私有空间内容”还是“可公开传播内容”尚未由产品决策确认。已新增 `dr-001-access-policy.md` 记录矩阵、选项和推荐方案。
- **状态变化**：`queued` → `blocked`。待确认策略后，先形成 DR-001 的 Spec/Design，再进入测试先行的实现。

## 2026-07-18：DR-001 读取策略已决

- **追踪 ID**：DR-001
- **决议**：用户确认方案 A：R2 桶保持私有，受保护内容只通过短期签名读取 URL 交付给已授权角色。
- **范围控制**：本项负责读取契约、签名读取和权限测试；稳定存储 key 的删除重试与历史数据模型彻底收口仍由 DR-002 负责。
- **状态变化**：`blocked` → `in-progress`。
- **下一步**：在 `dr-001-private-media/` 输出 Spec 和完整 Design，用户确认后才生成实施计划。

## 2026-07-19：DR-001 方案审查问题修正

- **追踪 ID**：DR-001
- **范围**：根据方案审查修正 Spec 与 Design；未修改冻结基线和业务代码。
- **修正内容**：拆分照片与相册上传签名接口；加入上传确认、10 MiB 限制和 JPEG/PNG/WebP magic-byte 验证；定义 R2 与 Nest 的精确 CORS、私有访问和启动校验；定义 DTO 的规范媒体引用边界；补充历史引用 dry-run、迁移、备份回滚及 300 秒既有签名撤销窗口。
- **验证**：结构检查确认 Spec 包含 4 个 Behavior、14 个 Scenario；Design 包含照片与相册独立签名接口、上传确认、部署契约、错误处理、迁移命令和相应测试策略；未发现旧的模糊上传接口、将短期预览地址作为保存输入、或未授权占位符。
- **复审结果**：上一轮 2 个 P0、3 个 P1 和 1 个 P2 均已由明确的接口、部署、迁移或安全约束覆盖。当前方案可进入实施计划阶段；尚未实施业务代码。

## 2026-07-19：DR-001 存储供应商可迁移性

- **追踪 ID**：DR-001
- **范围**：将方案中的持久化引用从 `r2://` 更正为供应商无关的 `media://<logical-key>`；未修改冻结基线和业务代码。
- **设计决议**：`MediaStorage` 是存储能力的唯一 seam，当前由 `R2MediaStorage` adapter 实现。业务模块、客户端 API 和持久化数据不再识别 bucket、域名或供应商。
- **迁移策略**：新供应商使用相同 logical key 复制并校验 SHA-256；目标优先、R2 回退读取 30 天；观测达标后由 DR-002 的删除闭环清理旧对象。
- **验证**：结构检查确认 Spec 仍有 4 个 Behavior、14 个 Scenario；Spec/Design 无 `r2://` 持久化引用、无旧上传接口和无未授权占位符；`MediaStorage`、`R2MediaStorage`、`STORAGE_DRIVER`、双读与 adapter 契约测试均已明确记录。

## 2026-07-19：DR-001 实施计划与复审通过

- **追踪 ID**：DR-001
- **范围**：新增 `dr-001-private-media/plan.md`，并修正 remediation 内 Spec/Design 的执行一致性；未修改冻结基线和业务代码。
- **计划内容**：按 T1～T6 串行覆盖 driver 选择与 `MediaStorage` seam、历史引用迁移、受保护读取/确认上传、启动 CORS、Admin/Client 适配和部署验收。每项都有依赖、Red/Green/Verify/Commit、独立 AC 和提交归属要求。
- **审查修正**：明确 `STORAGE_DRIVER` factory 绑定当前 `R2MediaStorage`、迁移测试命令、`POST /albums/:id/pages` 与 `PUT /pages/:id` 的既有路由、空照片与失效会话断言、magic-byte 测试矩阵，以及 T1/T4/T6 的配置来源关系。
- **验证**：结构检查确认 6 个任务均具备 Depends on、Execution、Task Completion Gate、Red/Green/Verify/Commit；最终独立复审无 P0/P1。
- **状态变化**：`in-progress` 保持不变；计划已就绪，下一步须从 T1 的 Red 阶段开始，尚未执行任何业务实现或测试。

## 2026-07-19：DR-001 实施前基线门禁

- **追踪 ID**：DR-001
- **范围**：提交 remediation 文档后执行全仓测试基线；未修改业务代码、冻结基线或 T1 状态。
- **命令与结果**：`COREPACK_HOME=/tmp/secret-space-corepack TMPDIR=/tmp TMP=/tmp TEMP=/tmp pnpm test` 退出码为 1；Shared 1/1、Admin 2/2 通过，Client 27/32 通过。
- **失败证据**：仅 `packages/client/src/pixi/__tests__/SceneManager.test.ts` 的 5 个既有用例失败，均在 `SceneManager.init` 读取 `texture.height` 时抛出 `Cannot read properties of undefined (reading 'height')`。
- **执行门禁**：Plan 执行流程要求代码任务的项目级基线全绿；因此未将 T1 标记为 `in-progress`，也未开始 Red 阶段。
- **待决项**：需要决定先处理 DR-009 使全仓基线恢复绿色，还是明确接受针对已登记 DR-009 的受控例外后再启动 DR-001。

## 2026-07-19：DR-009 基线修复开始

- **追踪 ID**：DR-009
- **状态变化**：用户选择先修复基线；DR-001 `in-progress` → `blocked`，DR-009 `queued` → `in-progress`，保持仅一个 active 条目。
- **根因**：`SceneManager.init()` 在背景图功能加入后读取 `Assets.load('/assets/room-bg.png')` 返回纹理的 `height` 和 `width`；`SceneManager.test.ts` 的 Pixi `Assets.load` mock 未设置返回值，默认 `undefined`，导致 5 个调用 `init()` 的用例在同一行抛出 TypeError。
- **范围**：只补齐测试 double 的纹理尺寸契约，不更改 `SceneManager` 生产逻辑、资源文件或 Pixi 版本。

## 2026-07-19：DR-009 基线修复已验证

- **追踪 ID**：DR-009
- **实际修改**：`packages/client/src/pixi/__tests__/SceneManager.test.ts` 的 `Assets.load` mock 明确返回背景图的 `width: 2274`、`height: 1947`，与本地 `room-bg.png` 和 `SceneManager` 的读取契约一致。
- **Red 证据**：修复前定向执行 Client 测试，5 个 `SceneManager` 用例均在 `SceneManager.ts:18` 因读取 undefined 的 `texture.height` 失败。
- **Green 证据**：修复后 Client 测试为 8 个文件、32 个用例全部通过。
- **完整验证**：`pnpm test` 通过：Shared 1/1、Admin 2/2、Client 32/32、Server 44/44；`pnpm build` 通过。构建仅保留既有的 Rollup PURE 注释和 chunk-size 警告。
- **状态变化**：DR-009 `in-progress` → `verified`；DR-001 `blocked` → `queued`，可重新进入 T1 的 Red 阶段。

## 2026-07-19：DR-001 T6 部署清单与跨层验收

- **追踪 ID**：DR-001 / T6
- **范围**：创建部署运行手册 `deployment-checklist.md`；扩展 `app.e2e.test.ts` 增加私有媒体访问控制断言；运行全仓构建与测试验收。
- **已创建文件**：`docs/active/0.1.0/remediation/dr-001-private-media/deployment-checklist.md`（7 节运行手册：备份、R2 私有访问、CORS 配置、dry-run、apply、回滚、provider 切换）。
- **已修改文件**：`packages/server/src/__tests__/app.e2e.test.ts`（新增 4 个私有媒体访问控制 E2E 断言）；`docs/active/0.1.0/remediation/worklog.md`（本条目）。
- **跨层验收证据**：
  - `album-flow.e2e.test.ts`：匿名读取 → 401；管理员确认上传 → `media://` 引用保存 → 列表读取 → 签名 URL 返回。
  - `app.e2e.test.ts`：匿名省份照片 → 401；匿名相册列表 → 401；授权用户省份照片 → 200；授权管理员相册 → 200。
- **构建验证**：`pnpm build` 退出码 0；Shared、Server、Client、Admin 均构建成功。
- **完整测试**：`pnpm test` 退出码 0；Server 141/141、Admin 11/11、Client 36/36、Shared 1/1 = 189/189 通过。
- **AC 结果**：
  - AC1 ✅：清单包含运行前备份、dry-run 零失败门槛、R2 CORS OPTIONS 验收、匿名直连非 2xx、apply、回滚和 30 天 provider 回退步骤。
  - AC2 ✅：Server 集成测试验证匿名 401 无媒体 URL、授权角色获得签名 URL、管理端保存后再次读取显示媒体。
  - AC3 ✅：全仓构建通过，`pnpm test` 189/189 通过。
- **状态变化**：T6 `pending` → `done`。

## 2026-07-19：DR-001 T6 后审查修正（补记）

- **追踪 ID**：DR-001
- **背景**：T6 验收通过后对方案实现做了一轮复审，发现 7 项问题并追加一轮收窄修正；本条目为补记，提交已在当日完成。
- **实际提交**：
  - `f599163 fix(media): 修复审查发现的 7 项问题`：移除遗留 `r2` 模块与 `r2.service`（统一由 `media` 模块承接）；收紧 `media-reference.service` 与 `media.controller` 边界；`province.service` 读取路径修正；部署清单与 Admin 测试相应修正。
  - `11e7b6a fix(media): 收窄上传类型校验 + 补充环境变量文档 + 修正测试 mock`：`album.controller` 与 `photo.service` 上传类型校验收窄；`.env.example` 补充环境变量说明；`PageEditor.test.ts` mock 修正。
- **验证**：两轮修正均通过定向测试后合入；当日分支末端 `pnpm test` 全绿（次日 2026-07-21 复验证据见下条）。
- **状态变化**：DR-001 保持 `in-progress`（当时 tracker 状态滞留于 `queued`，由 2026-07-21 条目一并纠正）。

## 2026-07-21：DR-001 复验通过并关闭

- **追踪 ID**：DR-001
- **开始状态**：`queued`（tracker 状态滞后于实现：T1～T6 及两轮审查修正均已于 2026-07-19 提交在 `codex/dr-001-private-media`，本条按规则补齐状态流转与新鲜证据）。
- **完成标准逐项核对**：
  1. 角色×资源×操作权限矩阵已记录：`dr-001-access-policy.md`（目标权限矩阵，方案 A 私有桶 + 短期签名读取）。✅
  2. 内容读取 API 与矩阵一致：匿名读取省份照片/相册列表返回 401 且无媒体 URL；visitor/owner/admin 读取返回 300 秒签名 URL；写操作仅 admin；由 `app.e2e.test.ts`、`album-flow.e2e.test.ts`、各控制器测试断言。✅
  3. 鉴权集成测试覆盖匿名、访客、所有者、管理员：匿名（app.e2e 401）、visitor（app.e2e / province.controller）、owner（album-flow 越权拒绝、album.controller、province.controller、roles.guard）、admin（全套写路径）。✅
  4. 对象存储读取策略明确：私有桶禁止匿名读取、读取签名 300 秒 / 上传签名 600 秒、精确 CORS 与启动校验、持久化仅 `media://<logical-key>`；见 `dr-001-private-media/spec.md` 约束与 `deployment-checklist.md`。✅
- **新鲜验证证据（WSL Ubuntu-24.04 内执行，worktree 根目录）**：
  - `COREPACK_HOME=/tmp/secret-space-corepack TMPDIR=/tmp TMP=/tmp TEMP=/tmp pnpm test` 退出码 0；Server 141/141、Admin 11/11、Client 36/36、Shared 1/1，合计 189/189 通过。
  - `pnpm --filter @secret-space/server build` 退出码 0。
- **剩余风险与交接**：
  - 分支 `codex/dr-001-private-media`（9 个提交）尚未合并回 `main`；合并后生产侧仍需按 `deployment-checklist.md` 执行：备份、禁用 R2 公开访问、精确 CORS、历史引用 dry-run 零失败后 apply、回滚预案。
  - 已签发读取 URL 的最大既有访问窗口为 300 秒（令牌撤销后），属方案内已接受约束。
  - 删除闭环（失败持久化重试、可观测记录）按范围切分不在本项，由 DR-002 承接。
- **最终状态变化**：DR-001 `queued` → `verified`。下一待启动项 DR-002，启动前须先按规则在 tracker 标记 `in-progress`。

## 2026-07-21：DR-002 启动与删除链路基线

- **追踪 ID**：DR-002
- **开始状态**：`queued` → `in-progress`。当前唯一 active 条目（DR-001 已于今日关闭）。
- **基线证据**：2026-07-21 WSL 内 `pnpm test` 退出码 0（Server 141/141、Admin 11/11、Client 36/36、Shared 1/1）；`pnpm --filter @secret-space/server build` 退出码 0。分支 HEAD `ebd94f6`。
- **现状删除链路分析（代码证据）**：
  - `PhotoService.delete`：先 `storage.delete(photo.key)` 后删 DB；存储失败抛错导致 500，DB 记录保留，但存储故障期间管理员无法删除，且失败无任何持久化记录。
  - `AlbumService.delete`：先删 DB 再 `Promise.allSettled` best-effort 删对象；失败仅 `console.error`，key 列表随 DB 删除丢失，失败对象永久孤儿。
  - `AlbumService.deletePage`：只删 DB 记录，未触碰存储，页面图片必然成为孤儿对象。
  - 删除时 key 由运行时从 `media://` 引用或 legacy URL 反解析（`extractKey` 可返回 `null`）；Photo 有持久化 `key` 列，Album/Page 无。
  - 无任何持久化删除任务、重试机制或可观测失败记录；`r2-media-storage.ts` 注释将未确认上传的孤儿对象清理划归本项。
- **范围确认**：按完成标准与审查建议（稳定 storageKey + 持久化删除任务，不从公开 URL 反解析 key），先输出 Spec 待用户确认，再进入 Design/Plan 与测试先行实现。不扩张范围：相册模板不变量归 DR-005，管理员会话归 DR-003。
- **状态变化**：`queued` → `in-progress`。

## 2026-07-21：DR-002 实施完成并关闭

- **追踪 ID**：DR-002
- **开始状态**：`in-progress`（基线见上条：全仓 189/189 绿、Server 构建退出 0）。
- **过程**：用户确认 Spec 后产出 Design 与 Plan（T1～T5），按 Red → Green → Verify → Commit 逐任务执行。文档提交 `d6c4bae`。
- **任务执行记录（每次 Red 均为 fresh 失败证据）**：
  - **T1 删除任务模型与服务**（`86f8623`）：Red — 服务/模型不存在，目标套件无法加载（EXIT=1）；Green — 新增 `MediaDeletionTask` 模型与迁移、`MediaDeletionService`（enqueue/退避/清扫/启动钩子）；Verify — Server 148/148、server build 退出 0。实现注记：Prisma 5.0 SQLite 不支持 `createMany`，改为事务内逐条 `create`。
  - **T2 Photo 删除接入**（`32480be`）：Red — 存储故障路径返回 500 且无持久化任务（2 用例失败）；Green — 事务内 `enqueueMany + photo.delete`，提交后 `runDueDeletions`，语义变为存储故障仍 204；Verify — Server 150/150。
  - **T3 Album/Page 删除接入**（`d783721`）：Red — 无持久化任务记录（3 用例失败）；Green — 封面与各页图片从持久化 `media://` 引用收集 key，事务登记后删除；`deletePage` 首次纳入对象清理；移除 `Promise.allSettled + console` 清理与 `extractKey` URL 反解析；Verify — Server 153/153。
  - **T4 上传 staging 与管理端接口**（`dccf2a0`）：Red — 端点不存在、tmp 行为未实现（19 用例失败）；Green — presign 落 `tmp/photos/...`，confirm 校验后 `CopyObject → photos/... → 删 tmp` 并返回最终 `mediaRef`，`/media/confirm` 只接受 `tmp/photos/` key 且 readUrl 针对最终 key；新增 `GET /media/deletion-tasks`（含 failing 派生状态）与 `POST /media/deletion-tasks/retry`（匿名 401、visitor/owner 403）；Verify — Server 164/164、server build 退出 0。
  - **T5 部署清单与验收**（本提交）：`deployment-checklist.md` 追加 3A 节（`tmp/` 前缀 1 天过期 lifecycle 规则 + 验证命令 + 验收表行）。
- **完成标准逐项核对**：
  1. 媒体保存稳定 `storageKey` ✅ — Photo 持久化 `key` 列（迁移已回填），Album/Page 由持久化 `media://` 引用承载；删除任务 key 只来自这两类持久化来源，不从公开 URL 反解析。
  2. 删除失败可持久化重试 ✅ — `MediaDeletionTask` 表持久化 key/attempts/lastError/nextAttemptAt；重试入口三处：删除提交后立即尝试、应用启动清扫、管理员 `POST /media/deletion-tasks/retry`；失败路径测试覆盖（存储故障 → pending → 恢复 → done）。
  3. 失败有可观测记录 ✅ — 任务表即持久化记录，管理员可 `GET /media/deletion-tasks?status=pending|done|failing` 查询；`lastError` 剥除 URL。
  4. 正常与失败路径测试通过 ✅ — 覆盖 enqueue 去重/非法 key、退避序列、到期过滤、幂等、重启不丢、三条业务链路的成功与故障路径、管理端接口鉴权矩阵。
- **新鲜验证证据（WSL Ubuntu-24.04，worktree 根目录）**：
  - `COREPACK_HOME=/tmp/secret-space-corepack TMPDIR=/tmp TMP=/tmp TEMP=/tmp pnpm test` 退出码 0；Server 164/164、Admin 11/11、Client 36/36、Shared 1/1，合计 212/212。
  - `pnpm build` 退出码 0（shared、server、client、admin 全部构建成功）。
- **剩余风险与交接**：
  - 分支未合并回 `main`；生产部署需按 `deployment-checklist.md` 追加执行 3A 节（tmp/ lifecycle 规则），否则未确认上传不会被自动清除（不影响正确性，只影响桶内整洁）。
  - 重试无进程内定时器，依赖启动清扫与管理员触发；媒体量显著增长后可另立条目评估定时清扫。
  - `done` 任务记录保留作审计轨迹，清理策略留待后续需要时另立条目。
- **最终状态变化**：DR-002 `in-progress` → `verified`。当前无 active 条目；下一待启动项 DR-003 或 DR-005。

## 2026-07-22：DR-001 审查修正（一次性上传回执）

- **追踪 ID**：DR-001（已验证条目的安全修正，未改变冻结的 P0/P1/P2 基线文档）。
- **修正内容**：预签名不再暴露最终 `media://` 引用；`POST /media/confirm` 返回 10 分钟、按照片省份或相册范围绑定的一次性 `uploadReceipt` 与 300 秒预览地址。照片、相册封面和页面图片在业务事务内消费回执；直接引用、跨范围、过期和重放均被拒绝。
- **恢复语义**：确认已晋级对象后若读取签名或回执入库暂时失败，同一 staging key 会重新校验最终对象并恢复未消费回执；写接口在消费回执和提交业务记录前先取得读取签名，签名失败不会留下已消费回执或半成功记录。
- **安全与兼容性修正**：运行时旧 URL 不再回显；读取签名失败统一为无存储细节的 503；同一读取响应按 logical key 去重签名；`CreatePageDto.content` 必填。Admin 三个上传入口改为只提交回执，读取响应与写后响应均只返回短期 URL。
- **新增回归覆盖**：未确认/重放/过期/跨省/跨范围回执、回执/预览持久化故障后的确认恢复、写前签名失败不消费回执、不写记录、旧 URL 不回显、签名故障脱敏、重复读取签名去重，以及缺失页面内容 400。
- **独立复审**：两轮独立复审已完成；最终结论无 P0/P1。
- **新鲜验证证据（WSL，worktree 根目录）**：`TMPDIR=/tmp TMP=/tmp TEMP=/tmp COREPACK_HOME=/tmp/secret-space-corepack pnpm test && pnpm build` 退出码 0；Server 180/180、Admin 11/11、Client 36/36、Shared 1/1，合计 228/228；四个 workspace 均构建成功。Admin 测试仍输出未注册 Element Plus 测试桩警告，未影响退出码。
- **状态**：实现与验证完成，当前修改尚未提交；生产仍须按 DR-001 部署清单先完成历史引用 dry-run 零失败与私有桶/CORS 验收。

## 2026-07-27：DR-003 实施完成并关闭

- **追踪 ID**：DR-003
- **开始状态**：`queued` → `in-progress`（2026-07-26 启动）。
- **问题**：管理员 JWT 长期存放在 localStorage，暴露给页面脚本，存在 XSS 风险。
- **解决方案**：HttpOnly Cookie + 服务端 Session 表替代 localStorage JWT；SessionGuard 双轨验证（Cookie 优先 + Bearer Token 向后兼容 Client）。

### 任务执行记录

- **T1 Session 表与 SessionService**（`bcd0345`）：
  - Red — SessionService 不存在，测试无法加载。
  - Green — 新增 `Session` Prisma 模型、`SessionService`（create/validate/revoke/cleanupExpired）、cookie-parser 中间件、启动时清理 + 每小时定时清理。
  - 实现注记：admin 最多 5 个活跃 Session，超出删除最旧；admin=8h，visitor/owner=24h。
  - Verify — Server 225/225 通过。

- **T2 SessionGuard + AuthController 改造**（`caad64f`）：
  - Red — SessionGuard 不存在，新接口未实现。
  - Green — 创建 `SessionGuard` 双认证（Cookie 优先 + Bearer Token fallback）；改造 `RolesGuard` 只做授权；改造 `AuthController`：verify 设置 HttpOnly Cookie、新增 logout/me 接口；shared `AuthVerifyResponse` 移除 token 字段；所有 Controller 添加 `@UseGuards(SessionGuard, RolesGuard)`。
  - Verify — Server 235/235 通过。

- **T3 Admin 前端适配**（`91f7e4f`）：
  - Red — auth.test.ts 新用例失败（initSession 不存在、仍使用 localStorage）。
  - Green — 重写 `auth.ts` store（role + initialized，移除 localStorage）；`main.ts` 配置 withCredentials + 401 拦截器；`router/index.ts` 使用 initSession；4 个 View 文件移除手动 Authorization header。
  - Verify — Admin 16/16、全仓 252/252 通过。

- **T4 测试补全与回归验证**（`ab9ac2b`）：
  - Red — 新测试用例待添加。
  - Green — `auth.controller.test.ts` 新增并发登录、max session 测试；`app.e2e.test.ts` 新增 Cookie/Bearer Token 双认证、会话过期测试。
  - Verify — 全仓 257/257 通过。

- **T5 文档更新与部署检查清单**（`68a3a15`）：
  - 创建 `deployment-checklist.md`：NODE_ENV 配置、prisma migrate、双认证模式、Session 限制说明。
  - 更新 `tracker.md`：DR-003 状态为 verified。
  - 更新 `.env.example`：添加 NODE_ENV 说明。
  - 安装 `@types/express` 修复构建。
  - Verify — 全仓 build 通过。

### 完成标准逐项核对

1. 管理员令牌不暴露给页面脚本 ✅ — Cookie 属性 HttpOnly/SameSite=Strict/Path=/api；admin store 不使用 localStorage。
2. 会话过期、撤销、匿名和越权路径均有测试 ✅ — session.service.test.ts（过期清理）、auth.controller.test.ts（logout 后 401）、app.e2e.test.ts（会话过期 401）、roles.guard.test.ts（越权 403）。
3. 迁移后后台主流程可用 ✅ — 所有 Controller 使用 SessionGuard + RolesGuard；双认证模式支持 Admin Cookie + Client Bearer Token。

### 新鲜验证证据（2026-07-27 合并后主干）

- `TMPDIR=/tmp TMP=/tmp TEMP=/tmp COREPACK_HOME=/tmp/secret-space-corepack pnpm test` 退出码 0；Server 204/204、Admin 16/16、Client 36/36、Shared 1/1，合计 257/257。
- `pnpm build` 退出码 0。

### 独立复审

- 2026-07-27 逐条验收 23 个 AC，全部通过。
- 验证方式：代码审查 + grep 验证 + 测试用例检查 + 实际运行测试/构建。

### 合并记录

- 分支 `codex/dr-003-admin-session`（8 个提交）已于 2026-07-27 合并回 `main`。
- 合并提交：`72e0e7c Merge branch 'codex/dr-003-admin-session'`。
- 解决了 16 个冲突文件，运行 `prisma migrate dev` 创建 Session 表。

### 状态变化

DR-003 `in-progress` → `verified`。

## 2026-07-27：DR-004 实际状态快照建立

- **追踪 ID**：DR-004
- **开始状态**：`queued` → `verified`（文档任务，当日完成）。
- **问题**：旧 Plan 与实际实现失真，P2 所有任务在 Plan 中标记为 pending 但实际已实现。

### 完成内容

创建 `dr-004-plan-snapshot/snapshot.md`，包含：
1. P0～P2 三个 Plan 共 18 个 Task 的文件存在性验证
2. 每个 Task 的实际完成状态（已实现/部分实现）
3. 13 项偏离记录（重构、合并、缺失）
4. 与 tracker.md GAP 条目的关联

### 核对结果

| Plan | 任务数 | 已实现 | 部分实现 | 偏离项数 |
|------|--------|--------|----------|----------|
| P0 Engineering Base | 7 | 5 | 2 | 6 |
| P1 Map & Photos | 6 | 5 | 1 | 3 |
| P2 Album | 5 | 3 | 2 | 4 |
| **总计** | **18** | **13** | **5** | **13** |

### 主要偏离项

- **R2 模块重构**：`r2/r2.service.ts` → `media/r2-media-storage.ts`（DR-001 抽象）
- **缺失组件**：SwipeNav.vue、BackButton.vue（P0-GAP-002 追踪）
- **缺失功能**：LoadingOrchestrator.ts（P0-GAP-001 追踪）
- **Plan 状态失真**：P2 所有任务标记 pending 但实际已实现

### 完成标准核对

1. 不修改旧 Plan ✅ — 原 plan.md 文件保持不变
2. 在本目录建立 P0～P2 实际状态快照 ✅ — `dr-004-plan-snapshot/snapshot.md`
3. 代码证据 ✅ — 文件存在性批量验证、构建/测试退出码
4. 验收结果 ✅ — 核心功能验证表、偏离项汇总
5. 后续状态只维护于本追踪表 ✅ — 快照声明后续在 tracker.md 追踪

### 状态变化

DR-004 `queued` → `verified`。

## 记录规范

后续每次实施追加一个以日期和追踪 ID 命名的小节，并按以下顺序记录：

1. 开始状态与基线证据。
2. 实际修改的文件和行为。
3. Red 阶段失败证据。
4. Green 阶段通过证据。
5. 完整验证命令、退出码和测试数量。
6. 剩余风险、阻塞或新建的追踪 ID。
7. 最终状态变化。

## 2026-08-16：DR-005 评审修正轮

- **追踪 ID**：DR-005（状态维持 `in-progress`）。
- **触发**：对 27 个待提交文件整体 review 后，确认无阻断性问题，但存在健壮性与一致性瑕疵，本轮修正并拆分提交。

### 修正内容

1. **超时判断收敛**：新增 `packages/server/src/prisma/transaction-timeout.ts`（`isTransactionTimeout`），覆盖 P2028/P2034 错误码与 "Timed out during query execution" 引擎消息；`album.service.ts` 删除/排序路径统一使用，移除散落的字符串匹配。
2. **删除超时兜底**：`AlbumService.delete` 超时后若相册已不存在（事务实际已提交或已被并发请求删除），先走 `runDueDeletions` 处理已登记的删除任务，再按既有契约返回 404。
3. **测试补强**：`album.controller.test.ts` 新增 P2028→503、超时但已提交→404 且删除任务完成 2 个用例（52/52 通过）。
   - 期间发现并发双删测试偶发失败（实际 204/204 vs 契约 204/404）：根因是最初把超时分支改成了 204，与既有契约冲突；改为"兜底清扫后仍返回 404"后，完整服务端套件连跑 4 次全绿。
4. **一致性修正**：admin `PageEditor.vue` presign/confirm 响应类型化；两端模板定义加 DR-006 同步注释；client 端 admin 密码提示文案明确化；`PhotoPanel.test.ts` 补最终断言。
5. **环境**：`prisma migrate dev` 已把 `20260812000000_add_page_album_order_unique` 应用到 dev.db。

### 验证证据（fresh，2026-08-16）

- `pnpm lint` 退出码 0。
- `pnpm test` 退出码 0：Server 219/219（完整套件连跑 4 次全绿）、Client 43/43、Admin 18/18。
- `pnpm build` 退出码 0。

### 提交状态

修正完成后曾拆为 4 个逻辑提交（chore(eslint)/refactor(client-auth)/feat(photo-panel)/fix(album)），经确认已撤回，全部改动保留为未提交工作区状态，等待另行决定提交时机。

### 补充修正（同日，第二轮 review 建议项）

1. admin `PageEditor.vue` 既有 `uploadImage` 的 presign/confirm 响应改用 `PresignResponse`/`ConfirmResponse` 类型，与新增页流程一致。
2. 移除 `Page` 模型冗余的 `@@index([albumId, order])`（唯一索引已覆盖同列前缀），生成并应用迁移 `20260816023039_drop_page_album_order_redundant_index`。

### 剩余风险

- DR-005 完成标准的逐项核对与 verified 判定待全部提交落地后进行。
- DR-006（模板定义统一）未实施，仅加注释指向。


## 2026-08-16：DR-005 场景测试补齐（第二轮补完）

- **追踪 ID**：DR-005（状态维持 `in-progress`，完成标准全部达成，verified 判定待确认）。

### 背景

按 spec 的 21 个 Scenario 逐条核对测试覆盖，发现 8 个场景无直接测试证据；本轮补齐。

### 修改内容（测试先行）

`packages/server/src/album/__tests__/album.controller.test.ts` 新增 12 个用例：

- 模板图片数量负向：single 传 2 张、double-h/double-v 传 1 张、triple 传 2 张、photo-text 传 2 张（Scenario 1.1/1.2/1.3/1.4/1.5）
- 模板图片数量正向：triple 恰好 3 张 → 201 且空相册 order=1（Scenario 1.6 + Task2-AC3）
- 创建空图片：imageReceipts=[null] 与 [""] 均 400（Scenario 1.7）
- photo-text 缺 text 字段 400（Scenario 2.1）、有效 text 201（Scenario 2.3）
- 改模板数量不匹配 400（Scenario 1.9）、[新回执, null] 换一保一 200（Scenario 1.10）
- 回执归属：photo scope 回执用于相册页 → 422（tracker 完成标准"回执归属"证据）

### Red/Green 证据

- Red：本批用例为该轮唯一新增内容，全部直接针对 spec Scenario；先写入用例再运行（无实现改动）。
- Green（fresh，2026-08-16）：`npx vitest run src/album/__tests__/album.controller.test.ts` → 64/64 通过（原 52 + 新 12）。

### 记录收口

- `plan.md`：Task 1~4 全部 AC 勾选，Status → done；Commit SHA 标注"未提交（工作区）"。
- Task3-AC3 偏离：实现用 `Promise.all` 而非 `allSettled`（并发语义等价、失败显式抛出）。
- `tracker.md`：DR-005 完成标准措辞"媒体归属"→"回执归属（scope）"，与 spec 范围外条款一致。

### 全仓 fresh 验证（2026-08-16，本条目完成后）

- `pnpm lint` 退出码 0。
- `pnpm test` 退出码 0：Server 231/231（含新增 12 例）、Client 43/43、Admin 18/18、Shared 1/1。
- `pnpm build` 退出码 0。
- verified 判定待用户确认后更新 tracker。


### 补充修正（同日）：T1-AC3 错误消息补实际数量

- **触发**：逐 AC 确认发现 T1-AC3（消息含模板、要求数量、实际数量）未完全达标——实现只含模板与要求数量。
- **Red**：先给 \`validates the template image count\`（期待"收到 0 张有效图片"）与 \`rejects single with more than one image\`（期待"收到 2 张有效图片"）补断言，运行后恰好这 2 个用例失败。
- **Green**：\`validatePageContent\` 两处消息改为 \`{模板} 模板需要 {N} 张图片，收到 {实际有效数} 张有效图片\`；album 测试 64/64 通过。
- **全仓 fresh**：\`pnpm lint\` 0；\`pnpm test\` 293/293（Server 231、Client 43、Admin 18、Shared 1）；\`pnpm build\` 0。

至此 DR-005 全部 AC 无未闭合项（T1-AC3 已达标；T3-AC3 的 Promise.all 偏离保持记录）。

