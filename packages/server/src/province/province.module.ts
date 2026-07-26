import { Module } from '@nestjs/common'
import { ProvinceController } from './province.controller'
import { ProvinceService } from './province.service'
import { MediaModule } from '../media/media.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [MediaModule, AuthModule],
  controllers: [ProvinceController],
  providers: [ProvinceService],
  exports: [ProvinceService],
})
export class ProvinceModule {}
