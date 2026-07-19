import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { MediaModule } from '../media.module'
import { MEDIA_STORAGE } from '../media-storage'
import { R2MediaStorage } from '../r2-media-storage'

// Mock the R2MediaStorage to avoid real S3 client creation
vi.mock('../r2-media-storage', () => ({
  R2MediaStorage: vi.fn().mockImplementation(() => ({
    presignPhotoUpload: vi.fn(),
    presignAlbumUpload: vi.fn(),
    confirmUpload: vi.fn(),
    presignRead: vi.fn(),
    delete: vi.fn(),
  })),
}))

describe('MediaModule', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('binds MEDIA_STORAGE to R2MediaStorage when STORAGE_DRIVER=r2', async () => {
    process.env.STORAGE_DRIVER = 'r2'
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'test-bucket'
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    const module = await Test.createTestingModule({
      imports: [MediaModule],
    }).compile()

    const storage = module.get(MEDIA_STORAGE)
    expect(storage).toBeDefined()
    expect(R2MediaStorage).toHaveBeenCalledWith({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
    })
  })

  it('throws on startup when STORAGE_DRIVER is missing', async () => {
    delete process.env.STORAGE_DRIVER
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'test-bucket'
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    await expect(
      Test.createTestingModule({ imports: [MediaModule] }).compile(),
    ).rejects.toThrow('STORAGE_DRIVER is required')
  })

  it('throws on startup when STORAGE_DRIVER is unsupported', async () => {
    process.env.STORAGE_DRIVER = 'gcs'
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    await expect(
      Test.createTestingModule({ imports: [MediaModule] }).compile(),
    ).rejects.toThrow('Unsupported STORAGE_DRIVER: gcs')
  })

  it('throws on startup when R2 config vars are missing', async () => {
    process.env.STORAGE_DRIVER = 'r2'
    delete process.env.R2_ENDPOINT
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    await expect(
      Test.createTestingModule({ imports: [MediaModule] }).compile(),
    ).rejects.toThrow('R2_ENDPOINT is required')
  })

  it('throws when STORAGE_ALLOWED_ORIGINS contains wildcard *', async () => {
    process.env.STORAGE_DRIVER = 'r2'
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'test-bucket'
    process.env.STORAGE_ALLOWED_ORIGINS = '*'

    await expect(
      Test.createTestingModule({ imports: [MediaModule] }).compile(),
    ).rejects.toThrow('STORAGE_ALLOWED_ORIGINS must not contain wildcard')
  })

  it('error messages do not leak credential values', async () => {
    process.env.STORAGE_DRIVER = 'r2'
    delete process.env.R2_ENDPOINT
    process.env.R2_ACCESS_KEY_ID = 'super-secret-key-id'
    process.env.R2_SECRET_ACCESS_KEY = 'super-secret-access-key'
    process.env.R2_BUCKET = 'test-bucket'
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    try {
      await Test.createTestingModule({ imports: [MediaModule] }).compile()
    } catch (e: unknown) {
      const message = (e as Error).message
      expect(message).not.toContain('super-secret-key-id')
      expect(message).not.toContain('super-secret-access-key')
    }
  })

  it('exports MEDIA_STORAGE for dependent modules', async () => {
    process.env.STORAGE_DRIVER = 'r2'
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'test-bucket'
    process.env.STORAGE_ALLOWED_ORIGINS = 'https://example.com'

    const module = await Test.createTestingModule({
      imports: [MediaModule],
    }).compile()

    // Should be resolvable from outside the module
    const storage = module.get(MEDIA_STORAGE)
    expect(storage.presignPhotoUpload).toBeDefined()
    expect(storage.presignAlbumUpload).toBeDefined()
    expect(storage.confirmUpload).toBeDefined()
    expect(storage.presignRead).toBeDefined()
    expect(storage.delete).toBeDefined()
  })
})
