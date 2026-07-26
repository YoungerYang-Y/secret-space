import type { INestApplication } from '@nestjs/common'
import type { StorageConfig } from './storage-config'

export function configureCors(app: INestApplication, config: StorageConfig): void {
  app.enableCors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  })
}
