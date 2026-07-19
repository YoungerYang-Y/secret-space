import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { AppModule } from '../app.module'
import { MEDIA_STORAGE } from '../media/media-storage'
import type { MediaStorage } from '../media/media-storage'
import * as jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../auth/auth.service'

export const visitorToken = jwt.sign({ role: 'visitor' }, JWT_SECRET, { expiresIn: '1h' })
export const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })

export function createMockStorage(): MediaStorage {
  return {
    presignPhotoUpload: vi.fn().mockImplementation(async (provinceCode, ext, contentType) => ({
      uploadUrl: `https://mock-r2.example.com/upload?key=photos/${provinceCode}/mock-uuid${ext}`,
      key: `photos/${provinceCode}/mock-uuid${ext}`,
      mediaRef: `media://photos/${provinceCode}/mock-uuid${ext}`,
    })),
    presignAlbumUpload: vi.fn().mockImplementation(async (ext, contentType) => ({
      uploadUrl: `https://mock-r2.example.com/upload?key=photos/album/mock-uuid${ext}`,
      key: `photos/album/mock-uuid${ext}`,
      mediaRef: `media://photos/album/mock-uuid${ext}`,
    })),
    confirmUpload: vi.fn().mockImplementation(async (key: string) => ({
      mediaRef: `media://${key}`,
      size: 12345,
    })),
    presignRead: vi.fn().mockImplementation(async (key: string) => `https://signed.example.com/${key}?token=abc&expires=300`),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

export async function createTestApp(options?: { validation?: boolean }) {
  const mockStorage = createMockStorage()
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MEDIA_STORAGE)
    .useValue(mockStorage)
    .compile()
  const app = module.createNestApplication()
  app.setGlobalPrefix('api', { exclude: ['health'] })
  if (options?.validation !== false) {
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  }
  await app.init()
  return { app, module, mockStorage }
}
