import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      STORAGE_DRIVER: 'r2',
      R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'test-key-id',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      R2_BUCKET: 'test-bucket',
      STORAGE_ALLOWED_ORIGINS: 'http://localhost:5173',
    },
    globalSetup: ['./src/__tests__/global-setup.ts'],
  },
  plugins: [swc.vite()],
})
