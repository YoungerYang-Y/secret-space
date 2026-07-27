# 管理员会话安全增强

**逻辑版本：** 0.1.0
**追踪项：** DR-003
**Resolved Path:** `docs/active/0.1.0/remediation/dr-003-admin-session/`
**依据：** [spec.md](./spec.md)

## Context

当前 Admin 前端将 JWT 存储在 localStorage，存在以下安全风险：
1. **XSS 攻击**：任何注入的脚本都能读取 `localStorage.getItem('admin_token')` 并窃取令牌
2. **长期有效**：JWT 7 天有效期过长，一旦泄露攻击窗口大
3. **无法撤销**：服务端无法主动使已签发的 JWT 失效

改用 HttpOnly Cookie + 服务端 Session 可解决上述问题：Cookie 对 JS 不可见（防 XSS）、有效期可控、服务端可随时撤销。

**双认证模式**：Admin 使用 Cookie 认证（高安全），Client 继续使用 Bearer Token 认证（短期会话、攻击面小、无需改动）。两者并行支持，非过渡期设计。

## Goal

- 管理员令牌不暴露给页面脚本
- 会话过期、撤销、匿名和越权路径均有测试
- 迁移后后台主流程可用

## Non-Goal

- 不实现 refresh token 机制（当前 Admin 使用场景简单，8 小时有效期足够）
- 不实现多设备会话管理 UI（Session 列表/单个撤销 API 后续 DR 处理）
- 不修改 Client（访客端）的认证方式（Client 使用 Bearer Token，短期会话风险较低）
- 不实现登录审计（成功/失败、IP、时间记录后续 DR 处理）
- 不实现"不活跃超时"（需要 lastAccessedAt 字段，后续 DR 处理）

## Architecture

```mermaid
sequenceDiagram
    participant Admin as Admin 前端
    participant API as NestJS API
    participant Session as Session 表
    participant Prisma as Prisma/SQLite

    Admin->>API: POST /auth/verify { password }
    API->>Prisma: 验证密码
    Prisma-->>API: 验证结果
    API->>Session: 创建 Session 记录
    Session-->>API: sessionId
    API-->>Admin: 200 { role } + Set-Cookie: session=<id>; HttpOnly; Secure; SameSite=Strict

    Admin->>API: GET /photos (Cookie: session=<id>)
    API->>Session: 查询 Session
    Session-->>API: { userId, role, expiresAt }
    API->>API: 验证未过期 + 权限检查
    API-->>Admin: 200 [photos]

    Admin->>API: POST /auth/logout
    API->>Session: 删除 Session
    API-->>Admin: 200 + Clear-Cookie
```

## Interface Contract

### 0. 依赖配置（新增）

**cookie-parser 中间件**：
```typescript
// main.ts
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  // ...
}
```

**package.json 新增**：
```json
"dependencies": {
  "cookie-parser": "^1.4.6"
},
"devDependencies": {
  "@types/cookie-parser": "^1.4.7"
}
```

**环境变量**（说明）：
```bash
# .env / .env.example
# Cookie Secure 属性根据 NODE_ENV 自动判断：
# - NODE_ENV=production → Secure=true（仅 HTTPS）
# - NODE_ENV!=production → Secure=false（允许 HTTP 本地开发）
# 无需手动配置 COOKIE_SECURE
NODE_ENV=development
```

### 1. POST /auth/verify（修改）

**服务 Behavior**：管理员登录、访客/所有者登录

```typescript
// 请求体不变
interface AuthVerifyRequest {
  password: string
}

// 响应体变更：移除 token 字段
interface AuthVerifyResponse {
  role: 'admin' | 'owner' | 'visitor'
  // token: string  // 已移除
}

// 响应 Header 新增
Set-Cookie: session=<sessionId>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=<seconds>
// Max-Age: admin=28800(8h), visitor/owner=86400(24h)
```

**错误码**：
- 401：密码错误
- 429：请求过于频繁（沿用现有速率限制）

### 2. POST /auth/logout（新增）

**服务 Behavior**：主动登出

```typescript
// 无请求体

// 响应
200 OK
Set-Cookie: session=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0

// 错误码
401: 未登录
```

### 3. GET /auth/me（新增）

**服务 Behavior**：页面刷新后恢复会话状态

```typescript
// 无请求体，依赖 Cookie

// 成功响应
200 OK
{ "role": "admin" | "owner" | "visitor" }

// 错误码
401: 未登录或会话已过期
```

### 4. SessionGuard（新增）

**服务 Behavior**：会话验证

新增 SessionGuard 负责**认证**（验证身份、设置 req.user），现有 RolesGuard 只负责**授权**（检查 req.user.role 是否匹配 @Roles()）。

支持双认证模式：Cookie 认证（Admin）+ Bearer Token 认证（Client）。两者并行支持，非过渡期设计。

