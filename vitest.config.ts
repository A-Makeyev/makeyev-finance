import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // The auth suites boot an in-memory Mongo in beforeAll; on a loaded machine
    // the first sign-in can cross the 5s default and fail for being slow
    // rather than wrong.
    testTimeout: 15_000,
  },
})
