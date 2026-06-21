import { Controller, Post, Body, UseGuards, HttpCode, Req } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RateLimitGuard } from './rate-limit.guard'
import { VerifyDto } from './dto/verify.dto'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('verify')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  verify(@Body() body: VerifyDto, @Req() req: any) {
    return this.authService.verify(body.password, req._rateLimitIp || req.ip || 'unknown')
  }
}
