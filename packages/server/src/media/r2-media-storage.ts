import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'
import type { R2Config } from '../config/storage-config'
import type { MediaStorage, ImageExtension, ImageContentType, UploadGrant, ConfirmedUpload } from './media-storage'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MiB
const UPLOAD_EXPIRY_SECONDS = 600
const READ_EXPIRY_SECONDS = 300
const MAGIC_READ_BYTES = 4096
const STAGING_PREFIX = 'tmp/'

type MagicCheck = {
  readonly contentType: ImageContentType
  readonly check: (bytes: Uint8Array) => boolean
}

const MAGIC_CHECKS: readonly MagicCheck[] = [
  {
    contentType: 'image/jpeg',
    check: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    contentType: 'image/png',
    check: (bytes) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  {
    contentType: 'image/webp',
    check: (bytes) =>
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50, // P
  },
] as const

const SUPPORTED_CONTENT_TYPES: readonly ImageContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export class R2MediaStorage implements MediaStorage {
  private client: S3Client
  private bucket: string

  constructor(config: R2Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  async presignPhotoUpload(
    provinceCode: string,
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant> {
    // 上传先落到 tmp/ staging 前缀，confirm 通过后才晋级到正式 key；
    // 未确认的孤儿对象由桶级 lifecycle 规则自动清除（DR-002）
    const finalKey = `photos/${provinceCode}/${uuid()}${ext}`
    return this.createUploadGrant(`${STAGING_PREFIX}${finalKey}`, finalKey, contentType)
  }

  async presignAlbumUpload(
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant> {
    const finalKey = `photos/album/${uuid()}${ext}`
    return this.createUploadGrant(`${STAGING_PREFIX}${finalKey}`, finalKey, contentType)
  }

  async presignRead(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn: READ_EXPIRY_SECONDS })
  }

  async confirmUpload(stagingKey: string): Promise<ConfirmedUpload> {
    if (!stagingKey.startsWith(`${STAGING_PREFIX}photos/`) || stagingKey.includes('..')) {
      throw new ConfirmUploadError('Invalid staging key')
    }
    let headResult: { ContentLength?: number; ContentType?: string }
    try {
      headResult = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: stagingKey }),
      )
    } catch {
      throw new ConfirmUploadError('Object not found')
    }

    const size = headResult.ContentLength ?? 0
    if (size > MAX_SIZE_BYTES) {
      throw new ConfirmUploadError('Object exceeds 10 MiB limit')
    }

    const contentType = headResult.ContentType as string
    if (!SUPPORTED_CONTENT_TYPES.includes(contentType as ImageContentType)) {
      throw new ConfirmUploadError('Unsupported content type')
    }

    const getResult = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: stagingKey,
        Range: `bytes=0-${MAGIC_READ_BYTES - 1}`,
      }),
    )
    const body = getResult.Body as { transformToByteArray(): Promise<Uint8Array> }
    const bytes = await body.transformToByteArray()

    const expectedMagic = MAGIC_CHECKS.find((m) => m.contentType === contentType)
    if (!expectedMagic || !expectedMagic.check(bytes)) {
      throw new ConfirmUploadError('Magic bytes do not match declared content type')
    }

    // 校验通过：晋级 staging 对象到最终 key，再删除 staging 对象
    const finalKey = stagingKey.slice(STAGING_PREFIX.length)
    try {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: finalKey,
          CopySource: `${this.bucket}/${stagingKey}`,
        }),
      )
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: stagingKey }),
      )
    } catch {
      throw new ConfirmUploadError('Failed to promote staged object')
    }

    return {
      mediaRef: `media://${finalKey}`,
      size,
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  /**
   * NOTE: R2/S3 presigned PUT URLs do not support Content-Length-Range conditions.
   * Upload size is enforced at confirm time via HeadObject (10 MiB limit).
   * Unconfirmed staging objects under tmp/ are cleaned up by the bucket
   * lifecycle rule (see DR-002 deployment checklist).
   *
   * mediaRef 返回的是 confirm 成功后的最终引用；uploadUrl/key 指向 tmp staging。
   */
  private async createUploadGrant(
    stagingKey: string,
    finalKey: string,
    contentType: ImageContentType,
  ): Promise<UploadGrant> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: stagingKey,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_EXPIRY_SECONDS,
    })
    return {
      uploadUrl,
      key: stagingKey,
      mediaRef: `media://${finalKey}`,
    }
  }
}

class ConfirmUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfirmUploadError'
  }
}
