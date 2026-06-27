import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwt from 'jsonwebtoken'
import { ROLES_KEY } from './roles.decorator'
import { JWT_SECRET } from './auth.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RolesGuard implements CanActivate {
  private static tokenInvalidatedBefore: number | null = null
  private static cacheTime = 0

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles) return true

    const req = context.switchToHttp().getRequest()
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('未登录')

    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { role: string; iat?: number }
      if (!requiredRoles.includes(payload.role)) throw new ForbiddenException('权限不足')

      // Check if token was issued before password change
      if (payload.iat != null) {
        const cutoff = await this.getInvalidationCutoff()
        if (cutoff && payload.iat < cutoff) throw new UnauthorizedException('登录已过期')
      }

      req.user = payload
      return true
    } catch (e) {
      if (e instanceof ForbiddenException) throw e
      if (e instanceof UnauthorizedException) throw e
      throw new UnauthorizedException('登录已过期')
    }
  }

  private async getInvalidationCutoff(): Promise<number | null> {
    const now = Date.now()
    if (RolesGuard.tokenInvalidatedBefore !== null && now - RolesGuard.cacheTime < 60_000) {
      return RolesGuard.tokenInvalidatedBefore
    }
    const config = await this.prisma.config.findUnique({ where: { key: 'token_invalidated_before' } })
    RolesGuard.tokenInvalidatedBefore = config ? Number(config.value) : 0
    RolesGuard.cacheTime = now
    return RolesGuard.tokenInvalidatedBefore
  }

  static resetCache() {
    RolesGuard.tokenInvalidatedBefore = null
  }
}
