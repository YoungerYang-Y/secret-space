import { describe, it, expect, vi } from 'vitest'
import type { INestApplication } from '@nestjs/common'
import type { StorageConfig } from '../storage-config'
import { configureCors } from '../configure-cors'

function createMockApp() {
  const enableCorsFn = vi.fn()
  return {
    enableCors: enableCorsFn,
  } as unknown as INestApplication
}

function createValidConfig(): StorageConfig {
  return {
    driver: 'r2',
    allowedOrigins: ['https://example.com', 'https://app.example.com'],
    r2: {
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucket: 'test-bucket',
    },
  }
}

describe('configureCors', () => {
  it('calls enableCors with exact origins from config', () => {
    const app = createMockApp()
    const config = createValidConfig()

    configureCors(app, config)

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: ['https://example.com', 'https://app.example.com'],
      }),
    )
  })

  it('sets allowed methods to GET, POST, PUT, DELETE, OPTIONS', () => {
    const app = createMockApp()
    const config = createValidConfig()

    configureCors(app, config)

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    )
  })

  it('sets allowed headers to Authorization and Content-Type', () => {
    const app = createMockApp()
    const config = createValidConfig()

    configureCors(app, config)

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedHeaders: ['Authorization', 'Content-Type'],
      }),
    )
  })

  it('enables credentials', () => {
    const app = createMockApp()
    const config = createValidConfig()

    configureCors(app, config)

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: true,
      }),
    )
  })
})
