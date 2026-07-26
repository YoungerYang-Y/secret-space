import { Module } from '@nestjs/common'
import { MEDIA_STORAGE } from './media-storage'
import { MediaReferenceService } from './media-reference.service'
import { MediaDeletionService } from './media-deletion.service'
import { MediaUploadReceiptService } from './media-upload-receipt.service'
import { MediaController } from './media.controller'
import { R2MediaStorage } from './r2-media-storage'
import { PrismaModule } from '../prisma/prisma.module'
import { loadStorageConfig } from '../config/storage-config'

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_STORAGE,
      useFactory: () => {
        const config = loadStorageConfig(process.env)
        switch (config.driver) {
          case 'r2':
            return new R2MediaStorage(config.r2)
          default: {
            const _exhaustive: never = config.driver
            throw new Error(`Unhandled storage driver: ${_exhaustive}`)
          }
        }
      },
    },
    MediaReferenceService,
    MediaDeletionService,
    MediaUploadReceiptService,
  ],
  exports: [MEDIA_STORAGE, MediaReferenceService, MediaDeletionService, MediaUploadReceiptService],
})
export class MediaModule {}
