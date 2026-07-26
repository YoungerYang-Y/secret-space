import { Injectable, Inject, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
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
    const reads = new Map<string, Promise<string>>()
    return Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        url: await this.signUrl(photo.url, reads),
      })),
    )
  }

  private async signUrl(url: string, reads: Map<string, Promise<string>>): Promise<string> {
    try {
      if (!url.startsWith(MEDIA_PROTOCOL)) throw new Error('not a media reference')
      const key = this.mediaRef.toLogicalKey(url as `media://${string}`, PHOTO_PREFIXES)
      const existing = reads.get(key)
      if (existing) return existing
      const read = this.storage.presignRead(key).catch(() => {
        throw new ServiceUnavailableException('媒体服务暂不可用')
      })
      reads.set(key, read)
      return read
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('媒体内容暂不可用')
    }
  }
}
