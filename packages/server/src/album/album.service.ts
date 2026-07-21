import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'
import { MediaDeletionService } from '../media/media-deletion.service'
import { CreateAlbumDto, UpdateAlbumDto, CreatePageDto, UpdatePageDto, ReorderPagesDto } from './dto/album.dto'

const ALBUM_PREFIXES = ['photos/']
const MEDIA_PROTOCOL = 'media://'

@Injectable()
export class AlbumService {
  private readonly logger = new Logger(AlbumService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private mediaRef: MediaReferenceService,
    private deletion: MediaDeletionService,
  ) {}

  async findAll() {
    const albums = await this.prisma.album.findMany({ orderBy: { year: 'asc' } })
    return Promise.all(
      albums.map(async (album) => ({
        ...album,
        coverUrl: album.coverUrl ? await this.signUrl(album.coverUrl) : null,
      })),
    )
  }

  async findPages(albumId: string) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    const pages = await this.prisma.page.findMany({ where: { albumId }, orderBy: { order: 'asc' } })
    return Promise.all(
      pages.map(async (page) => ({
        ...page,
        content: await this.signPageContent(page.content),
      })),
    )
  }

  async create(dto: CreateAlbumDto) {
    const existing = await this.prisma.album.findUnique({ where: { year: dto.year } })
    if (existing) throw new ConflictException(`Album for year ${dto.year} already exists`)
    const data: { year: number; title?: string; coverUrl?: string } = { year: dto.year, title: dto.title }
    if (dto.coverRef) {
      const ref = this.mediaRef.fromMediaRef(dto.coverRef, ALBUM_PREFIXES)
      data.coverUrl = ref
    }
    return this.prisma.album.create({ data })
  }

  async update(id: string, dto: UpdateAlbumDto) {
    const album = await this.prisma.album.findUnique({ where: { id } })
    if (!album) throw new NotFoundException('Album not found')
    if (dto.year !== undefined && dto.year !== album.year) {
      const conflict = await this.prisma.album.findUnique({ where: { year: dto.year } })
      if (conflict) throw new ConflictException(`Album for year ${dto.year} already exists`)
    }
    const data: { year?: number; title?: string; coverUrl?: string } = {}
    if (dto.year !== undefined) data.year = dto.year
    if (dto.title !== undefined) data.title = dto.title
    if (dto.coverRef !== undefined) {
      const ref = this.mediaRef.fromMediaRef(dto.coverRef, ALBUM_PREFIXES)
      data.coverUrl = ref
    }
    return this.prisma.album.update({ where: { id }, data })
  }

  async delete(id: string) {
    const album = await this.prisma.album.findUnique({ where: { id }, include: { pages: true } })
    if (!album) throw new NotFoundException('Album not found')
    const keys = this.collectAlbumKeys(album)
    // 删除任务与业务删除同事务：封面与全部页面图片的对象删除最终一致
    await this.prisma.$transaction(async (tx) => {
      await this.deletion.enqueueMany(keys, tx)
      await tx.album.delete({ where: { id } })
    })
    await this.deletion.runDueDeletions()
  }

  /** 从持久化引用收集 key：封面 + 各页图片；仅 media:// 引用，其余跳过并 warn。 */
  private collectAlbumKeys(album: { coverUrl: string | null; pages: { content: string }[] }): string[] {
    const keys: string[] = []
    if (album.coverUrl) {
      const key = this.keyFromRef(album.coverUrl)
      if (key) keys.push(key)
    }
    for (const page of album.pages) {
      keys.push(...this.collectPageKeys(page.content))
    }
    return keys
  }

  private collectPageKeys(contentStr: string): string[] {
    try {
      const content = JSON.parse(contentStr)
      const images: unknown[] = Array.isArray(content.images) ? content.images : []
      const keys: string[] = []
      for (const img of images) {
        if (typeof img === 'string') {
          const key = this.keyFromRef(img)
          if (key) keys.push(key)
        }
      }
      return keys
    } catch {
      this.logger.warn('页面内容解析失败，跳过其图片删除登记')
      return []
    }
  }

  /** key 只来自持久化的 media:// 引用；不从公开 URL 反解析。 */
  private keyFromRef(ref: string): string | null {
    if (!ref.startsWith(MEDIA_PROTOCOL)) {
      this.logger.warn('跳过非 media:// 引用的删除登记')
      return null
    }
    try {
      return this.mediaRef.toLogicalKey(ref as `media://${string}`, ALBUM_PREFIXES)
    } catch {
      this.logger.warn('无效 media:// 引用，跳过删除登记')
      return null
    }
  }

  async createPage(albumId: string, dto: CreatePageDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    // Validate media references in images
    this.validatePageImages(dto.content.images)
    return this.prisma.page.create({
      data: { albumId, templateId: dto.templateId, content: JSON.stringify(dto.content), order: dto.order },
    })
  }

  async updatePage(pageId: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const data: Partial<{ templateId: string; content: string }> = {}
    if (dto.templateId) data.templateId = dto.templateId
    if (dto.content) {
      this.validatePageImages(dto.content.images)
      data.content = JSON.stringify(dto.content)
    }
    return this.prisma.page.update({ where: { id: pageId }, data })
  }

  async deletePage(pageId: string) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const keys = this.collectPageKeys(page.content)
    // 页面删除同样登记其图片的删除任务，不再遗留孤儿对象
    await this.prisma.$transaction(async (tx) => {
      await this.deletion.enqueueMany(keys, tx)
      await tx.page.delete({ where: { id: pageId } })
    })
    await this.deletion.runDueDeletions()
  }

  async reorderPages(albumId: string, dto: ReorderPagesDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    const pages = await this.prisma.page.findMany({ where: { albumId } })
    if (dto.pageIds.length !== pages.length) {
      throw new BadRequestException('pageIds count does not match actual page count')
    }
    const pageIdSet = new Set(pages.map((p) => p.id))
    if (!dto.pageIds.every((id) => pageIdSet.has(id))) {
      throw new BadRequestException('pageIds contain IDs not belonging to this album')
    }
    await this.prisma.$transaction(
      dto.pageIds.map((id, i) => this.prisma.page.update({ where: { id }, data: { order: i + 1 } })),
    )
  }

  private validatePageImages(images: string[]) {
    for (const img of images) {
      if (img.startsWith(MEDIA_PROTOCOL)) {
        this.mediaRef.fromMediaRef(img, ALBUM_PREFIXES)
      }
      // Allow non-media:// strings (legacy URLs) — they are only accepted in existing data
      // For new writes, we accept both formats during migration window
    }
  }

  private async signPageContent(contentStr: string): Promise<string> {
    try {
      const content = JSON.parse(contentStr)
      if (content.images && Array.isArray(content.images)) {
        content.images = await Promise.all(
          content.images.map(async (url: string) => {
            if (url.startsWith(MEDIA_PROTOCOL)) {
              const key = this.mediaRef.toLogicalKey(url as `media://${string}`, ALBUM_PREFIXES)
              return this.storage.presignRead(key)
            }
            // Legacy URL: try to sign
            try {
              const ref = this.mediaRef.fromLegacyUrl(url, ALBUM_PREFIXES)
              const key = this.mediaRef.toLogicalKey(ref, ALBUM_PREFIXES)
              return this.storage.presignRead(key)
            } catch {
              // If legacy conversion fails, return as-is (shouldn't happen in normal flow)
              return url
            }
          }),
        )
      }
      return JSON.stringify(content)
    } catch {
      return contentStr
    }
  }

  private async signUrl(url: string): Promise<string> {
    if (url.startsWith(MEDIA_PROTOCOL)) {
      const key = this.mediaRef.toLogicalKey(url as `media://${string}`, ALBUM_PREFIXES)
      return this.storage.presignRead(key)
    }
    // Legacy URL
    try {
      const ref = this.mediaRef.fromLegacyUrl(url, ALBUM_PREFIXES)
      const key = this.mediaRef.toLogicalKey(ref, ALBUM_PREFIXES)
      return this.storage.presignRead(key)
    } catch {
      return url
    }
  }

}
