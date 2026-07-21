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
  CopyObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned.example.com/signed'),
}))

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}))

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
    it('generates staging key with tmp/photos/<provinceCode>/<uuid><ext> pattern', async () => {
      const result = await storage.presignPhotoUpload('hunan', '.webp', 'image/webp')
      expect(result.key).toBe('tmp/photos/hunan/test-uuid-1234.webp')
    })

    it('returns uploadUrl from presigner', async () => {
      const result = await storage.presignPhotoUpload('hunan', '.webp', 'image/webp')
      expect(result.uploadUrl).toBe('https://presigned.example.com/signed')
    })

    it('returns final mediaRef (不含 tmp/) with media:// protocol', async () => {
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
    it('generates staging key with tmp/photos/album/<uuid><ext> pattern', async () => {
      const result = await storage.presignAlbumUpload('.jpg', 'image/jpeg')
      expect(result.key).toBe('tmp/photos/album/test-uuid-1234.jpg')
    })

    it('returns final mediaRef (不含 tmp/) with media:// protocol', async () => {
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
    function mockClientSend(...responses: unknown[]) {
      const mockSend = vi.fn()
      for (const r of responses) {
        if (r instanceof Error) mockSend.mockRejectedValueOnce(r)
        else mockSend.mockResolvedValueOnce(r)
      }
      mockSend.mockResolvedValue({})
      const client = (storage as any).client
      client.send = mockSend
      return mockSend
    }

    function jpegHead(): Uint8Array {
      const head = Buffer.alloc(4096)
      head[0] = 0xff
      head[1] = 0xd8
      head[2] = 0xff
      return new Uint8Array(head)
    }

    it('校验通过后将 tmp 对象拷贝到最终 key 并删除 tmp，返回最终 mediaRef', async () => {
      const mockSend = mockClientSend(
        { ContentLength: 1024, ContentType: 'image/jpeg' }, // HeadObject
        { Body: { transformToByteArray: () => Promise.resolve(jpegHead()) } }, // GetObject
        {}, // CopyObject
        {}, // DeleteObject
      )

      const result = await storage.confirmUpload('tmp/photos/hunan/test-uuid-1234.jpg')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.jpg')
      expect(result.size).toBe(1024)

      // 调用顺序：HeadObject → GetObject → CopyObject → DeleteObject
      const inputs = mockSend.mock.calls.map((c) => c[0].input)
      expect(inputs[2]).toEqual({
        Bucket: 'test-bucket',
        Key: 'photos/hunan/test-uuid-1234.jpg',
        CopySource: 'test-bucket/tmp/photos/hunan/test-uuid-1234.jpg',
      })
      expect(inputs[3]).toEqual({
        Bucket: 'test-bucket',
        Key: 'tmp/photos/hunan/test-uuid-1234.jpg',
      })
    })

    it('returns confirmed upload with mediaRef for valid PNG', async () => {
      const pngHead = Buffer.alloc(4096)
      pngHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      mockClientSend(
        { ContentLength: 2048, ContentType: 'image/png' },
        { Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(pngHead)) } },
        {},
        {},
      )

      const result = await storage.confirmUpload('tmp/photos/hunan/test-uuid-1234.png')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.png')
      expect(result.size).toBe(2048)
    })

    it('returns confirmed upload with mediaRef for valid WebP', async () => {
      const webpHead = Buffer.alloc(4096)
      webpHead.set([0x52, 0x49, 0x46, 0x46]) // RIFF
      webpHead.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP at offset 8

      mockClientSend(
        { ContentLength: 3072, ContentType: 'image/webp' },
        { Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(webpHead)) } },
        {},
        {},
      )

      const result = await storage.confirmUpload('tmp/photos/hunan/test-uuid-1234.webp')
      expect(result.mediaRef).toBe('media://photos/hunan/test-uuid-1234.webp')
      expect(result.size).toBe(3072)
    })

    it('拒绝非 tmp/ 前缀的 key', async () => {
      await expect(storage.confirmUpload('photos/hunan/x.jpg')).rejects.toThrow(
        'Invalid staging key',
      )
    })

    it('throws 422 when object exceeds 10 MiB', async () => {
      mockClientSend({ ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' })

      await expect(storage.confirmUpload('tmp/photos/hunan/big.jpg')).rejects.toThrow(
        'Object exceeds 10 MiB limit',
      )
    })

    it('throws 422 when magic bytes do not match content type (fake JPEG)', async () => {
      const pngHead = Buffer.alloc(4096)
      pngHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

      mockClientSend(
        { ContentLength: 1024, ContentType: 'image/jpeg' },
        { Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(pngHead)) } },
      )

      await expect(storage.confirmUpload('tmp/photos/hunan/fake.jpg')).rejects.toThrow(
        'Magic bytes do not match declared content type',
      )
    })

    it('throws 422 when content type is not supported', async () => {
      const gifHead = Buffer.alloc(4096)
      gifHead.set([0x47, 0x49, 0x46, 0x38]) // GIF89

      mockClientSend(
        { ContentLength: 1024, ContentType: 'image/gif' },
        { Body: { transformToByteArray: () => Promise.resolve(new Uint8Array(gifHead)) } },
      )

      await expect(storage.confirmUpload('tmp/photos/hunan/anim.gif')).rejects.toThrow(
        'Unsupported content type',
      )
    })

    it('throws 422 when object does not exist', async () => {
      mockClientSend(new Error('NoSuchKey'))

      await expect(storage.confirmUpload('tmp/photos/hunan/missing.jpg')).rejects.toThrow(
        'Object not found',
      )
    })

    it('拷贝失败时抛出且不返回 mediaRef/readUrl', async () => {
      mockClientSend(
        { ContentLength: 1024, ContentType: 'image/jpeg' },
        { Body: { transformToByteArray: () => Promise.resolve(jpegHead()) } },
        new Error('Copy failed'),
      )

      try {
        await storage.confirmUpload('tmp/photos/hunan/copy-fail.jpg')
        expect.unreachable('should have thrown')
      } catch (e: unknown) {
        const err = e as any
        expect(err.name).toBe('ConfirmUploadError')
        expect(err.message).toBe('Failed to promote staged object')
        expect(err.mediaRef).toBeUndefined()
        expect(err.readUrl).toBeUndefined()
      }
    })

    it('does not return mediaRef or readUrl on validation failure', async () => {
      mockClientSend({ ContentLength: 11 * 1024 * 1024, ContentType: 'image/jpeg' })

      try {
        await storage.confirmUpload('tmp/photos/hunan/big.jpg')
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
