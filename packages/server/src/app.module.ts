import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { TipsModule } from './tips/tips.module'

@Module({
  imports: [PrismaModule, HealthModule, TipsModule],
})
export class AppModule {}
