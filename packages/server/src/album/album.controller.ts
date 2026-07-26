import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, Inject, BadRequestException } from '@nestjs/common'
import { AlbumService } from './album.service'
import { CreateAlbumDto, UpdateAlbumDto, CreatePageDto, UpdatePageDto, ReorderPagesDto, AlbumPresignDto } from './dto/album.dto'
import { SessionGuard } from '../auth/session.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage, ImageExtension, ImageContentType } from '../media/media-storage'
import { extname } from 'path'

const ALLOWED_CONTENT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp']

@Controller()
@UseGuards(SessionGuard, RolesGuard)
export class AlbumController {
  constructor(
    private albumService: AlbumService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
  ) {}

  @Get('albums')
  @Roles('visitor', 'owner', 'admin')
  findAll() {
    return this.albumService.findAll()
  }

  @Post('albums/presign')
  @Roles('admin')
  @HttpCode(200)
  async presign(@Body() body: AlbumPresignDto) {
    if (!ALLOWED_CONTENT_TYPES.includes(body.contentType)) {
      throw new BadRequestException('不支持的文件类型，仅允许 image/jpeg、image/png、image/webp')
    }
    const ext = extname(body.filename) || '.webp'
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('不支持的文件扩展名，仅允许 .jpg、.jpeg、.png、.webp')
    }
    return this.storage.presignAlbumUpload(ext as ImageExtension, body.contentType as ImageContentType)
  }

  @Get('albums/:id/pages')
  @Roles('visitor', 'owner', 'admin')
  findPages(@Param('id') id: string) {
    return this.albumService.findPages(id)
  }

  @Post('albums')
  @Roles('admin')
  create(@Body() dto: CreateAlbumDto) {
    return this.albumService.create(dto)
  }

  @Put('albums/:id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateAlbumDto) {
    return this.albumService.update(id, dto)
  }

  @Delete('albums/:id')
  @Roles('admin')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.albumService.delete(id)
  }

  @Post('albums/:id/pages')
  @Roles('admin')
  createPage(@Param('id') id: string, @Body() dto: CreatePageDto) {
    return this.albumService.createPage(id, dto)
  }

  @Put('pages/:id')
  @Roles('admin')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.albumService.updatePage(id, dto)
  }

  @Delete('pages/:id')
  @Roles('admin')
  @HttpCode(204)
  deletePage(@Param('id') id: string) {
    return this.albumService.deletePage(id)
  }

  @Put('albums/:id/pages/reorder')
  @Roles('admin')
  reorderPages(@Param('id') id: string, @Body() dto: ReorderPagesDto) {
    return this.albumService.reorderPages(id, dto)
  }
}
