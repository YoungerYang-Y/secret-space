# 媒体删除闭环设计

**逻辑版本：** 0.1.0
**追踪项：** DR-002
**Resolved Path:** `docs/active/0.1.0/remediation/dr-002-media-deletion/`
**依据：** [spec.md](./spec.md)、[dr-001-access-policy.md](../dr-001-access-policy.md)、[overall-design-review.md](../overall-design-review.md)

## Context

当前三条删除链路各有一种缺陷：`PhotoService.delete` 在存储故障时以 500 阻塞管理员；`AlbumService.delete` 先删数据库再 best-effort 清理对象，失败后对象 key 随记录丢失成为永久孤儿；`AlbumService.deletePage` 完全不清理对象。失败信息只进进程日志，无持久化、无重试、无可查询记录。此外，经预签名上传但从未确认的对象会永久留在桶内（`r2-media-storage.ts` 已注明由本项处理）。

## Goal

1. 任何已保存媒体的删除请求，在数据库删除的同时持久化一条删除任务，二者同事务。
2. 对象删除失败只推迟、不丢失：任务带尝试次数、错误与退避调度，可由启动清扫与管理员触发重试直至成功。
3. 失败与待处理任务可由管理员查询，不只存在于进程日志。
4. 任务 key 只来自持久化的 `media://` 引用或 `Photo.key` 列，不从公开 URL 反解析。
5. 未确认上传的对象经 `tmp/` 前缀隔离后由桶级生命周期规则自动清除。

## Non-Goal

- 不引入定时任务框架等新运行时依赖。
- 不实现相册模板不变量（DR-005）、管理员会话方案（DR-003）。
- 不做存储供应商切换（沿用 DR-001 的 30 天双读方案）；`MediaStorage` seam 不变，仅扩展实现。
- 不扫描桶内对象做全量对账；孤儿防范围限定为「未确认上传」这一类已知来源。

## Architecture

```
管理端删除请求 (admin)
  ├─ PhotoService.delete / AlbumService.delete / AlbumService.deletePage
  │    └─ prisma.$transaction {
  │         MediaDeletionService.enqueue(keys, tx)   // 持久化删除任务
  │         业务记录删除（Photo / Album 级联 Page）
  │       }
  │    └─ commit 后：MediaDeletionService.runDueDeletions()  // 立即尝试
  │
  ├─ MediaDeletionService.runDueDeletions()          // 单一执行路径，三个触发点
  │    ├─ 触发1：删除请求提交后（立即，尽力而为）
  │    ├─ 触发2：应用启动 onApplicationBootstrap（补扫，不阻塞启动）
  │    └─ 触发3：POST /media/deletion-tasks/retry（管理员手动）
  │    └─ processOne：storage.delete(key)
  │         ├─ 成功 → status=done, doneAt=now
  │         └─ 失败 → attempts+1, lastError, nextAttemptAt=退避
  │
  └─ GET /media/deletion-tasks（admin）查询持久化任务记录

上传路径（配合未确认对象隔离）：
  presign → key = tmp/photos/...（客户端直传 R2）
  confirm → HeadObject 校验 → CopyObject 至 photos/... → 删除 tmp 对象 → 返回 media://photos/...
  桶级 lifecycle：tmp/ 前缀对象 1 天后过期清除
```

设计要点：**`nextAttemptAt = now` 的待办任务天然就是「立即执行」**，因此「删除后立即尝试」「启动补扫」「管理员重试」复用同一条 `runDueDeletions` 路径，无第二套逻辑。

## Interface Contract

### MediaDeletionService（新增，`media` 模块）

```ts
enqueueMany(keys: string[], tx: PrismaTx): Promise<number>
// 过滤空值与非法 key（必须 photos/ 前缀、不含 ..），批内去重；
// 以 status=pending、nextAttemptAt=now 写入；返回登记条数。
// 必须在调用方的事务内执行，与业务删除同生共死。

runDueDeletions(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }>
// 取 status=pending 且 nextAttemptAt<=now 的任务（按 nextAttemptAt 升序，上限 limit），
// 逐个 processOne；任何单条失败不影响其他条目；汇总返回。

onApplicationBootstrap(): void
// void this.runDueDeletions().catch(log)；存储故障不得阻塞启动。
```

