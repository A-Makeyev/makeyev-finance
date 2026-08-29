import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  test: {
    include: ['client/tests/unit/**/*.test.ts', 'server/**/*.test.js'],
    environment: 'node',
  },
})
