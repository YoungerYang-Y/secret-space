import { Module } from '@nestjs/common'
import { PhotoController } from './photo.controller'
import { PhotoService } from './photo.service'
import { MediaModule } from '../media/media.module'
import { ProvinceModule } from '../province/province.module'

@Module({
  imports: [MediaModule, ProvinceModule],
  controllers: [PhotoController],
  providers: [PhotoService],
})
export class PhotoModule {}
