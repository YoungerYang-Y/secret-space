import { Module } from '@nestjs/common'
import { PhotoController } from './photo.controller'
import { PhotoService } from './photo.service'
import { R2Module } from '../r2/r2.module'
import { ProvinceModule } from '../province/province.module'

@Module({
  imports: [R2Module, ProvinceModule],
  controllers: [PhotoController],
  providers: [PhotoService],
})
export class PhotoModule {}
