import { Controller, Post, Body, UseGuards, HttpCode, Inject, UnprocessableEntityException, BadRequestException } from '@nestjs/common'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { MEDIA_STORAGE } from './media-storage'
import type { MediaStorage } from './media-storage'
import { ConfirmMediaDto } from './dto/confirm-media.dto'

const ALLOWED_KEY_PREFIXES = ['photos/']

@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(@Inject(MEDIA_STORAGE) private storage: MediaStorage) {}

  @Post('confirm')
  @Roles('admin')
  @HttpCode(200)
  async confirm(@Body() dto: ConfirmMediaDto) {
    this.validateKey(dto.key)
    try {
      const result = await this.storage.confirmUpload(dto.key)
      const readUrl = await this.storage.presignRead(dto.key)
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
