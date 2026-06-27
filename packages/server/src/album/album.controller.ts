import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, BadRequestException } from '@nestjs/common'
import { AlbumService } from './album.service'
import { CreateAlbumDto, UpdateAlbumDto, CreatePageDto, UpdatePageDto, ReorderPagesDto, AlbumPresignDto } from './dto/album.dto'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { R2Service } from '../r2/r2.service'
import { extname } from 'path'

@Controller()
@UseGuards(RolesGuard)
export class AlbumController {
  constructor(
    private albumService: AlbumService,
    private r2: R2Service,
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
    if (!body.contentType?.startsWith('image/')) {
      throw new BadRequestException('不支持的文件类型')
    }
    const ext = extname(body.filename) || '.webp'
    return this.r2.presign('album', ext, body.contentType)
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
