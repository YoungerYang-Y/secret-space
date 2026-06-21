import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RateLimitGuard } from './rate-limit.guard'
import { AuthVerifyResponse } from '@secret-space/shared'
import * as bcrypt from 'bcrypt'
import * as jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production')
  return 'secret-space-dev-key'
})()

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async verify(password: string, ip: string): Promise<AuthVerifyResponse> {
    const ownerHash = await this.prisma.config.findUnique({ where: { key: 'owner_password_hash' } })
    if (ownerHash && await bcrypt.compare(password, ownerHash.value)) {
      return { token: this.signToken('owner'), role: 'owner' }
    }
    const visitorHash = await this.prisma.config.findUnique({ where: { key: 'visitor_password_hash' } })
    if (visitorHash && await bcrypt.compare(password, visitorHash.value)) {
      return { token: this.signToken('visitor'), role: 'visitor' }
    }
    RateLimitGuard.recordFailure(ip)
    throw new UnauthorizedException('密码不对哦')
  }

  private signToken(role: string): string {
    return jwt.sign({ role }, JWT_SECRET, { expiresIn: '7d' })
  }
}