退避：`nextAttemptAt = now + min(60s × 2^(attempts-1), 3600s)`。常量 `RETRY_BASE_MS` / `RETRY_MAX_MS` 导出以便测试注入时钟断言。

### 管理端接口（扩展 `MediaController`，全部 `@Roles('admin')`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/media/deletion-tasks?status=pending\|done\|failing` | 任务列表：`{ id, key, status, attempts, lastError, nextAttemptAt, createdAt, doneAt }`。`failing` 为派生状态（`pending 且 attempts>0`）。默认按 `createdAt` 倒序，上限 100。 |
| POST | `/api/media/deletion-tasks/retry` | 立即执行一次 `runDueDeletions`，返回 `{ processed, succeeded, failed }`。 |

鉴权矩阵沿用 DR-001：匿名 401；visitor/owner 403。

### MediaStorage 变化（上传 staging，适配未确认对象隔离）

| 方法 | 现状 | 变更 |
|---|---|---|
| `presignPhotoUpload` | key=`photos/<province>/<uuid><ext>` | key=`tmp/photos/<province>/<uuid><ext>` |
| `presignAlbumUpload` | key=`photos/album/<uuid><ext>` | key=`tmp/photos/album/<uuid><ext>` |
| `confirmUpload(key)` | HeadObject 校验 → 返回 `media://<key>` | 校验后 `CopyObject` 至 `key.slice(4)`（即 `photos/...`），再删除 tmp 对象，返回 `media://<finalKey>` |
| `POST /media/confirm` 的 key 校验 | 允许 `photos/` 前缀 | 改为只允许 `tmp/photos/` 前缀，且拒绝 `..` |

`confirm` 响应为 `{ uploadReceipt, readUrl, readExpiresIn: 300 }`；Admin 将回执用于对应的照片、封面或页面图片写入，持久化的 `media://` 引用只留在服务端。

### 业务服务改造

- `PhotoService.delete(id)`：取 `photo.key`（空则尝试从 `media://` url 解析，仍不行则跳过并 warn）；事务内 `enqueueMany + photo.delete`；提交后 `runDueDeletions()`。**不再先调 storage.delete**，存储故障时接口仍 204。
- `AlbumService.delete(id)`：删除前从持久化引用收集 key 集合（封面 `coverUrl` + 各页 `content.images`，仅 `media://` 经 `MediaReferenceService.toLogicalKey` 解析；非 `media://` 值跳过并 warn）；事务内 `enqueueMany + album.delete`（Page 级联）；提交后 `runDueDeletions()`。移除现有 `Promise.allSettled + console` 清理与 `extractKey` URL 反解析。
- `AlbumService.deletePage(pageId)`：同事务登记该页图片 key 后删除页面；提交后 `runDueDeletions()`。

## Data Model

新增 Prisma 模型（一次新迁移）：

```prisma
model MediaDeletionTask {
  id            String    @id @default(cuid())
  key           String
  status        String    @default("pending") // pending | done
  attempts      Int       @default(0)
  lastError     String?
  nextAttemptAt DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  doneAt        DateTime?

  @@index([status, nextAttemptAt])
}
```

- `key` 即 DR-001 的逻辑 key（`media://` 去掉协议头），供应商无关。
- 不删历史任务：`done` 记录即审计轨迹；清理策略留待后续需要时另立条目。

## Deployment Contract

- R2 桶新增生命周期规则：**`tmp/` 前缀对象 1 天后过期**。该规则与 DR-001 的私有访问、精确 CORS 并列，作为 DR-002 实施验收时追加进 `dr-001-private-media/deployment-checklist.md` 的部署项。
- 无新增环境变量；无新增运行时依赖。
- SQLite 迁移随应用部署执行；迁移只增表，不触碰既有数据。

