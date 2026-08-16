import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  Req,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { SessionService } from './session.service'
import { RateLimitGuard } from './rate-limit.guard'
import { SessionGuard } from './session.guard'
import { VerifyDto } from './dto/verify.dto'

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
  ) {}

  @Post('verify')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  async verify(
    @Body() body: VerifyDto,
    @Req() req: Request & { _rateLimitIp?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verify(
      body.password,
      req._rateLimitIp || req.ip || 'unknown',
    )

    // 创建 Session 并设置 Cookie
    const sessionId = await this.sessionService.create(result.role)
    const isProduction = process.env.NODE_ENV === 'production'
    const maxAge =
      result.role === 'admin' ? 8 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000

    res.cookie('session', sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api',
      maxAge,
    })

    // 不再返回 token
    return { role: result.role }
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.session
    if (sessionId) {
      await this.sessionService.revoke(sessionId)
    }

    const isProduction = process.env.NODE_ENV === 'production'
    res.clearCookie('session', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api',
    })

    return { success: true }
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: Request & { user: { role: string } }) {
    return { role: req.user.role }
  }
}
