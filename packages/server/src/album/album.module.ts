import { Module } from '@nestjs/common'
import { AlbumController } from './album.controller'
import { AlbumService } from './album.service'
import { R2Module } from '../r2/r2.module'

@Module({
  imports: [R2Module],
  controllers: [AlbumController],
  providers: [AlbumService],
})
export class AlbumModule {}
