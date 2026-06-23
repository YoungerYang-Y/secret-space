import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProvinceService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const provinces = await this.prisma.province.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { photos: true } } },
    })
    return provinces.map((p) => ({
      code: p.code,
      name: p.name,
      visited: p.visited,
      photoCount: p._count.photos,
    }))
  }

  async findByCode(code: string) {
    const province = await this.prisma.province.findUnique({ where: { code } })
    if (!province) throw new NotFoundException('省份不存在')
    return province
  }

  async update(code: string, data: { visited: boolean }) {
    await this.findByCode(code)
    const updated = await this.prisma.province.update({
      where: { code },
      data: { visited: data.visited },
      include: { _count: { select: { photos: true } } },
    })
    return { code: updated.code, name: updated.name, visited: updated.visited, photoCount: updated._count.photos }
  }

  async findPhotosByCode(code: string) {
    return this.prisma.photo.findMany({
      where: { provinceCode: code },
      orderBy: { order: 'asc' },
      select: { id: true, url: true, annotation: true, order: true },
    })
  }
}
