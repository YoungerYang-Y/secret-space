import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'
import { MediaDeletionService } from '../media/media-deletion.service'
import { MediaUploadReceiptService } from '../media/media-upload-receipt.service'
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
    private receipts: MediaUploadReceiptService,
  ) {}

  async findAll() {
    const albums = await this.prisma.album.findMany({ orderBy: { year: 'asc' } })
    const reads = new Map<string, Promise<string>>()
    return Promise.all(
      albums.map(async (album) => ({
        ...album,
        coverUrl: album.coverUrl ? await this.signUrl(album.coverUrl, reads) : null,
      })),
    )
  }

  async findPages(albumId: string) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } })
    if (!album) throw new NotFoundException('Album not found')
    const pages = await this.prisma.page.findMany({ where: { albumId }, orderBy: { order: 'asc' } })
    const reads = new Map<string, Promise<string>>()
    return Promise.all(
      pages.map(async (page) => ({
        ...page,
        content: await this.signPageContent(page.content, reads),
      })),
    )
  }

  async create(dto: CreateAlbumDto) {
    const existing = await this.prisma.album.findUnique({ where: { year: dto.year } })
    if (existing) throw new ConflictException(`Album for year ${dto.year} already exists`)
    const preparedCover = dto.coverUploadReceipt ? await this.prepareAlbumReceipt(dto.coverUploadReceipt) : null
    const album = await this.prisma.$transaction(async (tx) => {
      const data: { year: number; title?: string; coverUrl?: string } = { year: dto.year, title: dto.title }
      if (dto.coverUploadReceipt) data.coverUrl = await this.receipts.consumeAlbum(dto.coverUploadReceipt, tx)
      return tx.album.create({ data })
    })
    return { ...album, coverUrl: preparedCover?.url ?? null }
  }

  async update(id: string, dto: UpdateAlbumDto) {
    const album = await this.prisma.album.findUnique({ where: { id } })
    if (!album) throw new NotFoundException('Album not found')
    if (dto.year !== undefined && dto.year !== album.year) {
      const conflict = await this.prisma.album.findUnique({ where: { year: dto.year } })
      if (conflict) throw new ConflictException(`Album for year ${dto.year} already exists`)
    }
    const responseCoverUrl = dto.coverUploadReceipt
      ? (await this.prepareAlbumReceipt(dto.coverUploadReceipt)).url
      : album.coverUrl ? await this.signUrl(album.coverUrl) : null
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: { year?: number; title?: string; coverUrl?: string } = {}
      if (dto.year !== undefined) data.year = dto.year
      if (dto.title !== undefined) data.title = dto.title
      if (dto.coverUploadReceipt !== undefined) {
        data.coverUrl = await this.receipts.consumeAlbum(dto.coverUploadReceipt, tx)
      }
      return tx.album.update({ where: { id }, data })
    })
    return { ...updated, coverUrl: responseCoverUrl }
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
    if (!dto.content.imageReceipts) throw new BadRequestException('imageReceipts is required')
    const prepared = await this.preparePageImages(dto.content.imageReceipts, [])
    const page = await this.prisma.$transaction(async (tx) => {
      const images = await this.resolvePageImages(dto.content.imageReceipts, [], tx)
      return tx.page.create({
        data: {
          albumId,
          templateId: dto.templateId,
          content: JSON.stringify({ images, text: dto.content.text }),
          order: dto.order,
        },
      })
    })
    return { ...page, content: JSON.stringify({ images: prepared.urls, text: dto.content.text }) }
  }

  async updatePage(pageId: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const existing = dto.content ? this.parsePageContent(page.content) : null
    const responseContent = dto.content && existing
      ? JSON.stringify({
          images: (await this.preparePageImages(dto.content.imageReceipts, existing.images)).urls,
          text: dto.content.text ?? existing.text,
        })
      : await this.signPageContent(page.content)
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Partial<{ templateId: string; content: string }> = {}
      if (dto.templateId) data.templateId = dto.templateId
      if (dto.content && existing) {
        const images = await this.resolvePageImages(dto.content.imageReceipts, existing.images, tx)
        data.content = JSON.stringify({ images, text: dto.content.text ?? existing.text })
      }
      return tx.page.update({ where: { id: pageId }, data })
    })
    return { ...updated, content: responseContent }
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

  private async resolvePageImages(
    receipts: Array<string | null> | undefined,
    existing: string[],
    tx: Prisma.TransactionClient,
  ): Promise<string[]> {
    if (receipts === undefined) return existing
    if (receipts.length > 10) throw new BadRequestException('图片数量不能超过 10')
    return Promise.all(receipts.map(async (receipt, index) => {
      if (receipt === null) return existing[index] ?? ''
      if (receipt === '') return ''
      if (typeof receipt !== 'string') throw new BadRequestException('图片确认凭据格式错误')
      return this.receipts.consumeAlbum(receipt, tx)
    }))
  }

  private async prepareAlbumReceipt(receipt: string): Promise<{ ref: string; url: string }> {
    const ref = await this.receipts.peekAlbum(receipt)
    return { ref, url: await this.signUrl(ref) }
  }

  private async preparePageImages(receipts: Array<string | null> | undefined, existing: string[]) {
    if (receipts === undefined) {
      const reads = new Map<string, Promise<string>>()
      return { refs: existing, urls: await Promise.all(existing.map((ref) => ref ? this.signUrl(ref, reads) : '')) }
    }
    if (receipts.length > 10) throw new BadRequestException('图片数量不能超过 10')
    const refs = await Promise.all(receipts.map(async (receipt, index) => {
      if (receipt === null) return existing[index] ?? ''
      if (receipt === '') return ''
      if (typeof receipt !== 'string') throw new BadRequestException('图片确认凭据格式错误')
      return this.receipts.peekAlbum(receipt)
    }))
    const reads = new Map<string, Promise<string>>()
    return { refs, urls: await Promise.all(refs.map((ref) => ref ? this.signUrl(ref, reads) : '')) }
  }

  private parsePageContent(contentStr: string): { images: string[]; text?: string } {
    try {
      const content = JSON.parse(contentStr)
      return {
        images: Array.isArray(content.images) ? content.images : [],
        text: typeof content.text === 'string' ? content.text : undefined,
      }
    } catch {
      throw new ServiceUnavailableException('媒体内容暂不可用')
    }
  }

  private async signPageContent(contentStr: string, reads = new Map<string, Promise<string>>()): Promise<string> {
    try {
      const content = this.parsePageContent(contentStr)
      if (content.images && Array.isArray(content.images)) {
        content.images = await Promise.all(
          content.images.map(async (url: string) => {
            if (!url) return ''
            if (url.startsWith(MEDIA_PROTOCOL)) {
              const key = this.mediaRef.toLogicalKey(url as `media://${string}`, ALBUM_PREFIXES)
              return this.presignRead(key, reads)
            }
            throw new ServiceUnavailableException('媒体内容暂不可用')
          }),
        )
      }
      return JSON.stringify(content)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('媒体内容暂不可用')
    }
  }

  private async signUrl(url: string, reads = new Map<string, Promise<string>>()): Promise<string> {
    try {
      if (!url.startsWith(MEDIA_PROTOCOL)) throw new Error('not a media reference')
      const key = this.mediaRef.toLogicalKey(url as `media://${string}`, ALBUM_PREFIXES)
      return this.presignRead(key, reads)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('媒体内容暂不可用')
    }
  }

  private presignRead(key: string, reads: Map<string, Promise<string>>): Promise<string> {
    const existing = reads.get(key)
    if (existing) return existing
    const read = this.storage.presignRead(key).catch(() => {
      throw new ServiceUnavailableException('媒体服务暂不可用')
    })
    reads.set(key, read)
    return read
  }

}
