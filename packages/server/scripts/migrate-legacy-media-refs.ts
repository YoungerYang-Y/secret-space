import type { PrismaClient } from '@prisma/client'
import { MediaReferenceService } from '../src/media/media-reference.service'

const MEDIA_PROTOCOL = 'media://'
const MIGRATION_KEY = 'media_reference_migration_v1'
const ALLOWED_PREFIXES = ['photos/']

export type MigrationFailure = {
  entity: string
  id: number | string
  field: string
  value: string
  reason: string
}

export type MigrationResult = {
  stats: {
    photos: number
    albums: number
    pages: number
  }
  failures: MigrationFailure[]
  applied: boolean
  skippedReason?: string
  exitCode: number
}

type PhotoRecord = { id: number; url: string; key: string }
type AlbumRecord = { id: string; coverUrl: string | null }
type PageRecord = { id: string; content: string }

export async function migrateLegacyMediaRefs(
  prisma: PrismaClient,
  options: { dryRun: boolean },
): Promise<MigrationResult> {
  const service = new MediaReferenceService()

  // Check if already migrated
  if (!options.dryRun) {
    const existing = await (prisma as any).config.findUnique({
      where: { key: MIGRATION_KEY },
    })
    if (existing) {
      return {
        stats: { photos: 0, albums: 0, pages: 0 },
        failures: [],
        applied: false,
        skippedReason: 'already_migrated',
        exitCode: 0,
      }
    }
  }

  const failures: MigrationFailure[] = []

  // Collect photos needing migration
  const photos: PhotoRecord[] = await (prisma as any).photo.findMany()
  const photosToMigrate = photos.filter((p) => !p.url.startsWith(MEDIA_PROTOCOL))

  for (const photo of photosToMigrate) {
    try {
      service.fromLegacyUrl(photo.url, ALLOWED_PREFIXES)
    } catch (e: unknown) {
      failures.push({
        entity: 'photo',
        id: photo.id,
        field: 'url',
        value: photo.url,
        reason: (e as Error).message,
      })
    }
  }

  // Collect albums needing migration
  const albums: AlbumRecord[] = await (prisma as any).album.findMany()
  const albumsToMigrate = albums.filter(
    (a) => a.coverUrl && !a.coverUrl.startsWith(MEDIA_PROTOCOL),
  )

  for (const album of albumsToMigrate) {
    try {
      service.fromLegacyUrl(album.coverUrl!, ALLOWED_PREFIXES)
    } catch (e: unknown) {
      failures.push({
        entity: 'album',
        id: album.id,
        field: 'coverUrl',
        value: album.coverUrl!,
        reason: (e as Error).message,
      })
    }
  }

  // Collect pages needing migration
  const pages: PageRecord[] = await (prisma as any).page.findMany()
  const pagesToMigrate: Array<{ page: PageRecord; images: string[] }> = []

  for (const page of pages) {
    try {
      const content = JSON.parse(page.content)
      const images: string[] = content.images ?? []
      const needsMigration = images.some((img: string) => !img.startsWith(MEDIA_PROTOCOL))
      if (needsMigration) {
        // Validate all images can be converted
        for (const img of images) {
          if (!img.startsWith(MEDIA_PROTOCOL)) {
            service.fromLegacyUrl(img, ALLOWED_PREFIXES)
          }
        }
        pagesToMigrate.push({ page, images })
      }
    } catch (e: unknown) {
      failures.push({
        entity: 'page',
        id: page.id,
        field: 'content.images',
        value: page.content,
        reason: (e as Error).message,
      })
    }
  }

  const stats = {
    photos: photosToMigrate.length - failures.filter((f) => f.entity === 'photo').length,
    albums: albumsToMigrate.length - failures.filter((f) => f.entity === 'album').length,
    pages: pagesToMigrate.length,
  }

  // If there are failures, abort
  if (failures.length > 0) {
    return {
      stats,
      failures,
      applied: false,
      exitCode: 1,
    }
  }

  // Dry-run: report only
  if (options.dryRun) {
    return {
      stats,
      failures: [],
      applied: false,
      exitCode: 0,
    }
  }

  // Apply mode: write in transaction
  await (prisma as any).$transaction(async (tx: any) => {
    // Migrate photos
    for (const photo of photosToMigrate) {
      const mediaRef = service.fromLegacyUrl(photo.url, ALLOWED_PREFIXES)
      const key = mediaRef.slice(MEDIA_PROTOCOL.length)
      await tx.photo.update({
        where: { id: photo.id },
        data: { url: mediaRef, key },
      })
    }

    // Migrate albums
    for (const album of albumsToMigrate) {
      const mediaRef = service.fromLegacyUrl(album.coverUrl!, ALLOWED_PREFIXES)
      await tx.album.update({
        where: { id: album.id },
        data: { coverUrl: mediaRef },
      })
    }

    // Migrate pages
    for (const { page } of pagesToMigrate) {
      const content = JSON.parse(page.content)
      const images: string[] = content.images ?? []
      content.images = images.map((img: string) => {
        if (img.startsWith(MEDIA_PROTOCOL)) return img
        return service.fromLegacyUrl(img, ALLOWED_PREFIXES)
      })
      await tx.page.update({
        where: { id: page.id },
        data: { content: JSON.stringify(content) },
      })
    }

    // Record migration marker
    await tx.config.upsert({
      where: { key: MIGRATION_KEY },
      update: { value: new Date().toISOString() },
      create: { key: MIGRATION_KEY, value: new Date().toISOString() },
    })
  })

  return {
    stats,
    failures: [],
    applied: true,
    exitCode: 0,
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')

  // Dynamic import to avoid bundling prisma client at compile time
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const result = await migrateLegacyMediaRefs(prisma, { dryRun })

    console.log(`\n=== Media Reference Migration ${dryRun ? '(DRY RUN)' : '(APPLY)'} ===\n`)
    console.log(`Photos to migrate: ${result.stats.photos}`)
    console.log(`Albums to migrate: ${result.stats.albums}`)
    console.log(`Pages to migrate:  ${result.stats.pages}`)

    if (result.skippedReason === 'already_migrated') {
      console.log('\n✓ Migration already applied. No changes needed.')
      process.exit(0)
    }

    if (result.failures.length > 0) {
      console.error(`\n✗ ${result.failures.length} failure(s) detected:\n`)
      for (const f of result.failures) {
        console.error(`  [${f.entity}#${f.id}] ${f.field}: ${f.reason}`)
        console.error(`    value: ${f.value}\n`)
      }
    }

    if (result.applied) {
      console.log('\n✓ Migration applied successfully.')
    } else if (dryRun && result.failures.length === 0) {
      console.log('\n✓ All records are convertible. Run with --apply to execute.')
    }

    process.exit(result.exitCode)
  } finally {
    await prisma.$disconnect()
  }
}

// Only run main when executed directly
if (process.argv[1]?.includes('migrate-legacy-media-refs')) {
  main()
}
