import { BadRequestException, Injectable } from '@nestjs/common'

export type MediaReference = `media://${string}`

const MEDIA_PROTOCOL = 'media://'

@Injectable()
export class MediaReferenceService {
  /**
   * Validates and returns a MediaReference from a raw input string.
   * Only accepts media:// protocol with an allowed prefix.
   */
  fromMediaRef(input: string, allowedPrefixes: string[]): MediaReference {
    this.assertMediaProtocol(input)
    const logicalKey = input.slice(MEDIA_PROTOCOL.length)
    this.assertValidLogicalKey(logicalKey, allowedPrefixes)
    return input as MediaReference
  }

  /**
   * Extracts the logical key from a validated MediaReference.
   */
  toLogicalKey(reference: MediaReference, allowedPrefixes: string[]): string {
    const logicalKey = reference.slice(MEDIA_PROTOCOL.length)
    this.assertValidLogicalKey(logicalKey, allowedPrefixes)
    return logicalKey
  }

  /**
   * Converts a legacy R2 public URL to a vendor-neutral media:// reference.
   * Reads R2_LEGACY_PUBLIC_URL from environment to determine the origin.
   */
  fromLegacyUrl(input: string, allowedPrefixes: string[]): MediaReference {
    if (input.startsWith(MEDIA_PROTOCOL)) {
      throw new BadRequestException('Input is already a media:// reference')
    }

    const legacyOrigin = process.env.R2_LEGACY_PUBLIC_URL
    if (!legacyOrigin) {
      throw new BadRequestException('R2_LEGACY_PUBLIC_URL is not configured')
    }

    // Ensure the URL starts with the legacy origin
    const originWithSlash = legacyOrigin.endsWith('/') ? legacyOrigin : `${legacyOrigin}/`
    if (!input.startsWith(originWithSlash) && !input.startsWith(`${legacyOrigin}/`)) {
      throw new BadRequestException(
        `URL origin does not match R2_LEGACY_PUBLIC_URL: expected ${legacyOrigin}`,
      )
    }

    const pathPart = input.slice(originWithSlash.length)
    this.assertValidLogicalKey(pathPart, allowedPrefixes)

    return `${MEDIA_PROTOCOL}${pathPart}` as MediaReference
  }

  private assertMediaProtocol(input: string): void {
    if (!input.startsWith(MEDIA_PROTOCOL)) {
      throw new BadRequestException(
        `Invalid media reference: must start with ${MEDIA_PROTOCOL}`,
      )
    }

    // Reject other protocol-like patterns
    if (
      input.startsWith('r2://') ||
      input.startsWith('s3://') ||
      input.startsWith('http://') ||
      input.startsWith('https://')
    ) {
      throw new BadRequestException('Invalid media reference: vendor URLs are not allowed')
    }
  }

  private assertValidLogicalKey(key: string, allowedPrefixes: string[]): void {
    if (!key || key.length === 0) {
      throw new BadRequestException('Invalid media reference: empty logical key')
    }

    // Decode percent-encoded segments for traversal check
    const decoded = decodeURIComponent(key)

    // Reject path traversal
    if (decoded.includes('..') || key.includes('..')) {
      throw new BadRequestException('Invalid media reference: path traversal detected')
    }

    // Validate prefix
    const hasAllowedPrefix = allowedPrefixes.some((prefix) => key.startsWith(prefix))
    if (!hasAllowedPrefix) {
      throw new BadRequestException(
        `Invalid media reference: prefix not in allowed list [${allowedPrefixes.join(', ')}]`,
      )
    }
  }
}
