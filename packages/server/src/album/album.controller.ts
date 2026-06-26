import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common'
import { AlbumService } from './album.service'
import { CreateAlbumDto, UpdateAlbumDto, CreatePageDto, UpdatePageDto, ReorderPagesDto } from './dto/album.dto'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { R2Service } from '../r2/r2.service'
import { extname } from 'path'

@Controller()
export class AlbumController {
  constructor(
    private albumService: AlbumService,
    private r2: R2Service,
  ) {}

  @Get('albums')
  findAll() {
    return this.albumService.findAll()
  }

  @Post('albums/presign')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  async presign(@Body() body: { filename: string; contentType: string }) {
    const ext = extname(body.filename) || '.webp'
    return this.r2.presign('album', ext, body.contentType)
  }

  @Get('albums/:id/pages')
  findPages(@Param('id') id: string) {
    return this.albumService.findPages(id)
  }

  @Post('albums')
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateAlbumDto) {
    return this.albumService.create(dto)
  }

  @Put('albums/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateAlbumDto) {
    return this.albumService.update(id, dto)
  }

  @Delete('albums/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.albumService.delete(id)
  }

  @Post('albums/:id/pages')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createPage(@Param('id') id: string, @Body() dto: CreatePageDto) {
    return this.albumService.createPage(id, dto)
  }

  @Put('pages/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.albumService.updatePage(id, dto)
  }

  @Delete('pages/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(204)
  deletePage(@Param('id') id: string) {
    return this.albumService.deletePage(id)
  }

  @Put('albums/:id/pages/reorder')
  @UseGuards(RolesGuard)
  @Roles('admin')
  reorderPages(@Param('id') id: string, @Body() dto: ReorderPagesDto) {
    return this.albumService.reorderPages(id, dto)
  }
}
