import { Module } from '@nestjs/common'
import { TipsController } from './tips.controller'
import { TipsService } from './tips.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [TipsController],
  providers: [TipsService],
})
export class TipsModule {}
