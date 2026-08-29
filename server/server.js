import express from 'express'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Overridable for tests (see server/server.test.js); defaults to the built SPA.
const distDir = process.env.DIST_DIR
  ? path.resolve(process.env.DIST_DIR)
  : path.join(__dirname, '..', 'client', 'dist')
const port = Number(process.env.PORT) || 5173

export const app = express()

// Serve the built SPA (created by `npm run build`).
app.use(express.static(distDir))

// SPA fallback: hand client-side routes to index.html so deep links
// (e.g. /calculator) work on refresh and via direct navigation.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

// Only listen when run directly (`npm start`), not when imported by tests.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  app.listen(port, () => {
    console.log(`makeyev-finance serving ${distDir} on http://localhost:${port}`)
  })
}
