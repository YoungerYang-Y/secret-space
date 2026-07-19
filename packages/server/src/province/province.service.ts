import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'

const PHOTO_PREFIXES = ['photos/']
const MEDIA_PROTOCOL = 'media://'

@Injectable()
export class ProvinceService {
  constructor(
    private prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private mediaRef: MediaReferenceService,
  ) {}

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
    const photos = await this.prisma.photo.findMany({
      where: { provinceCode: code },
      orderBy: { order: 'asc' },
      select: { id: true, url: true, annotation: true, order: true },
    })
    return Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        url: await this.signUrl(photo.url),
      })),
    )
  }

  private async signUrl(url: string): Promise<string> {
    if (url.startsWith(MEDIA_PROTOCOL)) {
      const key = this.mediaRef.toLogicalKey(url as `media://${string}`, PHOTO_PREFIXES)
      return this.storage.presignRead(key)
    }
    // Legacy URL: convert to media ref then sign
    const ref = this.mediaRef.fromLegacyUrl(url, PHOTO_PREFIXES)
    const key = this.mediaRef.toLogicalKey(ref, PHOTO_PREFIXES)
    return this.storage.presignRead(key)
  }
}
