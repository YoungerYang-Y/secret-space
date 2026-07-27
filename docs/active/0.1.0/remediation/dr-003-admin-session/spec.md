# 管理员会话安全增强

**逻辑版本：** 0.1.0
**追踪项：** DR-003
**Resolved Path:** `docs/active/0.1.0/remediation/dr-003-admin-session/`

## Overview

管理员令牌改为 HttpOnly Cookie 存储，不暴露给页面脚本；会话支持过期和撤销；匿名与越权访问有明确拒绝行为。

---

## Behavior: 管理员登录

### Scenario: 正确密码登录成功

Given 管理员密码已配置
When 用户提交正确的管理员密码
Then 响应状态为 200
And 响应体包含 `{ role: "admin" }` 但不包含 token 字段
And 响应设置 HttpOnly、Secure、SameSite=Strict 的会话 Cookie
And Cookie 有效期为 8 小时

### Scenario: 错误密码登录失败

Given 管理员密码已配置
When 用户提交错误密码
Then 响应状态为 401
And 响应体包含错误消息
And 不设置任何会话 Cookie

### Scenario: 访客/所有者登录

Given 访客或所有者密码已配置
When 用户提交正确的访客或所有者密码
Then 响应状态为 200
And 响应体包含对应 role（visitor/owner）但不包含 token 字段
And 响应设置 HttpOnly、Secure、SameSite=Strict 的会话 Cookie
And Cookie 有效期为 24 小时

---

## Behavior: 会话验证

### Scenario: 有效会话访问受保护资源

Given 用户持有有效的管理员会话 Cookie
When 用户访问管理员专属 API（如 POST /photos）
Then 请求正常处理
And 响应状态为 2xx

### Scenario: 无会话访问受保护资源

Given 用户未持有任何会话 Cookie
When 用户访问管理员专属 API
Then 响应状态为 401
And 响应体包含错误消息

### Scenario: 过期会话访问受保护资源

Given 用户持有已过期的会话 Cookie（超过 8 小时）
When 用户访问管理员专属 API
Then 响应状态为 401
And 响应体包含错误消息
And 响应清除过期的会话 Cookie

### Scenario: 权限不足访问管理员资源

Given 用户持有有效的访客会话 Cookie
When 用户访问管理员专属 API（如 DELETE /photos/:id）
Then 响应状态为 403
And 响应体包含权限不足的错误消息

---

## Behavior: 会话撤销

### Scenario: 主动登出

Given 用户持有有效的会话 Cookie
When 用户调用登出接口（POST /auth/logout）
Then 响应状态为 200
And 响应清除会话 Cookie
And 后续使用同一 Cookie 的请求返回 401

### Scenario: 服务端撤销会话

Given 管理员在服务端撤销某用户会话
When 被撤销的用户尝试访问受保护资源
Then 响应状态为 401
And 响应清除会话 Cookie

---

## Behavior: Admin 前端会话管理

### Scenario: 登录后访问后台

Given 用户未登录（无会话 Cookie）
When 用户访问后台页面
Then 重定向到登录页

### Scenario: 登录成功跳转

Given 用户在登录页
When 用户提交正确密码并收到成功响应
Then 跳转到后台首页
And 前端不在 localStorage/sessionStorage 存储任何令牌

### Scenario: 页面刷新后保持登录

Given 用户已登录并持有有效会话 Cookie
When 用户刷新页面
Then 前端调用会话状态接口获取当前角色
And 用户保持登录状态，无需重新输入密码

### Scenario: 会话过期后操作

Given 用户已登录并在后台操作
When 会话过期后用户发起 API 请求
Then API 返回 401
And 前端提示"会话已过期"
And 跳转到登录页

### Scenario: 并发登录（多设备）

Given 用户已在设备 A 登录
When 用户在设备 B 使用相同密码登录
Then 设备 B 登录成功，获得新的会话 Cookie
And 设备 A 的会话仍然有效（允许多会话共存）

---

## Constraints

- Cookie 属性：HttpOnly（JS 不可读）、Secure（仅 HTTPS 传输，NODE_ENV=production 时启用）、SameSite=Strict（防 CSRF）、Path=/api（仅 API 请求携带）
- 会话有效期：管理员 8 小时、访客/所有者 24 小时
- 会话存储：服务端 SQLite 表，支持查询和撤销
- Session 数量限制：admin 最多 5 个活跃 Session，超出时删除最旧的
- 双认证模式：Admin 使用 Cookie 认证（防 XSS）；Client 继续使用 Bearer Token 认证（短期会话，风险较低）
- Guard 分工：SessionGuard 负责认证（验证 Cookie/Token，设置 req.user）；RolesGuard 负责授权（检查 req.user.role）
- 迁移后：Admin 主流程（照片管理、相册管理、省份管理）可用
