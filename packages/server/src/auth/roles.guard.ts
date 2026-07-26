import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
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
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!requiredRoles) return true

    const req = context.switchToHttp().getRequest()

    // SessionGuard 应该已经设置了 req.user
    if (!req.user) {
      throw new UnauthorizedException('未登录')
    }

    // 检查角色权限
    if (!requiredRoles.includes(req.user.role)) {
      throw new ForbiddenException('权限不足')
    }

    // 检查 token 是否在密码修改前签发（仅对 Bearer Token 认证有效）
    if (req.user.iat != null) {
      const cutoff = await this.getInvalidationCutoff()
      if (cutoff && req.user.iat < cutoff) {
        throw new UnauthorizedException('登录已过期')
      }
    }

    return true
  }

  private async getInvalidationCutoff(): Promise<number | null> {
    const now = Date.now()
    if (
      RolesGuard.tokenInvalidatedBefore !== null &&
      now - RolesGuard.cacheTime < 60_000
    ) {
      return RolesGuard.tokenInvalidatedBefore
    }
    const config = await this.prisma.config.findUnique({
      where: { key: 'token_invalidated_before' },
    })
    RolesGuard.tokenInvalidatedBefore = config ? Number(config.value) : 0
    RolesGuard.cacheTime = now
    return RolesGuard.tokenInvalidatedBefore
  }

  static resetCache() {
    RolesGuard.tokenInvalidatedBefore = null
  }
}
