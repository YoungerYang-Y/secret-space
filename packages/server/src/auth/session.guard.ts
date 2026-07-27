import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { SessionService } from './session.service'
import { JWT_SECRET } from './auth.service'

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const response = context.switchToHttp().getResponse()

    // 1. 优先尝试 Cookie 认证（Admin 使用）
    const sessionId = request.cookies?.session
    if (sessionId) {
      const session = await this.sessionService.validate(sessionId)
      if (session) {
        request.user = { role: session.role }
        return true
      }

      // Cookie 无效，清除它
      const isProduction = process.env.NODE_ENV === 'production'
      response.clearCookie('session', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/api',
      })
    }

    // 2. 尝试 Bearer Token 认证（Client 使用）
    const auth = request.headers.authorization
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
          role: string
          iat?: number
        }
        request.user = { role: payload.role, iat: payload.iat }
        return true
      } catch {
        // Token 无效，继续到下面抛出异常
      }
    }

    // 3. 两者都无效
    throw new UnauthorizedException('未登录')
  }
}
