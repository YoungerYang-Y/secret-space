import { Injectable, Inject, Logger, OnApplicationBootstrap } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from './media-storage'
import type { MediaStorage } from './media-storage'

export const RETRY_BASE_MS = 60_000
export const RETRY_MAX_MS = 3_600_000

/** 指数退避：60s、120s、240s……封顶 1 小时。attempts 从 1 起。 */
export function backoffMs(attempts: number): number {
  const exp = Math.max(0, attempts - 1)
  return Math.min(RETRY_BASE_MS * 2 ** exp, RETRY_MAX_MS)
}

const ALLOWED_KEY_PREFIX = 'photos/'
const MAX_LAST_ERROR_LENGTH = 500
const URL_PATTERN = /https?:\/\/\S+/gi

@Injectable()
export class MediaDeletionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaDeletionService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
  ) {}

  /**
   * 在调用方事务内持久化删除任务。空值剔除、批内去重；
   * 非 photos/ 前缀或含路径穿越的 key 记录 warn 后跳过。返回登记条数。
   */
  async enqueueMany(keys: string[], tx: Prisma.TransactionClient): Promise<number> {
    const unique = [...new Set(keys.map((k) => (k ?? '').trim()).filter((k) => k.length > 0))]
    const valid = unique.filter((key) => {
      if (!key.startsWith(ALLOWED_KEY_PREFIX) || key.includes('..')) {
        this.logger.warn(`Skipping invalid deletion key: ${key}`)
        return false
      }
      return true
    })
    if (valid.length === 0) return 0
    const now = new Date()
    // 注意：Prisma 5.0 的 SQLite connector 不支持 createMany，逐条 create。
    // 单批数量受业务上限约束（相册单页 ≤10 张 + 封面），开销可忽略。
    for (const key of valid) {
      await tx.mediaDeletionTask.create({ data: { key, nextAttemptAt: now } })
    }
    return valid.length
  }

  /**
   * 唯一执行路径：处理所有到期待办任务。
   * 三个触发点复用：删除请求提交后、应用启动、管理员手动重试。
   */
  async runDueDeletions(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    const due = await this.prisma.mediaDeletionTask.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    })
    let succeeded = 0
    let failed = 0
    for (const task of due) {
      const ok = await this.processOne(task.id)
      if (ok) succeeded += 1
      else failed += 1
    }
    return { processed: due.length, succeeded, failed }
  }

  /** 管理端查询：failing 为派生状态（pending 且 attempts>0）。 */
  async listTasks(status?: 'pending' | 'done' | 'failing', take = 100) {
    const where =
      status === 'failing'
        ? { status: 'pending', attempts: { gt: 0 } }
        : status
          ? { status }
          : {}
    return this.prisma.mediaDeletionTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        key: true,
        status: true,
        attempts: true,
        lastError: true,
        nextAttemptAt: true,
        createdAt: true,
        doneAt: true,
      },
    })
  }

  onApplicationBootstrap(): void {
    void this.runDueDeletions().catch((error) => {
      this.logger.warn(`Startup deletion sweep failed: ${this.sanitizeError(error)}`)
    })
  }

  private async processOne(taskId: string): Promise<boolean> {
    const task = await this.prisma.mediaDeletionTask.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'pending') return true
    try {
      await this.storage.delete(task.key)
      await this.prisma.mediaDeletionTask.update({
        where: { id: task.id },
        data: { status: 'done', doneAt: new Date() },
      })
      return true
    } catch (error) {
      const attempts = task.attempts + 1
      await this.prisma.mediaDeletionTask.update({
        where: { id: task.id },
        data: {
          attempts,
          lastError: this.sanitizeError(error),
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      })
      return false
    }
  }

  /** 错误信息脱敏：剥除 URL，截断长度，保证任务记录不含签名地址或凭据。 */
  private sanitizeError(error: unknown): string {
    const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return raw.replace(URL_PATTERN, '[url-removed]').slice(0, MAX_LAST_ERROR_LENGTH)
  }
}
