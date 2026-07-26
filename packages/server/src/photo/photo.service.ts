import { Injectable, Inject, Logger, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage, ImageExtension, ImageContentType } from '../media/media-storage'
import { MediaReferenceService } from '../media/media-reference.service'
import { MediaDeletionService } from '../media/media-deletion.service'
import { MediaUploadReceiptService } from '../media/media-upload-receipt.service'
import { ProvinceService } from '../province/province.service'
import { extname } from 'path'

const ALLOWED_CONTENT_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS: readonly string[] = ['.jpg', '.jpeg', '.png', '.webp']

@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private mediaRef: MediaReferenceService,
    private deletion: MediaDeletionService,
    private receipts: MediaUploadReceiptService,
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

  async create(data: { provinceCode: string; uploadReceipt: string; annotation?: string; order: number }) {
    await this.provinceService.findByCode(data.provinceCode)
    const previewRef = await this.receipts.peekPhoto(data.uploadReceipt, data.provinceCode)
    const previewUrl = await this.presignRead(previewRef.slice('media://'.length))
    const photo = await this.prisma.$transaction(async (tx) => {
      const ref = await this.receipts.consumePhoto(data.uploadReceipt, data.provinceCode, tx)
      const logicalKey = ref.slice('media://'.length)
      return tx.photo.create({
        data: {
          provinceCode: data.provinceCode,
          url: ref,
          key: logicalKey,
          annotation: data.annotation,
          order: data.order,
        },
      })
    })
    return {
      id: photo.id,
      url: previewUrl,
      annotation: photo.annotation,
      order: photo.order,
    }
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
    const photos = await this.prisma.photo.findMany({
      where: { provinceCode },
      orderBy: { order: 'asc' },
      select: { id: true, url: true, key: true, annotation: true, order: true },
    })
    const reads = new Map<string, Promise<string>>()
    return Promise.all(photos.map(async (photo) => ({
      id: photo.id,
      url: await this.signPhotoUrl(photo, reads),
      annotation: photo.annotation,
      order: photo.order,
    })))
  }

  async update(id: number, data: { annotation?: string }) {
    const photo = await this.prisma.photo.findUnique({ where: { id } })
    if (!photo) throw new NotFoundException('照片不存在')
    const updated = await this.prisma.photo.update({ where: { id }, data })
    return {
      id: updated.id,
      url: await this.signPhotoUrl(updated),
      annotation: updated.annotation,
      order: updated.order,
    }
  }

  async delete(id: number) {
    const photo = await this.prisma.photo.findUnique({ where: { id } })
    if (!photo) throw new NotFoundException('照片不存在')
    const key = this.resolveStorageKey(photo)
    // 删除任务与业务删除同事务：对象删除最终一致，存储故障不再阻塞管理员
    await this.prisma.$transaction(async (tx) => {
      if (key) await this.deletion.enqueueMany([key], tx)
      await tx.photo.delete({ where: { id } })
    })
    await this.deletion.runDueDeletions()
  }

  /** key 只来自持久化的 key 列或 media:// 引用；不从公开 URL 反解析。 */
  private resolveStorageKey(photo: { key: string; url: string }): string | null {
    if (photo.key) return photo.key
    if (photo.url.startsWith('media://')) {
      try {
        return this.mediaRef.toLogicalKey(photo.url as `media://${string}`, ['photos/'])
      } catch {
        this.logger.warn(`无法从引用解析 storageKey: ${photo.url}`)
      }
    }
    return null
  }

  private async presignRead(key: string): Promise<string> {
    try {
      return await this.storage.presignRead(key)
    } catch {
      throw new ServiceUnavailableException('媒体服务暂不可用')
    }
  }

  private async signPhotoUrl(
    photo: { key: string; url: string },
    reads = new Map<string, Promise<string>>(),
  ): Promise<string> {
    try {
      const key = photo.key
        ? this.mediaRef.toLogicalKey(`media://${photo.key}`, ['photos/'])
        : this.mediaRef.toLogicalKey(photo.url as `media://${string}`, ['photos/'])
      const existing = reads.get(key)
      if (existing) return existing
      const read = this.presignRead(key)
      reads.set(key, read)
      return read
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
      throw new ServiceUnavailableException('媒体内容暂不可用')
    }
  }
}
