import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common'

@Injectable()
export class RateLimitGuard implements CanActivate {
  static attempts = new Map<string, { count: number; windowStart: number }>()
  private static cleanupTimer: ReturnType<typeof setInterval> | null = null

  static {
    // 每 10 分钟清理过期条目
    RateLimitGuard.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const window = 5 * 60 * 1000
      for (const [ip, record] of RateLimitGuard.attempts) {
        if (now - record.windowStart >= window) {
          RateLimitGuard.attempts.delete(ip)
        }
      }
    }, 10 * 60 * 1000)
    // 允许进程正常退出
    if (RateLimitGuard.cleanupTimer.unref) RateLimitGuard.cleanupTimer.unref()
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const ip = req.ip || req.connection?.remoteAddress || 'unknown'
    const now = Date.now()
    const window = 5 * 60 * 1000
    const record = RateLimitGuard.attempts.get(ip)
    if (record && now - record.windowStart < window) {
      if (record.count >= 10) {
        const retryAfter = Math.ceil((record.windowStart + window - now) / 1000)
        throw new HttpException({ message: '休息一下再试吧', retryAfter }, 429)
      }
    } else if (record) {
      RateLimitGuard.attempts.delete(ip)
    }
    req._rateLimitIp = ip
    return true
  }

  static recordFailure(ip: string) {
    const now = Date.now()
    const window = 5 * 60 * 1000
    const record = RateLimitGuard.attempts.get(ip)
    if (record && now - record.windowStart < window) {
      record.count++
    } else {
      RateLimitGuard.attempts.set(ip, { count: 1, windowStart: now })
    }
  }
}
