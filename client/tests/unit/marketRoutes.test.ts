import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { Express } from 'express'
import { marketRouter, setMarketService } from '../../../server/market/routes.ts'
import { MarketDataError } from '../../../server/market/types.ts'
import type { MarketQuote } from '../../../server/market/types.ts'
import { createServer, type Server } from 'node:http'

/**
 * API contract tests for GET /api/market/quotes: the normalized schema,
 * the ?ids= filter, error mapping, and the guarantee that neither an API
 * key nor raw upstream payloads ever appear in a response.
 */

function makeQuote(assetId: string): MarketQuote {
  return {
    assetId,
    name: assetId,
    price: 100.25,
    change: 0.5,
    changePercent: 0.42,
    currency: 'USD',
    timestamp: '2026-09-09T00:00:00.000Z',
  }
}

function appWith(service: unknown): Express {
  const app = express()
  setMarketService(service as never)
  app.use(marketRouter())
  return app
}

let server: Server
let baseUrl: string

beforeEach(async () => {
  server = createServer()
  await new Promise((resolve) => {
    server.listen(0, () => resolve(null))
  })
  baseUrl = `http://localhost:${(server.address() as { port: number }).port}`
})

afterEach(async () => {
  server.closeAllConnections?.()
  await new Promise((resolve) => {
    server.close(() => resolve(null))
  })
  setMarketService(null)
  vi.restoreAllMocks()
})

describe('GET /api/market/quotes', () => {
  it('returns the normalized schema', async () => {
    const app = appWith({
      available: true,
      getQuotes: async () => ({ quotes: [makeQuote('sp500'), makeQuote('bitcoin')] }),
    })
    const listener = app as unknown as (req: unknown, res: unknown) => void
    server.removeAllListeners('request')
    server.on('request', listener)

    const res = await fetch(`${baseUrl}/api/market/quotes`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = (await res.json()) as Record<string, unknown>
    expect(body.refreshIntervalMs).toEqual(expect.any(Number))
    expect(Array.isArray(body.quotes)).toBe(true)
    expect(Array.isArray(body.assets)).toBe(true)
    const quote = (body.quotes as Array<Record<string, unknown>>)[0]
    // Optional fields (marketStatus, stale) serialize only when defined, so
    // assert the required core plus that no unexpected/raw-provider keys exist.
    for (const key of [
      'assetId',
      'name',
      'price',
      'change',
      'changePercent',
      'currency',
      'timestamp',
    ]) {
      expect(quote).toHaveProperty(key)
    }
    expect(
      Object.keys(quote).every((key) =>
        [
          'assetId',
          'name',
          'price',
          'change',
          'changePercent',
          'currency',
          'timestamp',
          'marketStatus',
          'stale',
        ].includes(key),
      ),
    ).toBe(true)
  })

  it('filters assets via ?ids= and rejects unknown ids', async () => {
    const getQuotes = vi.fn(async () => ({ quotes: [makeQuote('sp500')] }))
    const app = appWith({ available: true, getQuotes })
    const listener = app as unknown as (req: unknown, res: unknown) => void
    server.removeAllListeners('request')
    server.on('request', listener)

    await fetch(`${baseUrl}/api/market/quotes?ids=sp500`)
    expect(getQuotes).toHaveBeenCalledWith(['sp500'])

    const bad = await fetch(`${baseUrl}/api/market/quotes?ids=not-real`)
    expect(bad.status).toBe(400)
  })

  it('answers 503 with the rate-limit code when the provider is throttled', async () => {
    const app = appWith({
      available: true,
      getQuotes: async () => {
        throw new MarketDataError('rate-limit', 'throttled')
      },
    })
    const listener = app as unknown as (req: unknown, res: unknown) => void
    server.removeAllListeners('request')
    server.on('request', listener)

    const res = await fetch(`${baseUrl}/api/market/quotes`)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'market data unavailable', code: 'rate-limit' })
  })

  it('answers 503 when configured without a key', async () => {
    const app = appWith({ available: false, getQuotes: async () => ({ quotes: [] }) })
    const listener = app as unknown as (req: unknown, res: unknown) => void
    server.removeAllListeners('request')
    server.on('request', listener)

    const res = await fetch(`${baseUrl}/api/market/quotes`)
    expect(res.status).toBe(503)
  })

  it('never leaks provider symbols or raw payloads in a response body', async () => {
    process.env.FINNHUB_API_KEY = 'super-secret-test-key'
    try {
      const app = appWith({
        available: true,
        getQuotes: async () => ({ quotes: [makeQuote('sp500')] }),
      })
      const listener = app as unknown as (req: unknown, res: unknown) => void
      server.removeAllListeners('request')
      server.on('request', listener)

      const res = await fetch(`${baseUrl}/api/market/quotes?ids=sp500`)
      const text = await res.text()
      expect(text).not.toContain('super-secret-test-key')
      expect(text).not.toContain('Global Quote')
      expect(text).not.toContain('Time Series')
    } finally {
      delete process.env.FINNHUB_API_KEY
    }
  })
})
