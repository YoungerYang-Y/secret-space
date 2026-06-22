import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { TipsModule } from './tips/tips.module'

@Module({
  imports: [PrismaModule, HealthModule, TipsModule, AuthModule],
})
export class AppModule {}
