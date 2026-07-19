import { Module } from '@nestjs/common'
import { ProvinceController } from './province.controller'
import { ProvinceService } from './province.service'
import { MediaModule } from '../media/media.module'

@Module({
  imports: [MediaModule],
  controllers: [ProvinceController],
  providers: [ProvinceService],
  exports: [ProvinceService],
})
export class ProvinceModule {}
