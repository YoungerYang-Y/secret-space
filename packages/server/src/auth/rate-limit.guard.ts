import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common'

@Injectable()
export class RateLimitGuard implements CanActivate {
  static attempts = new Map<string, { count: number; windowStart: number }>()

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
