import { Module } from '@nestjs/common'
import { AlbumController } from './album.controller'
import { AlbumService } from './album.service'
import { MediaModule } from '../media/media.module'

@Module({
  imports: [MediaModule],
  controllers: [AlbumController],
  providers: [AlbumService],
})
export class AlbumModule {}
