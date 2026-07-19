import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'
import type { R2Config } from '../config/storage-config'
import type { MediaStorage, ImageExtension, ImageContentType, UploadGrant, ConfirmedUpload } from './media-storage'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MiB
const UPLOAD_EXPIRY_SECONDS = 600
const READ_EXPIRY_SECONDS = 300
const MAGIC_READ_BYTES = 4096

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
    const key = `photos/${provinceCode}/${uuid()}${ext}`
    return this.createUploadGrant(key, contentType)
  }

  async presignAlbumUpload(
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant> {
    const key = `photos/album/${uuid()}${ext}`
    return this.createUploadGrant(key, contentType)
  }

  async presignRead(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.client, command, { expiresIn: READ_EXPIRY_SECONDS })
  }

  async confirmUpload(key: string): Promise<ConfirmedUpload> {
    let headResult: { ContentLength?: number; ContentType?: string }
    try {
      headResult = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
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
        Key: key,
        Range: `bytes=0-${MAGIC_READ_BYTES - 1}`,
      }),
    )
    const body = getResult.Body as { transformToByteArray(): Promise<Uint8Array> }
    const bytes = await body.transformToByteArray()

    const expectedMagic = MAGIC_CHECKS.find((m) => m.contentType === contentType)
    if (!expectedMagic || !expectedMagic.check(bytes)) {
      throw new ConfirmUploadError('Magic bytes do not match declared content type')
    }

    return {
      mediaRef: `media://${key}`,
      size,
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }

  private async createUploadGrant(
    key: string,
    contentType: ImageContentType,
  ): Promise<UploadGrant> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_EXPIRY_SECONDS,
    })
    return {
      uploadUrl,
      key,
      mediaRef: `media://${key}`,
    }
  }
}

class ConfirmUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfirmUploadError'
  }
}
