import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Frontend lives in client/; repo-root .env is loaded via envDir: '..'.
  root: 'client',
  envDir: '..',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
  },
})
