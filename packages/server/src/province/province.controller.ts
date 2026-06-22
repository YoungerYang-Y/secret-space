import { Controller, Get, Param } from '@nestjs/common'
import { ProvinceService } from './province.service'

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
}
