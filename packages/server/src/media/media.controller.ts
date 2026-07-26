import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, Inject, UnprocessableEntityException, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { MEDIA_STORAGE } from './media-storage'
import type { MediaStorage } from './media-storage'
import { MediaDeletionService } from './media-deletion.service'
import { MediaUploadReceiptService } from './media-upload-receipt.service'
import { ConfirmMediaDto } from './dto/confirm-media.dto'

const ALLOWED_KEY_PREFIXES = ['tmp/photos/']
const MEDIA_PROTOCOL = 'media://'

@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private deletion: MediaDeletionService,
    private receipts: MediaUploadReceiptService,
  ) {}

  @Post('confirm')
  @Roles('admin')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmMediaDto) {
    this.validateKey(dto.key)
    const finalReference = this.finalReferenceFromStagingKey(dto.key)
    let uploadReceipt: string
    try {
      const result = await this.storage.confirmUpload(dto.key)
      // 在签预览 URL 前持久化回执：签名暂时不可用时，客户端可用同一 staging key 安全恢复确认。
      uploadReceipt = await this.receipts.issue(result.mediaRef as `media://${string}`)
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConfirmUploadError') {
        try {
          const recoveredReceipt = await this.receipts.findReusable(finalReference)
          if (recoveredReceipt) return await this.confirmationResponse(finalReference, recoveredReceipt)
        } catch {
          throw new ServiceUnavailableException('媒体服务暂不可用')
        }
        throw new UnprocessableEntityException(error.message)
      }
      if (error instanceof UnprocessableEntityException) throw error
      throw new ServiceUnavailableException('媒体服务暂不可用')
    }
    return this.confirmationResponse(finalReference, uploadReceipt)
  }

  @Get('deletion-tasks')
  @Roles('admin')
  async listDeletionTasks(@Query('status') status?: 'pending' | 'done' | 'failing') {
    if (status && !['pending', 'done', 'failing'].includes(status)) {
      throw new BadRequestException('status 仅支持 pending、done、failing')
    }
    return this.deletion.listTasks(status)
  }

  @Post('deletion-tasks/retry')
  @Roles('admin')
  @HttpCode(200)
  async retryDeletionTasks() {
    return this.deletion.runDueDeletions()
  }

  private validateKey(key: string): void {
    const decoded = decodeURIComponent(key)
    if (decoded.includes('..') || key.includes('..')) {
      throw new BadRequestException('Invalid key: path traversal detected')
    }
    const hasAllowedPrefix = ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
    if (!hasAllowedPrefix) {
      throw new BadRequestException(
        `Invalid key: must start with one of [${ALLOWED_KEY_PREFIXES.join(', ')}]`,
      )
    }
  }

  private finalReferenceFromStagingKey(stagingKey: string): `media://${string}` {
    return `media://${stagingKey.slice('tmp/'.length)}`
  }

  private async confirmationResponse(reference: `media://${string}`, uploadReceipt: string) {
    try {
      return {
        uploadReceipt,
        readUrl: await this.storage.presignRead(reference.slice(MEDIA_PROTOCOL.length)),
        readExpiresIn: 300,
      }
    } catch {
      throw new ServiceUnavailableException('媒体服务暂不可用')
    }
  }
}
