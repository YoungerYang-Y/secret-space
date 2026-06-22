import { Injectable } from '@nestjs/common'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuid } from 'uuid'

@Injectable()
export class R2Service {
  private client: S3Client
  private bucket: string
  private publicUrl: string

  constructor() {
    this.bucket = process.env.R2_BUCKET || 'secret-space'
    this.publicUrl = process.env.R2_PUBLIC_URL || 'https://r2.example.com'
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || 'https://account.r2.cloudflarestorage.com',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    })
  }

  async presign(provinceCode: string, ext: string, contentType: string) {
    const key = `photos/${provinceCode}/${uuid()}${ext}`
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    })
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 })
    return { uploadUrl, key, publicUrl: `${this.publicUrl}/${key}` }
  }

  async delete(key: string) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch (e) {
      console.error(`R2 delete failed for key: ${key}`, e)
    }
  }
}
