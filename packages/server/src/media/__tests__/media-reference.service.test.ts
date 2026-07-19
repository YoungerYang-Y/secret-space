import { describe, it, expect } from 'vitest'
import { MediaReferenceService } from '../media-reference.service'
import type { MediaReference } from '../media-reference.service'

describe('MediaReferenceService', () => {
  const service = new MediaReferenceService()
  const allowedPrefixes = ['photos/', 'albums/']

  describe('fromMediaRef', () => {
    it('accepts valid media:// reference with allowed prefix', () => {
      const result = service.fromMediaRef('media://photos/hunan/x.webp', allowedPrefixes)
      expect(result).toBe('media://photos/hunan/x.webp')
    })

    it('accepts media:// reference with nested path', () => {
      const result = service.fromMediaRef('media://photos/album/abc-123.jpg', allowedPrefixes)
      expect(result).toBe('media://photos/album/abc-123.jpg')
    })

    it('rejects r2:// protocol', () => {
      expect(() => service.fromMediaRef('r2://photos/hunan/x.webp', allowedPrefixes)).toThrow()
    })

    it('rejects s3:// protocol', () => {
      expect(() => service.fromMediaRef('s3://bucket/photos/x.webp', allowedPrefixes)).toThrow()
    })

    it('rejects HTTP URL', () => {
      expect(() =>
        service.fromMediaRef('https://cdn.example.com/photos/hunan/x.webp', allowedPrefixes),
      ).toThrow()
    })

    it('rejects http URL', () => {
      expect(() =>
        service.fromMediaRef('http://cdn.example.com/photos/hunan/x.webp', allowedPrefixes),
      ).toThrow()
    })

    it('rejects path traversal with ../', () => {
      expect(() =>
        service.fromMediaRef('media://photos/../../../etc/passwd', allowedPrefixes),
      ).toThrow()
    })

    it('rejects path traversal with encoded ..', () => {
      expect(() =>
        service.fromMediaRef('media://photos/%2e%2e/secret', allowedPrefixes),
      ).toThrow()
    })

    it('rejects prefix not in allowedPrefixes', () => {
      expect(() => service.fromMediaRef('media://private/secret.webp', allowedPrefixes)).toThrow()
    })

    it('rejects empty logical key', () => {
      expect(() => service.fromMediaRef('media://', allowedPrefixes)).toThrow()
    })

    it('rejects input without media:// prefix', () => {
      expect(() => service.fromMediaRef('photos/hunan/x.webp', allowedPrefixes)).toThrow()
    })
  })

  describe('toLogicalKey', () => {
    it('extracts logical key from valid media:// reference', () => {
      const ref: MediaReference = 'media://photos/hunan/x.webp'
      const result = service.toLogicalKey(ref, allowedPrefixes)
      expect(result).toBe('photos/hunan/x.webp')
    })

    it('extracts logical key with nested path', () => {
      const ref: MediaReference = 'media://photos/album/abc-123.jpg'
      const result = service.toLogicalKey(ref, allowedPrefixes)
      expect(result).toBe('photos/album/abc-123.jpg')
    })

    it('rejects reference with disallowed prefix', () => {
      const ref: MediaReference = 'media://private/secret.webp'
      expect(() => service.toLogicalKey(ref, allowedPrefixes)).toThrow()
    })

    it('rejects reference with path traversal', () => {
      const ref: MediaReference = 'media://photos/../etc/passwd'
      expect(() => service.toLogicalKey(ref, allowedPrefixes)).toThrow()
    })
  })

  describe('fromLegacyUrl', () => {
    const legacyOrigin = 'https://pub-abc123.r2.dev'

    beforeAll(() => {
      process.env.R2_LEGACY_PUBLIC_URL = legacyOrigin
    })

    afterAll(() => {
      delete process.env.R2_LEGACY_PUBLIC_URL
    })

    it('converts legacy R2 public URL to media:// reference', () => {
      const result = service.fromLegacyUrl(
        `${legacyOrigin}/photos/hunan/old-image.webp`,
        allowedPrefixes,
      )
      expect(result).toBe('media://photos/hunan/old-image.webp')
    })

    it('converts legacy URL with nested path', () => {
      const result = service.fromLegacyUrl(
        `${legacyOrigin}/photos/album/cover.jpg`,
        allowedPrefixes,
      )
      expect(result).toBe('media://photos/album/cover.jpg')
    })

    it('rejects URL from different origin', () => {
      expect(() =>
        service.fromLegacyUrl('https://other-cdn.example.com/photos/x.webp', allowedPrefixes),
      ).toThrow()
    })

    it('rejects legacy URL with disallowed prefix in path', () => {
      expect(() =>
        service.fromLegacyUrl(`${legacyOrigin}/private/secret.webp`, allowedPrefixes),
      ).toThrow()
    })

    it('rejects legacy URL with path traversal', () => {
      expect(() =>
        service.fromLegacyUrl(`${legacyOrigin}/photos/../etc/passwd`, allowedPrefixes),
      ).toThrow()
    })

    it('rejects input that is already a media:// reference', () => {
      expect(() =>
        service.fromLegacyUrl('media://photos/hunan/x.webp', allowedPrefixes),
      ).toThrow()
    })

    it('throws when R2_LEGACY_PUBLIC_URL is not set', () => {
      const saved = process.env.R2_LEGACY_PUBLIC_URL
      delete process.env.R2_LEGACY_PUBLIC_URL
      expect(() =>
        service.fromLegacyUrl(`${legacyOrigin}/photos/hunan/x.webp`, allowedPrefixes),
      ).toThrow()
      process.env.R2_LEGACY_PUBLIC_URL = saved
    })
  })
})