```typescript
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private sessionService: SessionService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()
    
    // 方式 1：Cookie 认证（Admin 使用）
    const sessionId = request.cookies?.session
    if (sessionId) {
      const session = await this.sessionService.validate(sessionId)
      if (session) {
        request.user = { role: session.role }
        return true
      }
      // Cookie 无效，清除
      this.clearSessionCookie(response)
    }
    
    // 方式 2：Bearer Token 认证（Client 使用，永久支持）
    const auth = request.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7)
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { role: string }
        request.user = { role: payload.role }
        return true
      } catch {
        // Token 无效，继续抛出 401
      }
    }
    
    throw new UnauthorizedException()
  }

  private clearSessionCookie(response: Response) {
    const isProduction = this.configService.get('NODE_ENV') === 'production'
    response.clearCookie('session', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api',
    })
  }
}
```

**RolesGuard 改造**：移除 JWT 验证逻辑，只做授权检查

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler())
    if (!roles) return true // 无 @Roles 装饰器，允许所有已认证用户
    
    const request = context.switchToHttp().getRequest()
    // req.user 由 SessionGuard 设置
    return roles.includes(request.user?.role)
  }
}
```

### 5. SessionService（新增）

**服务 Behavior**：会话验证、会话撤销

```typescript
import { randomBytes } from 'crypto'

const MAX_ADMIN_SESSIONS = 5

@Injectable()
export class SessionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private cleanupInterval: NodeJS.Timeout

  constructor(private prisma: PrismaService) {}

  // 启动时清理过期会话 + 启动定时清理
  async onApplicationBootstrap() {
    const cleaned = await this.cleanupExpired()
    if (cleaned > 0) console.log(`Cleaned ${cleaned} expired sessions`)
    
    // 每小时清理一次过期会话
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60 * 60 * 1000)
  }

  onApplicationShutdown() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval)
  }

  async create(role: string): Promise<string> {
    // admin 最多 5 个活跃 Session，超出时删除最旧的
    if (role === 'admin') {
      const existing = await this.prisma.session.findMany({
        where: { role: 'admin' },
        orderBy: { createdAt: 'asc' }
      })
      if (existing.length >= MAX_ADMIN_SESSIONS) {
        await this.prisma.session.delete({ where: { id: existing[0].id } })
      }
    }

    const expiresAt = role === 'admin' 
      ? new Date(Date.now() + 8 * 60 * 60 * 1000)   // 8h
      : new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24h
    
    // 使用 256-bit 随机数（64 hex chars），比 UUID 更安全
    const id = randomBytes(32).toString('hex')
    
    await this.prisma.session.create({
      data: { id, role, expiresAt }
    })
    return id
  }

  async validate(sessionId: string): Promise<{ role: string } | null> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) return null
    
    if (session.expiresAt < new Date()) {
      // 惰性清理：验证时发现过期则删除
      await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
      return null
    }
    return { role: session.role }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {})
  }

  async revokeAll(): Promise<number> {
    const result = await this.prisma.session.deleteMany()
    return result.count
  }

  // 清理所有过期会话
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })
    return result.count
  }
}
```

### 6. Admin 前端变更

**服务 Behavior**：Admin 前端会话管理

**auth.ts store 变更**：
```typescript
// 旧
const token = ref<string | null>(localStorage.getItem('admin_token'))
const login = async (password: string) => {
  const res = await axios.post('/auth/verify', { password })
  token.value = res.data.token
  localStorage.setItem('admin_token', res.data.token)
}

// 新
const role = ref<string | null>(null)
const isAuthenticated = computed(() => !!role.value)
const initialized = ref(false) // 防止重复请求

// 页面刷新时恢复会话状态（带缓存，避免重复请求）
const initSession = async (force = false) => {
  if (!force && initialized.value) return // 已初始化，跳过
  try {
    const res = await axios.get('/auth/me', { withCredentials: true })
    role.value = res.data.role
  } catch {
    role.value = null
  } finally {
    initialized.value = true
  }
}

const login = async (password: string) => {
  const res = await axios.post('/auth/verify', { password }, { withCredentials: true })
  role.value = res.data.role
  initialized.value = true
}

const logout = async () => {
  await axios.post('/auth/logout', {}, { withCredentials: true })
  role.value = null
  initialized.value = false
}

return { role, isAuthenticated, initialized, initSession, login, logout }
```

**main.ts axios 配置变更**：
```typescript
// 旧
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 新
axios.defaults.withCredentials = true
// 移除 request interceptor，Cookie 自动携带

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除本地状态，跳转登录
      const authStore = useAuthStore()
      authStore.role = null
      router.push({ name: 'login' })
    }
    return Promise.reject(error)
  }
)
```

**router/index.ts 变更**：
```typescript
// 旧
const token = localStorage.getItem('admin_token')
if (!token && to.name !== 'login') return { name: 'login' }

