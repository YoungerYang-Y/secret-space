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

## 记录规范

后续每次实施追加一个以日期和追踪 ID 命名的小节，并按以下顺序记录：

1. 开始状态与基线证据。
2. 实际修改的文件和行为。
3. Red 阶段失败证据。
4. Green 阶段通过证据。
5. 完整验证命令、退出码和测试数量。
6. 剩余风险、阻塞或新建的追踪 ID。
7. 最终状态变化。
