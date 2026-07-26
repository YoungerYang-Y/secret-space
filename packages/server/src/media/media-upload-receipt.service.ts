import { Injectable, UnprocessableEntityException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { MediaReference } from './media-reference.service'

const RECEIPT_TTL_MS = 10 * 60 * 1000

type ReceiptScope =
  | { kind: 'photo'; provinceCode: string }
  | { kind: 'album'; provinceCode: null }

@Injectable()
export class MediaUploadReceiptService {
  constructor(private prisma: PrismaService) {}

  async issue(reference: MediaReference): Promise<string> {
    const key = reference.slice('media://'.length)
    const scope = this.scopeForKey(key)
    const existing = await this.prisma.mediaUploadReceipt.findUnique({ where: { key } })
    if (existing) return this.reusableReceiptId(existing)

    try {
      const receipt = await this.prisma.mediaUploadReceipt.create({
        data: {
          key,
          scope: scope.kind,
          provinceCode: scope.provinceCode,
          expiresAt: new Date(Date.now() + RECEIPT_TTL_MS),
        },
      })
      return receipt.id
    } catch (error: unknown) {
      // 同一 staging key 的并发确认只共享同一张未消费回执，绝不重置已消费状态。
      if (this.isUniqueConstraint(error)) {
        const concurrentReceipt = await this.prisma.mediaUploadReceipt.findUnique({ where: { key } })
        if (concurrentReceipt) return this.reusableReceiptId(concurrentReceipt)
      }
      throw error
    }
  }

  async consumePhoto(
    receiptId: string,
    provinceCode: string,
    tx: Prisma.TransactionClient,
  ): Promise<MediaReference> {
    return this.consume(receiptId, { kind: 'photo', provinceCode }, tx)
  }

  async peekPhoto(receiptId: string, provinceCode: string): Promise<MediaReference> {
    return this.peek(receiptId, { kind: 'photo', provinceCode })
  }

  async consumeAlbum(receiptId: string, tx: Prisma.TransactionClient): Promise<MediaReference> {
    return this.consume(receiptId, { kind: 'album', provinceCode: null }, tx)
  }

  async peekAlbum(receiptId: string): Promise<MediaReference> {
    return this.peek(receiptId, { kind: 'album', provinceCode: null })
  }

  async findReusable(reference: MediaReference): Promise<string | null> {
    const key = reference.slice('media://'.length)
    const receipt = await this.prisma.mediaUploadReceipt.findUnique({ where: { key } })
    if (!receipt || receipt.consumedAt || receipt.expiresAt <= new Date()) return null
    return receipt.id
  }

  private async consume(
    receiptId: string,
    expected: ReceiptScope,
    tx: Prisma.TransactionClient,
  ): Promise<MediaReference> {
    const receipt = await tx.mediaUploadReceipt.findFirst({
      where: {
        id: receiptId,
        scope: expected.kind,
        provinceCode: expected.provinceCode,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!receipt) {
      throw new UnprocessableEntityException('上传确认已过期、已使用或不属于当前资源')
    }

    const consumed = await tx.mediaUploadReceipt.updateMany({
      where: { id: receipt.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) {
      throw new UnprocessableEntityException('上传确认已被使用')
    }
    return `media://${receipt.key}` as MediaReference
  }

  private async peek(receiptId: string, expected: ReceiptScope): Promise<MediaReference> {
    const receipt = await this.prisma.mediaUploadReceipt.findFirst({
      where: {
        id: receiptId,
        scope: expected.kind,
        provinceCode: expected.provinceCode,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (!receipt) {
      throw new UnprocessableEntityException('上传确认已过期、已使用或不属于当前资源')
    }
    return `media://${receipt.key}` as MediaReference
  }

  private scopeForKey(key: string): ReceiptScope {
    const parts = key.split('/')
    if (parts.length === 3 && parts[0] === 'photos' && parts[1] && parts[2]) {
      if (parts[1] === 'album') return { kind: 'album', provinceCode: null }
      return { kind: 'photo', provinceCode: parts[1] }
    }
    throw new UnprocessableEntityException('上传对象不属于允许的媒体路径')
  }

  private reusableReceiptId(receipt: { id: string; expiresAt: Date; consumedAt: Date | null }): string {
    if (receipt.consumedAt || receipt.expiresAt <= new Date()) {
      throw new UnprocessableEntityException('上传确认已过期或已使用')
    }
    return receipt.id
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'P2002'
  }
}