## Error Handling

| 场景 | 行为 |
|---|---|
| `storage.delete` 抛错 | 任务保持 `pending`，`attempts+1`、`lastError`（错误名+消息，不含 URL/凭据）、按退避更新 `nextAttemptAt`；接口不受影响 |
| 删除不存在的对象 | R2/S3 删除幂等返回成功，任务正常 `done` |
| 启动清扫时存储不可用 | 捕获并记录 warn，启动继续 |
| `confirmUpload` 的 CopyObject 失败 | 抛 `ConfirmUploadError` → 422；tmp 对象留存，由生命周期规则清除 |
| 非法 key（非允许前缀、含 `..`） | `enqueueMany` 拒绝该条并记录 warn；`/media/confirm` 返回 400 |
| 页面 content JSON 解析失败或非 `media://` 值 | 跳过该值并记录 warn，不阻断删除 |

## Non-Functional Requirements

- 删除请求增加的同步开销 = 一次事务内批量 insert + 一次任务查询；单请求媒体数量沿用既有上限（相册单页 ≤10 张），可忽略。
- `runDueDeletions` 单轮上限 50 条，顺序处理，避免对 R2 的突发并发。
- 任务表按本项目数据规模（数百媒体）可忽略增长；`status+nextAttemptAt` 索引保证清扫查询 O(待办数)。
- 日志与任务记录不得包含签名 URL 或读取凭据。

## Alternatives Considered

1. **同步删除 + 失败时回滚数据库删除**：保持强一致但存储故障时管理员无法删除（当前 Photo 的缺陷），否决。
2. **进程内重试队列（内存）**：重启即丢，违背「持久化重试」，否决。
3. **引入 `@nestjs/schedule` 定时清扫**：多一个运行时依赖；启动清扫 + 管理员触发已覆盖本项目规模，否决（后续媒体量增大可另立条目评估）。
4. **未确认对象用应用内列举对账**：需 List 权限且复杂易错；`tmp/` 前缀 + 桶级生命周期规则零应用代码，采纳。
5. **Photo 保留先删对象后删库**：三条链路语义不一是本次要修复的问题本身，否决；统一为「事务登记 + 最终一致」。

## Testing Strategy

- **单元**：退避函数边界；`enqueueMany` 去重/非法 key 过滤；`processOne` 成功/失败分支；`runDueDeletions` 只取到期待办、单条失败不影响其余。
- **服务集成（测试库 + mock MediaStorage）**：
  - Photo 删除：存储正常 → 204 + 任务 done；存储故障 → 仍 204 + 任务 pending 带 lastError；「恢复」后 retry → done（覆盖规格语义变化）。
  - Album 删除：封面+页图全部登记；级联删除；任务可重试。
  - Page 删除：图片登记任务（修复当前孤儿缺陷的回归断言）。
  - 「重启不丢」：以再次调用 `runDueDeletions` 模拟重启后清扫。
- **存储适配层**：`confirmUpload` 的 tmp→final 拷贝与 tmp 删除（mock S3Client 断言 CopyObject/DeleteObject 顺序与 key 映射）；拷贝失败 → 422。
- **控制器**：任务列表/重试接口 匿名 401、visitor/owner 403、admin 200；`/media/confirm` 拒绝非 `tmp/photos/` key。
- **既有套件**：更新 `album.controller.test` 的删除断言（不再 console 清理）与 `album-flow.e2e`；全仓 `pnpm test` 必须保持退出码 0。

## Milestones

- T1：`MediaDeletionTask` 模型与迁移 + `MediaDeletionService`（enqueue/退避/清扫/启动钩子）+ 单元测试。
- T2：Photo 删除接入同事务登记（含语义变化与失败路径测试）。
- T3：Album 删除与 Page 删除接入（key 收集、级联、孤儿回归断言）。
- T4：上传 staging（tmp/ 前缀 + confirm 拷贝）与管理端任务查询/重试接口。
- T5：部署清单追加 lifecycle 规则 + 全仓复验与跨层验收。
