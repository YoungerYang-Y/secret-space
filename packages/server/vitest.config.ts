import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
    },
    globalSetup: ['./src/__tests__/global-setup.ts'],
  },
})
