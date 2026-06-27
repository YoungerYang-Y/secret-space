import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common'
import { ProvinceService } from './province.service'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('provinces')
@UseGuards(RolesGuard)
export class ProvinceController {
  constructor(private provinceService: ProvinceService) {}

  @Get()
  @Roles('visitor', 'owner', 'admin')
  findAll() {
    return this.provinceService.findAll()
  }

  @Get(':code/photos')
  @Roles('visitor', 'owner', 'admin')
  async findPhotos(@Param('code') code: string) {
    await this.provinceService.findByCode(code)
    return this.provinceService.findPhotosByCode(code)
  }

  @Put(':code')
  @Roles('admin')
  update(@Param('code') code: string, @Body() body: { visited: boolean }) {
    return this.provinceService.update(code, body)
  }
}
