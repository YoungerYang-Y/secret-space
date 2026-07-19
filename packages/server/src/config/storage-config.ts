export type StorageDriver = 'r2'

export interface R2Config {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export interface StorageConfig {
  driver: StorageDriver
  allowedOrigins: string[]
  r2: R2Config
}

const SUPPORTED_DRIVERS: readonly StorageDriver[] = ['r2'] as const

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]
  if (!value) {
    throw new Error(`${key} is required`)
  }
  return value
}

export function loadStorageConfig(env: NodeJS.ProcessEnv): StorageConfig {
  const driverRaw = env.STORAGE_DRIVER
  if (!driverRaw) {
    throw new Error('STORAGE_DRIVER is required')
  }

  if (!SUPPORTED_DRIVERS.includes(driverRaw as StorageDriver)) {
    throw new Error(`Unsupported STORAGE_DRIVER: ${driverRaw}`)
  }
  const driver = driverRaw as StorageDriver

  const originsRaw = env.STORAGE_ALLOWED_ORIGINS
  if (!originsRaw) {
    throw new Error('STORAGE_ALLOWED_ORIGINS is required')
  }

  const origins = originsRaw.split(',').map((o) => o.trim())
  if (origins.some((o) => o === '*')) {
    throw new Error('STORAGE_ALLOWED_ORIGINS must not contain wildcard')
  }

  switch (driver) {
    case 'r2': {
      const r2: R2Config = {
        endpoint: requireEnv(env, 'R2_ENDPOINT'),
        accessKeyId: requireEnv(env, 'R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv(env, 'R2_SECRET_ACCESS_KEY'),
        bucket: requireEnv(env, 'R2_BUCKET'),
      }
      return { driver, allowedOrigins: origins, r2 }
    }
    default: {
      const _exhaustive: never = driver
      throw new Error(`Unhandled driver: ${_exhaustive}`)
    }
  }
}
