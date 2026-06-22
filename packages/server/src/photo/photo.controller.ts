import { Controller, Post, Put, Delete, Body, Param, UseGuards, HttpCode, ParseIntPipe } from '@nestjs/common'
import { PhotoService } from './photo.service'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('photos')
@UseGuards(RolesGuard)
@Roles('admin')
export class PhotoController {
  constructor(private photoService: PhotoService) {}

  @Post('presign')
  @HttpCode(200)
  presign(@Body() body: { provinceCode: string; filename: string; contentType: string }) {
    return this.photoService.presign(body.provinceCode, body.filename, body.contentType)
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: { provinceCode: string; url: string; annotation?: string; order: number }) {
    return this.photoService.create(body)
  }

  @Put('reorder')
  reorder(@Body() body: { provinceCode: string; photoIds: number[] }) {
    return this.photoService.reorder(body.provinceCode, body.photoIds)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { annotation?: string }) {
    return this.photoService.update(id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.photoService.delete(id)
  }
}
