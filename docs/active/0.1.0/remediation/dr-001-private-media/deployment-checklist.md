# DR-001 Private Media 部署清单

**版本：** 0.1.0
**最后更新：** 2026-07-19
**前置条件：** T1–T5 已合并至主分支，所有定向与全仓测试通过。

---

## 1. 运行前备份

- [ ] 备份 SQLite 数据库文件：

```bash
cp data/secret-space.db data/secret-space.db.bak.$(date +%Y%m%d%H%M%S)
```

- [ ] 确认备份文件完整且可读：

```bash
sqlite3 data/secret-space.db.bak.* "SELECT count(*) FROM album;"
```

- [ ] 记录当前部署的 commit SHA：

```bash
git rev-parse HEAD > data/pre-migration-sha.txt
```

---

## 2. R2 Private Access（禁止公开访问）

- [ ] 在 Cloudflare Dashboard 中禁用 R2 Bucket 的公共访问（Settings → Public Access → Disable）。
- [ ] 验证匿名直连对象返回非 2xx：

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://<R2_PUBLIC_DOMAIN>/<any-existing-key>"
# 预期：403 或 404，绝不能是 200
```

- [ ] 如返回 200，**立即停止后续步骤**并回滚公共访问配置。

---

## 3. R2 CORS 配置

- [ ] 配置 R2 Bucket CORS 规则：
  - **Allowed Origins**：精确指定管理后台域名（如 `https://admin.example.com`），禁止使用 `*`。
  - **Allowed Methods**：仅 `PUT`（浏览器直传）。
  - **Allowed Headers**：`Content-Type`。
  - **Max Age**：3600。

```json
[
  {
    "AllowedOrigins": ["https://admin.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

- [ ] 验证 CORS OPTIONS 预检：

```bash
curl -s -X OPTIONS \
  -H "Origin: https://admin.example.com" \
  -H "Access-Control-Request-Method: PUT" \
  "https://<R2_API_DOMAIN>/<test-key>" \
  -D -
# 预期：Access-Control-Allow-Origin: https://admin.example.com
# 预期：Access-Control-Allow-Methods 包含 PUT
```

- [ ] 验证非法 Origin 被拒绝：

```bash
curl -s -X OPTIONS \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: PUT" \
  "https://<R2_API_DOMAIN>/<test-key>" \
  -D -
# 预期：无 Access-Control-Allow-Origin 头
```

---

## 4. Migration dry-run（零失败门槛）

- [ ] 确认环境变量 `R2_LEGACY_PUBLIC_URL` 已设置为旧公共 URL 前缀。
- [ ] 执行 dry-run 模式：

```bash
pnpm --filter @secret-space/server media:migrate-legacy-refs -- --dry-run
```

- [ ] 检查输出：
  - 确认各实体（Photo、Album、Page）的统计数。
  - **失败数必须为 0**。若有任何失败记录，修复数据源后重新 dry-run。
  - dry-run 不会修改数据库。

```
# 预期输出示例：
# Photos: 42 total, 42 convertible, 0 failed
# Albums: 5 total, 5 convertible, 0 failed
# Pages:  20 total, 20 convertible, 0 failed
# Result: DRY-RUN PASSED (0 failures)
```

- [ ] 若 dry-run 有失败，**停止后续步骤**，排查失败记录并修复。

---

## 5. Migration apply（事务写入）

- [ ] 确认 dry-run 已通过（零失败）。
- [ ] 执行迁移：

```bash
pnpm --filter @secret-space/server media:migrate-legacy-refs -- --apply
```

- [ ] 验证输出：
  - 所有记录已迁移为 `media://` 引用。
  - 系统写入 `media_reference_migration_v1` 配置记录。

- [ ] 验证数据库中不再包含旧 URL：

```bash
sqlite3 data/secret-space.db \
  "SELECT count(*) FROM photo WHERE mediaUrl NOT LIKE 'media://%';"
# 预期：0

sqlite3 data/secret-space.db \
  "SELECT count(*) FROM album WHERE coverUrl IS NOT NULL AND coverUrl NOT LIKE 'media://%';"
# 预期：0
```

- [ ] 重复执行迁移不改变已迁移记录（幂等验证）：

```bash
pnpm --filter @secret-space/server media:migrate-legacy-refs -- --apply
# 预期：0 converted, 0 failed（全部已是 media:// 格式）
```

---

## 6. 回滚（Rollback）

若迁移后发现问题，执行以下回滚步骤：

- [ ] 停止应用服务。
- [ ] 恢复 SQLite 备份：

```bash
cp data/secret-space.db.bak.<timestamp> data/secret-space.db
```

- [ ] 恢复代码到迁移前版本：

```bash
git checkout $(cat data/pre-migration-sha.txt)
```

- [ ] 如需恢复公共访问（紧急回滚）：
  - 在 Cloudflare Dashboard 重新启用 R2 公共访问。
  - 确认旧 URL 可正常访问。

- [ ] 重启应用并验证读取正常。

---

## 7. Provider Switch（30 天双读回退窗口）

未来切换存储 provider 时：

- [ ] 在新 provider 创建存储桶并配置访问策略。
- [ ] 使用相同 logical key 复制所有对象并校验 SHA-256：

```bash
# 示例：从 R2 复制到新 provider
for key in $(list-all-keys); do
  download-from-r2 "$key" | upload-to-new "$key"
  verify-sha256 "$key"
done
```

- [ ] 配置 `STORAGE_DRIVER=<new-driver>` 并启用双读：
  - 优先从新 provider 读取。
  - 新 provider 读取失败时回退到 R2。
  - 写入只向新 provider。

- [ ] 30 天观测期：
  - 监控回退读取次数，确认趋零。
  - 监控新 provider 的签名 URL 200 率。
  - 监控错误日志中无未知 key 或超时。

- [ ] 30 天后确认无回退读取，关闭双读：
  - 移除 R2 回退逻辑。
  - 清理旧 R2 对象（由 DR-002 删除闭环负责）。

- [ ] 更新 `.env.example` 文档中的 driver 配置说明。

---

## 验收标准

| 验收项 | 验证方法 | 通过条件 |
|--------|----------|----------|
| R2 私有访问 | `curl` 匿名直连 | 非 2xx |
| CORS OPTIONS | `curl` 预检请求 | 精确 Origin 匹配 |
| dry-run 零失败 | 迁移脚本输出 | 0 failures |
| 数据库引用格式 | SQLite 查询 | 全部为 `media://` |
| 匿名 API 访问 | E2E 测试 | 401，无媒体 URL |
| 授权角色读取 | E2E 测试 | 200，返回签名 URL |
| 幂等迁移 | 重复执行 apply | 0 converted |
| 服务启动 | 缺失配置启动 | 拒绝启动 |
