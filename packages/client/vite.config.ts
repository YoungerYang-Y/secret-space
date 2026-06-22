/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/tips': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/provinces': 'http://localhost:3000',
      '/photos': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
