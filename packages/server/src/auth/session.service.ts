import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'

const MAX_ADMIN_SESSIONS = 5
const ADMIN_SESSION_HOURS = 8
const DEFAULT_SESSION_HOURS = 24
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 小时

@Injectable()
export class SessionService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    // 启动时清理过期会话
    await this.cleanupExpired()
    // 每小时定时清理
    this.cleanupInterval = setInterval(
      () => this.cleanupExpired(),
      CLEANUP_INTERVAL_MS,
    )
  }

  onApplicationShutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 创建新会话
   * @param role 用户角色
   * @returns 64 字符 hex session ID
   */
  async create(role: string): Promise<string> {
    // admin 角色限制最多 5 个活跃 session
    if (role === 'admin') {
      const existingSessions = await this.prisma.session.findMany({
        where: { role: 'admin' },
        orderBy: { createdAt: 'asc' },
      })

      if (existingSessions.length >= MAX_ADMIN_SESSIONS) {
        // 删除最旧的 session
        const toDelete = existingSessions.slice(
          0,
          existingSessions.length - MAX_ADMIN_SESSIONS + 1,
        )
        await this.prisma.session.deleteMany({
          where: { id: { in: toDelete.map((s) => s.id) } },
        })
      }
    }

    const id = randomBytes(32).toString('hex')
    const hours = role === 'admin' ? ADMIN_SESSION_HOURS : DEFAULT_SESSION_HOURS
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

    await this.prisma.session.create({
      data: { id, role, expiresAt },
    })

    return id
  }

  /**
   * 验证会话
   * @param sessionId session ID
   * @returns 有效返回 { role }，无效/过期返回 null
   */
  async validate(sessionId: string): Promise<{ role: string } | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return null
    }

    // 检查是否过期
    if (session.expiresAt < new Date()) {
      // 删除过期记录
      await this.prisma.session.delete({ where: { id: sessionId } })
      return null
    }

    return { role: session.role }
  }

  /**
   * 撤销会话
   * @param sessionId session ID
   */
  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId },
    })
  }

  /**
   * 清理所有过期会话
   * @returns 删除的记录数
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return result.count
  }
}
