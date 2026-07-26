import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionService } from './session.service'
import { SessionGuard } from './session.guard'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, SessionGuard],
  exports: [AuthService, SessionService, SessionGuard],
})
export class AuthModule {}
