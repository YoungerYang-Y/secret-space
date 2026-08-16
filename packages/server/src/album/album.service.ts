import { Injectable, Inject, Logger, NotFoundException, ConflictException, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'
import { MediaDeletionService } from '../media/media-deletion.service'
import { MediaUploadReceiptService } from '../media/media-upload-receipt.service'
import { isTransactionTimeout } from '../prisma/transaction-timeout'
import {
  TEMPLATE_CONSTRAINTS,
  type PageContentDto,
  CreateAlbumDto,
  UpdateAlbumDto,
  CreatePageDto,
  UpdatePageDto,
  ReorderPagesDto,
} from './dto/album.dto'

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
    let album
    try {
      album = await this.prisma.$transaction(async (tx) => {
        const data: { year: number; title?: string; coverUrl?: string } = { year: dto.year, title: dto.title }
        if (dto.coverUploadReceipt) data.coverUrl = await this.receipts.consumeAlbum(dto.coverUploadReceipt, tx)
        return tx.album.create({ data })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Album for year ${dto.year} already exists`)
      }
      throw error
    }
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
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.deletion.enqueueMany(keys, tx)
        await tx.album.delete({ where: { id } })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Album not found')
      }
      if (isTransactionTimeout(error)) {
        // 超时后提交状态不明：相册已不存在说明事务实际已提交（或已被并发请求删除）、
        // 删除任务已登记，先兜底处理删除任务，再按既有契约返回 404；
        // 仍在则说明事务已回滚，返回 503 让调用方重试。
        const remaining = await this.prisma.album.findUnique({ where: { id } })
        if (!remaining) {
          await this.deletion.runDueDeletions()
          throw new NotFoundException('Album not found')
        }
        throw new ServiceUnavailableException('相册删除暂时不可用')
      } else {
        throw error
      }
    }
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
    this.validatePageContent(dto.templateId, dto.content, [], undefined, true)
    const prepared = await this.preparePageImages(dto.content.imageReceipts, [])
    let page
    try {
      page = await this.prisma.$transaction(async (tx) => {
        const images = await this.resolvePageImages(dto.content.imageReceipts, [], tx)
        const order = dto.order ?? ((await tx.page.aggregate({ where: { albumId }, _max: { order: true } }))._max.order ?? 0) + 1
        return tx.page.create({
          data: {
            albumId,
            templateId: dto.templateId,
            content: JSON.stringify({ images, text: dto.content.text }),
            order,
          },
        })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Page order already exists')
      }
      throw error
    }
    return { ...page, content: JSON.stringify({ images: prepared.urls, text: dto.content.text }) }
  }

  async updatePage(pageId: string, dto: UpdatePageDto) {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } })
    if (!page) throw new NotFoundException('Page not found')
    const existing = dto.content ? this.parsePageContent(page.content) : null
    if (dto.templateId && dto.templateId !== page.templateId && !dto.content?.imageReceipts) {
      throw new BadRequestException('修改模板时必须提供图片')
    }
    if (dto.content && existing) {
      this.validatePageContent(dto.templateId ?? page.templateId, dto.content, existing.images, existing.text, false)
    }
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
    if (new Set(dto.pageIds).size !== dto.pageIds.length) {
      throw new BadRequestException('pageIds must be unique')
    }
    if (!dto.pageIds.every((id) => pageIdSet.has(id))) {
      throw new BadRequestException('pageIds contain IDs not belonging to this album')
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Move every page outside the unique range before assigning the final sequence.
          for (const [index, id] of dto.pageIds.entries()) {
            await tx.page.update({ where: { id }, data: { order: -(index + 1) } })
          }
          for (const [index, id] of dto.pageIds.entries()) {
            await tx.page.update({ where: { id }, data: { order: index + 1 } })
          }
        })
        return
      } catch (error) {
        if (!isTransactionTimeout(error) || attempt === 2) {
          if (isTransactionTimeout(error)) throw new ServiceUnavailableException('页面排序暂时不可用')
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
      }
    }
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

  private validatePageContent(
    templateId: string,
    content: PageContentDto,
    existingImages: string[],
    existingText: string | undefined,
    creating: boolean,
  ): void {
    const constraint = TEMPLATE_CONSTRAINTS[templateId as keyof typeof TEMPLATE_CONSTRAINTS]
    if (!constraint) throw new BadRequestException('不支持的页面模板')
    const receipts = content.imageReceipts
    if (!receipts && creating) throw new BadRequestException('imageReceipts is required')
    if (!receipts) {
      if (existingImages.length !== constraint.imageCount || existingImages.some((image) => !image)) {
        const actual = existingImages.filter(Boolean).length
        throw new BadRequestException(`${templateId} 模板需要 ${constraint.imageCount} 张图片，收到 ${actual} 张有效图片`)
      }
      if (constraint.textRequired && !(content.text ?? existingText)?.trim()) {
        throw new BadRequestException('photo-text 模板需要填写文字')
      }
      return
    }
    if (creating && receipts.some((receipt) => receipt === null || receipt === '')) {
      throw new BadRequestException('创建页面时图片不能为空')
    }
    const images = receipts.map((receipt, index) => receipt === null ? existingImages[index] ?? '' : receipt)
    if (!creating && receipts.some((receipt, index) => receipt === null && !existingImages[index])) {
      throw new BadRequestException('原图不存在，无法保留')
    }
    if (images.length !== constraint.imageCount || images.some((image) => !image)) {
      const actual = images.filter(Boolean).length
      throw new BadRequestException(`${templateId} 模板需要 ${constraint.imageCount} 张图片，收到 ${actual} 张有效图片`)
    }
    if (constraint.textRequired && !(content.text ?? existingText)?.trim()) {
      throw new BadRequestException('photo-text 模板需要填写文字')
    }
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
