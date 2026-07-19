import { describe, it, expect } from 'vitest'
import { loadStorageConfig } from '../storage-config'

describe('loadStorageConfig', () => {
  const validEnv = {
    STORAGE_DRIVER: 'r2',
    R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    R2_ACCESS_KEY_ID: 'test-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET: 'test-bucket',
    STORAGE_ALLOWED_ORIGINS: 'https://example.com,https://app.example.com',
  }

  it('returns valid config when all R2 env vars are present', () => {
    const config = loadStorageConfig(validEnv as unknown as NodeJS.ProcessEnv)
    expect(config).toEqual({
      driver: 'r2',
      allowedOrigins: ['https://example.com', 'https://app.example.com'],
      r2: {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret-key',
        bucket: 'test-bucket',
      },
    })
  })

  it('throws when STORAGE_DRIVER is missing', () => {
    const env = { ...validEnv, STORAGE_DRIVER: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'STORAGE_DRIVER is required',
    )
  })

  it('throws when STORAGE_DRIVER is unsupported', () => {
    const env = { ...validEnv, STORAGE_DRIVER: 'gcs' }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'Unsupported STORAGE_DRIVER: gcs',
    )
  })

  it('throws when R2_ENDPOINT is missing for r2 driver', () => {
    const env = { ...validEnv, R2_ENDPOINT: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'R2_ENDPOINT is required',
    )
  })

  it('throws when R2_ACCESS_KEY_ID is missing for r2 driver', () => {
    const env = { ...validEnv, R2_ACCESS_KEY_ID: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'R2_ACCESS_KEY_ID is required',
    )
  })

  it('throws when R2_SECRET_ACCESS_KEY is missing for r2 driver', () => {
    const env = { ...validEnv, R2_SECRET_ACCESS_KEY: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'R2_SECRET_ACCESS_KEY is required',
    )
  })

  it('throws when R2_BUCKET is missing for r2 driver', () => {
    const env = { ...validEnv, R2_BUCKET: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'R2_BUCKET is required',
    )
  })

  it('throws when STORAGE_ALLOWED_ORIGINS is missing', () => {
    const env = { ...validEnv, STORAGE_ALLOWED_ORIGINS: undefined }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'STORAGE_ALLOWED_ORIGINS is required',
    )
  })

  it('throws when STORAGE_ALLOWED_ORIGINS contains wildcard *', () => {
    const env = { ...validEnv, STORAGE_ALLOWED_ORIGINS: '*' }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'STORAGE_ALLOWED_ORIGINS must not contain wildcard',
    )
  })

  it('throws when STORAGE_ALLOWED_ORIGINS contains * among valid origins', () => {
    const env = { ...validEnv, STORAGE_ALLOWED_ORIGINS: 'https://example.com,*' }
    expect(() => loadStorageConfig(env as unknown as NodeJS.ProcessEnv)).toThrow(
      'STORAGE_ALLOWED_ORIGINS must not contain wildcard',
    )
  })

  it('error messages do not leak credential values', () => {
    const env = { ...validEnv, R2_ENDPOINT: undefined }
    try {
      loadStorageConfig(env as unknown as NodeJS.ProcessEnv)
    } catch (e: unknown) {
      const message = (e as Error).message
      expect(message).not.toContain('test-key-id')
      expect(message).not.toContain('test-secret-key')
    }
  })
})
