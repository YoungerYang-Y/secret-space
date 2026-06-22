import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common'
import { ProvinceService } from './province.service'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('provinces')
export class ProvinceController {
  constructor(private provinceService: ProvinceService) {}

  @Get()
  findAll() {
    return this.provinceService.findAll()
  }

  @Get(':code/photos')
  async findPhotos(@Param('code') code: string) {
    await this.provinceService.findByCode(code)
    return this.provinceService.findPhotosByCode(code)
  }

  @Put(':code')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('code') code: string, @Body() body: { visited: boolean }) {
    return this.provinceService.update(code, body)
  }
}
