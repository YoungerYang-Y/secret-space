import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { migrateLegacyMediaRefs } from '../../../scripts/migrate-legacy-media-refs'

describe('migrate-legacy-media-refs', () => {
  const legacyOrigin = 'https://pub-abc123.r2.dev'
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, R2_LEGACY_PUBLIC_URL: legacyOrigin }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function createMockPrisma(data: {
    photos?: Array<{ id: number; url: string; key: string }>
    albums?: Array<{ id: string; coverUrl: string | null }>
    pages?: Array<{ id: string; content: string }>
    configs?: Array<{ key: string; value: string }>
  }) {
    const photos = data.photos ?? []
    const albums = data.albums ?? []
    const pages = data.pages ?? []
    const configs = data.configs ?? []

    const txUpdates: any[] = []

    return {
      photo: {
        findMany: vi.fn().mockResolvedValue(photos),
        update: vi.fn().mockImplementation((args) => {
          txUpdates.push({ entity: 'photo', ...args })
          return Promise.resolve({})
        }),
      },
      album: {
        findMany: vi.fn().mockResolvedValue(albums),
        update: vi.fn().mockImplementation((args) => {
          txUpdates.push({ entity: 'album', ...args })
          return Promise.resolve({})
        }),
      },
      page: {
        findMany: vi.fn().mockResolvedValue(pages),
        update: vi.fn().mockImplementation((args) => {
          txUpdates.push({ entity: 'page', ...args })
          return Promise.resolve({})
        }),
      },
      config: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const found = configs.find((c) => c.key === where.key)
          return Promise.resolve(found ?? null)
        }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<void>) => {
        const tx = {
          photo: { update: vi.fn().mockResolvedValue({}) },
          album: { update: vi.fn().mockResolvedValue({}) },
          page: { update: vi.fn().mockResolvedValue({}) },
          config: { upsert: vi.fn().mockResolvedValue({}) },
        }
        await fn(tx)
        return tx
      }),
      _txUpdates: txUpdates,
    }
  }

  describe('dry-run mode', () => {
    it('reports statistics of entities needing migration', async () => {
      const mockPrisma = createMockPrisma({
        photos: [
          { id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' },
          { id: 2, url: `${legacyOrigin}/photos/guangdong/b.jpg`, key: '' },
        ],
        albums: [{ id: 'album-1', coverUrl: `${legacyOrigin}/photos/album/cover.webp` }],
        pages: [
          {
            id: 'page-1',
            content: JSON.stringify({
              images: [`${legacyOrigin}/photos/album/img1.webp`],
            }),
          },
        ],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.stats.photos).toBe(2)
      expect(result.stats.albums).toBe(1)
      expect(result.stats.pages).toBe(1)
      expect(result.failures).toHaveLength(0)
      expect(result.applied).toBe(false)
    })

    it('reports failures for unconvertible URLs', async () => {
      const mockPrisma = createMockPrisma({
        photos: [
          { id: 1, url: 'https://other-cdn.com/photos/hunan/a.webp', key: '' },
          { id: 2, url: `${legacyOrigin}/photos/guangdong/b.jpg`, key: '' },
        ],
        albums: [],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.failures).toHaveLength(1)
      expect(result.failures[0]).toEqual({
        entity: 'photo',
        id: 1,
        field: 'url',
        value: 'https://other-cdn.com/photos/hunan/a.webp',
        reason: expect.stringContaining('origin'),
      })
    })

    it('does not write to database in dry-run', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' }],
        albums: [],
        pages: [],
      })

      await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('returns non-zero exit indicator when failures exist', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: 'https://evil.com/hack.webp', key: '' }],
        albums: [],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.exitCode).not.toBe(0)
    })

    it('returns zero exit code when all refs are convertible', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' }],
        albums: [],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.exitCode).toBe(0)
    })
  })

  describe('apply mode', () => {
    it('writes media:// references in a transaction', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' }],
        albums: [{ id: 'album-1', coverUrl: `${legacyOrigin}/photos/album/cover.webp` }],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: false })

      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(result.applied).toBe(true)
    })

    it('records migration marker media_reference_migration_v1', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' }],
        albums: [],
        pages: [],
      })

      await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: false })

      const txFn = mockPrisma.$transaction.mock.calls[0][0]
      const mockTx = {
        photo: { update: vi.fn().mockResolvedValue({}) },
        album: { update: vi.fn().mockResolvedValue({}) },
        page: { update: vi.fn().mockResolvedValue({}) },
        config: { upsert: vi.fn().mockResolvedValue({}) },
      }
      await txFn(mockTx)

      expect(mockTx.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'media_reference_migration_v1' },
        }),
      )
    })

    it('skips already-migrated records (media:// url)', async () => {
      const mockPrisma = createMockPrisma({
        photos: [
          { id: 1, url: 'media://photos/hunan/a.webp', key: 'photos/hunan/a.webp' },
          { id: 2, url: `${legacyOrigin}/photos/guangdong/b.jpg`, key: '' },
        ],
        albums: [],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.stats.photos).toBe(1) // only one needs migration
    })

    it('does not re-apply if migration marker already exists', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: `${legacyOrigin}/photos/hunan/a.webp`, key: '' }],
        albums: [],
        pages: [],
        configs: [{ key: 'media_reference_migration_v1', value: '2026-07-19T00:00:00Z' }],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: false })

      expect(result.applied).toBe(false)
      expect(result.skippedReason).toBe('already_migrated')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('aborts apply when failures are detected', async () => {
      const mockPrisma = createMockPrisma({
        photos: [{ id: 1, url: 'https://evil.com/hack.webp', key: '' }],
        albums: [],
        pages: [],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: false })

      expect(result.applied).toBe(false)
      expect(result.exitCode).not.toBe(0)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('handles Page content JSON with images array', async () => {
      const pageContent = JSON.stringify({
        images: [
          `${legacyOrigin}/photos/album/img1.webp`,
          `${legacyOrigin}/photos/album/img2.jpg`,
        ],
        text: 'some text',
      })

      const mockPrisma = createMockPrisma({
        photos: [],
        albums: [],
        pages: [{ id: 'page-1', content: pageContent }],
      })

      const result = await migrateLegacyMediaRefs(mockPrisma as any, { dryRun: true })

      expect(result.stats.pages).toBe(1)
      expect(result.failures).toHaveLength(0)
    })
  })
})
