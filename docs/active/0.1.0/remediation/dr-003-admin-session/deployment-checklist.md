# DR-003 Admin Session Security 部署检查清单

## 概述

本文档记录 DR-003 从 localStorage JWT 迁移到 HttpOnly Cookie + 服务端 Session 的部署要点。

## 前置条件

- [ ] 代码合并到主分支
- [ ] CI 全部通过（257 测试）
- [ ] 数据库可访问

## 数据库迁移

### Session 表

```bash
# 生产环境执行
pnpm prisma migrate deploy
```

新增 `Session` 表：
- `id` (String, 64 字符 hex, 主键)
- `role` (String)
- `expiresAt` (DateTime)
- `createdAt` (DateTime)
- 索引：`expiresAt`、`role`

## 环境变量配置

### NODE_ENV

| 环境 | 值 | Cookie Secure |
|------|-----|---------------|
| 生产 | `production` | `true` (仅 HTTPS) |
| 开发 | `development` | `false` (允许 HTTP) |

**重要**：生产环境必须设置 `NODE_ENV=production`，否则 Cookie 不带 `Secure` 属性，存在安全风险。

## 认证模式

### 双认证模式（永久并行）

| 客户端 | 认证方式 | 存储位置 |
|--------|----------|----------|
| Admin (Web) | HttpOnly Cookie | 服务端 Session 表 |
| Client (App) | Bearer Token | 客户端内存 |

SessionGuard 优先检查 Cookie，无 Cookie 时检查 Bearer Token。两种方式长期共存，非过渡期。

### Cookie 属性

```
session=<64-char-hex>; HttpOnly; SameSite=Strict; Path=/api; [Secure]
```

- `HttpOnly`：阻止 JS 访问，防 XSS
- `SameSite=Strict`：阻止跨站请求，防 CSRF
- `Path=/api`：仅 API 路径携带
- `Secure`：生产环境开启，仅 HTTPS 传输

## Session 管理

### 有效期

- Admin Session：8 小时
- Client Token：原有逻辑不变

### 并发限制

- Admin 最多 5 个活跃 Session
- 第 6 次登录自动删除最旧的 Session
- 用户需在其他设备重新登录

### 过期清理

- 应用启动时自动清理过期 Session
- 每小时定时清理过期 Session
- validate 时发现过期会删除并返回 401

## 部署验证

### 功能验证

```bash
# 1. 登录应返回 Set-Cookie
curl -X POST https://your-domain/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"xxx"}' -v

# 2. Cookie 访问应返回 200
curl https://your-domain/api/auth/me \
  -H "Cookie: session=<from-step-1>" -v

# 3. 登出应清除 Session
curl -X POST https://your-domain/api/auth/logout \
  -H "Cookie: session=<from-step-1>" -v
```

### 安全验证

- [ ] 生产环境 Cookie 包含 `Secure`
- [ ] Cookie 包含 `HttpOnly`
- [ ] Cookie 包含 `SameSite=Strict`
- [ ] XSS 无法读取 Cookie
- [ ] CSRF 请求不携带 Cookie

## 回滚方案

如需回滚：

1. 代码回滚到合并前
2. 清空 Session 表（可选）：`DELETE FROM Session;`
3. Admin 用户需重新登录

## 相关文档

- [spec.md](./spec.md) - 需求规格
- [design.md](./design.md) - 技术设计
- [plan.md](./plan.md) - 实施计划
