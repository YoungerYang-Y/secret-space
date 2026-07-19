import { describe, it, expect, vi, beforeEach } from 'vitest'
import { R2MediaStorage } from '../r2-media-storage'

// Mock AWS SDK at system boundary
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned.example.com/signed'),
}))

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}))

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3'

describe('R2MediaStorage', () => {
  let storage: R2MediaStorage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new R2MediaStorage({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
    })
  })

  describe('presignPhotoUpload', () => {
    it('generates key with photos/<provinceCode>/<uuid><ext> pattern', async () => {
      const result = await storage.presignPhotoUpload('hunan', '.webp', 'image/webp')
      expect(result.key).toBe('photos/hunan/test-uuid-1234.webp')
    })

    it('returns uploadUrl from presigner', async () => {
      const result = await storage.presignPhotoUpload('hunan', '.webp', 'image/webp')
      expect(result.uploadUrl).toBe('https://presigned.example.com/signed')
    })

    it('returns mediaRef with media:// protocol', async () => {
      const result = await storage.presignPhotoUpload('hunan', '.webp', 'image/webp')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.webp')
    })

    it('uses 600 second expiry for PUT presign', async () => {
      await storage.presignPhotoUpload('hunan', '.png', 'image/png')
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 600 }),
      )
    })
  })

  describe('presignAlbumUpload', () => {
    it('generates key with photos/album/<uuid><ext> pattern', async () => {
      const result = await storage.presignAlbumUpload('.jpg', 'image/jpeg')
      expect(result.key).toBe('photos/album/test-uuid-1234.jpg')
    })

    it('returns mediaRef with media:// protocol', async () => {
      const result = await storage.presignAlbumUpload('.jpg', 'image/jpeg')
      expect(result.mediaRef).toBe('media://photos/album/test-uuid-1234.jpg')
    })

    it('uses 600 second expiry for PUT presign', async () => {
      await storage.presignAlbumUpload('.jpg', 'image/jpeg')
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 600 }),
      )
    })
  })

  describe('presignRead', () => {
    it('returns presigned GET URL', async () => {
      const url = await storage.presignRead('photos/hunan/test-uuid-1234.webp')
      expect(url).toBe('https://presigned.example.com/signed')
    })

    it('uses 300 second expiry for GET presign', async () => {
      await storage.presignRead('photos/hunan/test-uuid-1234.webp')
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 300 }),
      )
    })
  })

  describe('confirmUpload', () => {
    it('returns confirmed upload with mediaRef for valid JPEG', async () => {
      // JPEG magic: FF D8 FF
      const jpegHead = Buffer.alloc(4096)
      jpegHead[0] = 0xff
      jpegHead[1] = 0xd8
      jpegHead[2] = 0xff

      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 1024, ContentType: 'image/jpeg' }) // HeadObject
        .mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(jpegHead)) } }) // GetObject

      const client = (storage as any).client
      client.send = mockSend

      const result = await storage.confirmUpload('photos/hunan/test-uuid-1234.jpg')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.jpg')
      expect(result.size).toBe(1024)
    })

    it('returns confirmed upload with mediaRef for valid PNG', async () => {
      // PNG magic: 89 50 4E 47 0D 0A 1A 0A
      const pngHead = Buffer.alloc(4096)
      pngHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 2048, ContentType: 'image/png' })
        .mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(pngHead)) } })

      const client = (storage as any).client
      client.send = mockSend

      const result = await storage.confirmUpload('photos/hunan/test-uuid-1234.png')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.png')
      expect(result.size).toBe(2048)
    })

    it('returns confirmed upload with mediaRef for valid WebP', async () => {
      // WebP magic: RIFF....WEBP
      const webpHead = Buffer.alloc(4096)
      webpHead.set([0x52, 0x49, 0x46, 0x46]) // RIFF
      webpHead.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP at offset 8

      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 3072, ContentType: 'image/webp' })
        .mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(webpHead)) } })

      const client = (storage as any).client
      client.send = mockSend

      const result = await storage.confirmUpload('photos/hunan/test-uuid-1234.webp')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.webp')
      expect(result.size).toBe(3072)
    })

    it('throws 422 when object exceeds 10 MiB', async () => {
      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' })

      const client = (storage as any).client
      client.send = mockSend

      await expect(storage.confirmUpload('photos/hunan/big.jpg')).rejects.toThrow(
        'Object exceeds 10 MiB limit',
      )
    })

    it('throws 422 when magic bytes do not match content type (fake JPEG)', async () => {
      // Send PNG magic but claim JPEG content type
      const pngHead = Buffer.alloc(4096)
      pngHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 1024, ContentType: 'image/jpeg' })
        .mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(pngHead)) } })

      const client = (storage as any).client
      client.send = mockSend

      await expect(storage.confirmUpload('photos/hunan/fake.jpg')).rejects.toThrow(
        'Magic bytes do not match declared content type',
      )
    })

    it('throws 422 when content type is not supported', async () => {
      const gifHead = Buffer.alloc(4096)
      gifHead.set([0x47, 0x49, 0x46, 0x38]) // GIF89

      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 1024, ContentType: 'image/gif' })
        .mockResolvedValueOnce({ Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(gifHead)) } })

      const client = (storage as any).client
      client.send = mockSend

      await expect(storage.confirmUpload('photos/hunan/anim.gif')).rejects.toThrow(
        'Unsupported content type',
      )
    })

    it('throws 422 when object does not exist', async () => {
      const mockSend = vi.fn().mockRejectedValueOnce(new Error('NoSuchKey'))

      const client = (storage as any).client
      client.send = mockSend

      await expect(storage.confirmUpload('photos/hunan/missing.jpg')).rejects.toThrow(
        'Object not found',
      )
    })

    it('does not return mediaRef or readUrl on validation failure', async () => {
      const mockSend = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' })

      const client = (storage as any).client
      client.send = mockSend

      try {
        await storage.confirmUpload('photos/hunan/big.jpg')
      } catch (e: unknown) {
        const err = e as any
        expect(err.mediaRef).toBeUndefined()
        expect(err.readUrl).toBeUndefined()
      }
    })
  })

  describe('delete', () => {
    it('sends DeleteObjectCommand to S3 client', async () => {
      const mockSend = vi.fn().mockResolvedValue({})
      const client = (storage as any).client
      client.send = mockSend

      await storage.delete('photos/hunan/test.webp')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'photos/hunan/test.webp',
          }),
        }),
      )
    })
  })
})
