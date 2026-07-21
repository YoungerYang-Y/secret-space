import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, Inject, UnprocessableEntityException, BadRequestException } from '@nestjs/common'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { MEDIA_STORAGE } from './media-storage'
import type { MediaStorage } from './media-storage'
import { MediaDeletionService } from './media-deletion.service'
import { ConfirmMediaDto } from './dto/confirm-media.dto'

const ALLOWED_KEY_PREFIXES = ['tmp/photos/']
const MEDIA_PROTOCOL = 'media://'

@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(
    @Inject(MEDIA_STORAGE) private storage: MediaStorage,
    private deletion: MediaDeletionService,
  ) {}

  @Post('confirm')
  @Roles('admin')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmMediaDto) {
    this.validateKey(dto.key)
    try {
      const result = await this.storage.confirmUpload(dto.key)
      // 读取 URL 针对晋级后的最终 key，staging 对象已在 confirm 中删除
      const finalKey = result.mediaRef.slice(MEDIA_PROTOCOL.length)
      const readUrl = await this.storage.presignRead(finalKey)
      return {
        mediaRef: result.mediaRef,
        readUrl,
        readExpiresIn: 300,
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConfirmUploadError') {
        throw new UnprocessableEntityException(error.message)
      }
      throw error
    }
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
}
