import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Point the server at a stub build before importing it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'makeyev-finance-'))
process.env.DIST_DIR = tmpDir

const { app } = await import('./server.js')

let server
let baseUrl

beforeAll(async () => {
  fs.writeFileSync(
    path.join(tmpDir, 'index.html'),
    '<!doctype html><html><head><title>Stub App</title></head><body>stub</body></html>',
  )
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://localhost:${server.address().port}`
})

afterAll(async () => {
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('server', () => {
  it('serves the SPA shell at /', async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<title>Stub App</title>')
  })

  it('falls back to the SPA shell for client-side routes', async () => {
    const res = await fetch(`${baseUrl}/calculator?loan=100000`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>Stub App</title>')
  })

  it('does not serve the SPA shell for non-GET requests', async () => {
    const res = await fetch(`${baseUrl}/`, { method: 'POST' })
    expect(res.status).toBe(404)
  })
})
