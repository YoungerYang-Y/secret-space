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

## 记录规范

后续每次实施追加一个以日期和追踪 ID 命名的小节，并按以下顺序记录：

1. 开始状态与基线证据。
2. 实际修改的文件和行为。
3. Red 阶段失败证据。
4. Green 阶段通过证据。
5. 完整验证命令、退出码和测试数量。
6. 剩余风险、阻塞或新建的追踪 ID。
7. 最终状态变化。
