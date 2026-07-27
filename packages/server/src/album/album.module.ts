import { Module } from '@nestjs/common'
import { AlbumController } from './album.controller'
import { AlbumService } from './album.service'
import { MediaModule } from '../media/media.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [MediaModule, AuthModule],
  controllers: [AlbumController],
  providers: [AlbumService],
})
export class AlbumModule {}
