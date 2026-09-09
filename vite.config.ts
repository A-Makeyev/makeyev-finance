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
  server: {
    // Dev only: the express server (server/server.js, `npm run dev:all` on
    // port 3000) owns /api - production serves both from one process.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
