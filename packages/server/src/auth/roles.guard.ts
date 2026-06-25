import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwt from 'jsonwebtoken'
import { ROLES_KEY } from './roles.decorator'
import { JWT_SECRET } from './auth.service'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles) return true

    const req = context.switchToHttp().getRequest()
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('未登录')

    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { role: string }
      if (!requiredRoles.includes(payload.role)) throw new ForbiddenException('权限不足')
      req.user = payload
      return true
    } catch (e) {
      if (e instanceof ForbiddenException) throw e
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('登录已过期')
    }
  }
}