// 新
// 前端不再检查 token，由 API 401 响应触发跳转
// 初始加载时尝试获取当前会话状态
```

## Data Model

### Session 表（新增）

```prisma
model Session {
  id        String   @id // randomBytes(32).toString('hex')，64 chars
  role      String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
  @@index([role]) // 用于 admin session 数量限制查询
}
```

字段说明：
- `id`：256-bit 随机数的 hex 编码（64 字符），作为 Cookie 值，比 UUID 更安全
- `role`：admin/owner/visitor
- `expiresAt`：过期时间，admin=8h，其他=24h
- 索引 `expiresAt` 用于清理过期会话
- 索引 `role` 用于查询 admin session 数量

**并发登录策略**：同一密码多次登录会创建多个独立 Session。admin 最多 5 个活跃 Session，超出时自动删除最旧的。

## Non-Functional Requirements

| 维度 | 指标 |
|------|------|
| 安全 | Cookie: HttpOnly + Secure(NODE_ENV=production) + SameSite=Strict + Path=/api；Session ID 使用 crypto.randomBytes(32) (256 bits) |
| 性能 | 每次请求增加 1 次 Session 表查询（SQLite 单表查询 <1ms） |
| 可用性 | 会话过期后需重新登录，无 refresh 机制 |
| 清理策略 | 惰性清理（验证时）+ 启动时清理 + 每小时定时清理 |
| Session 限制 | admin 最多 5 个活跃 Session |
| 双认证模式 | Admin 用 Cookie，Client 用 Bearer Token，并行支持 |

## Alternatives Considered

| 方案 | 优点 | 缺点 | 不选原因 |
|------|------|------|---------|
| JWT 存 HttpOnly Cookie | 无状态、无需 Session 表 | 无法服务端撤销、过期时间固定 | 无法满足"服务端撤销会话"需求 |
| 双 Token（Access + Refresh） | 可刷新、可撤销 Refresh | 实现复杂、Admin 场景不需要 | 过度设计 |
| Session 存 Redis | 高性能、支持分布式 | 引入新依赖 | 当前单机 SQLite 足够 |

## Testing Strategy

| 测试对象 | 层级 | 验证方法 | 通过标准 |
|---------|------|---------|---------|
| SessionService | 单元 | vitest mock Prisma | create/validate/revoke/cleanupExpired 各场景覆盖；admin max 5 session 限制 |
| SessionGuard | 单元 | vitest mock SessionService | 有效/无效/过期 Cookie 各返回正确状态；Bearer Token 认证正常工作 |
| RolesGuard | 单元 | vitest mock req.user | 仅检查 role，不做认证 |
| POST /auth/verify | 集成 | supertest + 检查 Set-Cookie Header | 正确密码返回 200 + HttpOnly Cookie；错误密码返回 401 无 Cookie |
| POST /auth/logout | 集成 | supertest + 检查 Cookie 清除 | 返回 200 + 清除 Cookie；后续请求 401 |
| GET /auth/me | 集成 | supertest 携带 Cookie | 有效 Cookie 返回 { role }；无/过期 Cookie 返回 401 |
| 受保护 API (Cookie) | 集成 | supertest 携带 Cookie | 有效 Cookie 200；无/过期 Cookie 401 |
| 受保护 API (Bearer) | 集成 | supertest 携带 Bearer Token | Client 用 Bearer Token 仍可访问 |
| Cookie 属性 | 集成 | 检查 Set-Cookie header | 包含 HttpOnly; SameSite=Strict; Path=/api；Secure 根据 NODE_ENV |
| Admin 登录流程 | 组件 | vitest + vue-test-utils | 登录成功不写 localStorage；API 401 跳转登录页 |
| Admin 会话恢复 | 组件 | vitest + vue-test-utils | initSession 成功后 role 有值；失败后 role 为 null；带缓存不重复请求 |
| 并发登录 | 集成 | supertest 两次登录 | 两个 Session 均有效 |
| Admin max session | 集成 | supertest 6 次 admin 登录 | 第 6 次登录后最旧 Session 被删除 |
| Admin 主流程 | E2E | 手动验证 | 照片/相册/省份管理可用 |

## Milestones

| 阶段 | 产出 | 依赖 |
|------|------|------|
| T1 | Session 表 + SessionService + cookie-parser 配置 | 无 |
| T2 | SessionGuard（含向后兼容）+ AuthController 改造（verify/logout/me） | T1 |
| T3 | Admin 前端适配（auth store + axios + router） | T2 |
| T4 | 测试补全 + 回归验证 | T3 |
| T5 | 文档更新 + 部署检查清单 | T4 |
