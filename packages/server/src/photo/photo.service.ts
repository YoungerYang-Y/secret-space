import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { R2Service } from '../r2/r2.service'
import { extname } from 'path'

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  async presign(provinceCode: string, filename: string, contentType: string) {
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('不支持的文件类型')
    }
    const ext = extname(filename) || '.webp'
    return this.r2.presign(provinceCode, ext, contentType)
  }

  async create(data: { provinceCode: string; url: string; annotation?: string; order: number }) {
    const photo = await this.prisma.photo.create({ data })
    return { id: photo.id, url: photo.url, annotation: photo.annotation, order: photo.order }
  }

  async reorder(provinceCode: string, photoIds: number[]) {
    const existing = await this.prisma.photo.findMany({ where: { provinceCode }, select: { id: true } })
    if (existing.length !== photoIds.length) {
      throw new BadRequestException('照片ID列表与实际数量不匹配')
    }
    const existingIds = new Set(existing.map((p) => p.id))
    if (photoIds.some((id) => !existingIds.has(id))) {
      throw new BadRequestException('包含无效的照片ID')
    }
    for (let i = 0; i < photoIds.length; i++) {
      await this.prisma.photo.update({ where: { id: photoIds[i] }, data: { order: i } })
    }
    return this.prisma.photo.findMany({
      where: { provinceCode },
      orderBy: { order: 'asc' },
      select: { id: true, url: true, annotation: true, order: true },
    })
  }

  async update(id: number, data: { annotation?: string }) {
    const photo = await this.prisma.photo.findUnique({ where: { id } })
    if (!photo) throw new NotFoundException('照片不存在')
    const updated = await this.prisma.photo.update({ where: { id }, data })
    return { id: updated.id, url: updated.url, annotation: updated.annotation, order: updated.order }
  }

  async delete(id: number) {
    const photo = await this.prisma.photo.findUnique({ where: { id } })
    if (!photo) throw new NotFoundException('照片不存在')
    await this.prisma.photo.delete({ where: { id } })
    // Best-effort R2 cleanup
    const key = photo.url.replace(/^https?:\/\/[^/]+\//, '')
    await this.r2.delete(key)
  }
}
