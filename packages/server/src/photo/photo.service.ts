import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage, ImageExtension, ImageContentType } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'
import { ProvinceService } from '../province/province.service'
import { extname } from 'path'

const ALLOWED_CONTENT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp']

const PHOTO_PREFIXES = ['photos/']

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private mediaRef: MediaReferenceService,
    private provinceService: ProvinceService,
  ) {}

  async presign(provinceCode: string, filename: string, contentType: string) {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException('不支持的文件类型，仅允许 image/jpeg、image/png、image/webp')
    }
    const ext = extname(filename) || '.webp'
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException('不支持的文件扩展名，仅允许 .jpg、.jpeg、.png、.webp')
    }
    await this.provinceService.findByCode(provinceCode)
    return this.storage.presignPhotoUpload(provinceCode, ext as ImageExtension, contentType as ImageContentType)
  }

  async create(data: { provinceCode: string; mediaRef: string; annotation?: string; order: number }) {
    await this.provinceService.findByCode(data.provinceCode)
    const ref = this.mediaRef.fromMediaRef(data.mediaRef, PHOTO_PREFIXES)
    const logicalKey = this.mediaRef.toLogicalKey(ref, PHOTO_PREFIXES)
    const photo = await this.prisma.photo.create({
      data: {
        provinceCode: data.provinceCode,
        url: ref,
        key: logicalKey,
        annotation: data.annotation,
        order: data.order,
      },
    })
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
    await this.prisma.$transaction(
      photoIds.map((id, i) => this.prisma.photo.update({ where: { id }, data: { order: i } })),
    )
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
    if (photo.key) {
      await this.storage.delete(photo.key)
    }
    await this.prisma.photo.delete({ where: { id } })
  }
}
