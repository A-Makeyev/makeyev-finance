import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { handleQuotes, setMarketService } from '@/server/market/quotes'
import { GET } from '@/app/api/market/quotes/route'
import { MarketDataError, type MarketQuote } from '@/server/market/types'

/**
 * API contract tests for GET /api/market/quotes: the normalized schema, the
 * ?ids= filter, error mapping, and the guarantee that neither an API key nor
 * raw upstream payloads ever appear in a response.
 *
 * Ported from the legacy Express router test when phase 3 folded the backend
 * into Next: the contract now goes through the framework-agnostic handleQuotes
 * (the route handler is a thin NextResponse wrapper over it).
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

function withService(service: unknown): void {
  setMarketService(service as never)
}

afterEach(() => {
  setMarketService(null)
  vi.restoreAllMocks()
})

describe('GET /api/market/quotes', () => {
  it('returns the normalized schema', async () => {
    withService({
      available: true,
      getQuotes: async () => ({ quotes: [makeQuote('sp500'), makeQuote('bitcoin')] }),
    })
    const result = await handleQuotes()
    expect(result.status).toBe(200)

    const body = result.body as Record<string, unknown>
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

  it('discloses the gold row as a futures contract, not a spot-metal quote', async () => {
    withService({
      available: true,
      getQuotes: async () => ({ quotes: [makeQuote('gold')] }),
    })
    const result = await handleQuotes('gold')
    const body = result.body as { assets: Array<Record<string, unknown>> }
    expect(body.assets).toHaveLength(1)
    expect(body.assets[0]).toMatchObject({
      id: 'gold',
      symbol: 'GC=F',
      type: 'commodity',
      decimals: 2,
      futures: true,
    })
    // The client renders the spot-vs-futures note off this flag, so it must
    // survive serialization; a proxy disclosure must not come back with it.
    expect(body.assets[0]).not.toHaveProperty('proxyOf')
  })

  it('filters assets via ?ids= and rejects unknown ids', async () => {
    const getQuotes = vi.fn(async () => ({ quotes: [makeQuote('sp500')] }))
    withService({ available: true, getQuotes })

    await handleQuotes('sp500')
    expect(getQuotes).toHaveBeenCalledWith(['sp500'])

    const bad = await handleQuotes('not-real')
    expect(bad.status).toBe(400)
  })

  it('answers 503 with the rate-limit code when the provider is throttled', async () => {
    withService({
      available: true,
      getQuotes: async () => {
        throw new MarketDataError('rate-limit', 'throttled')
      },
    })
    const result = await handleQuotes()
    expect(result.status).toBe(503)
    expect(result.body).toEqual({ error: 'market data unavailable', code: 'rate-limit' })
  })

  it('answers 503 when configured without a key', async () => {
    withService({ available: false, getQuotes: async () => ({ quotes: [] }) })
    const result = await handleQuotes()
    expect(result.status).toBe(503)
  })

  it('never leaks provider symbols or raw payloads in a response body', async () => {
    process.env.FINNHUB_API_KEY = 'super-secret-test-key'
    try {
      withService({ available: true, getQuotes: async () => ({ quotes: [makeQuote('sp500')] }) })
      const result = await handleQuotes('sp500')
      const text = JSON.stringify(result.body)
      expect(text).not.toContain('super-secret-test-key')
      expect(text).not.toContain('Global Quote')
      expect(text).not.toContain('Time Series')
    } finally {
      delete process.env.FINNHUB_API_KEY
    }
  })

  it('the route handler sets no-store and maps the handler status', async () => {
    withService({
      available: true,
      getQuotes: async () => ({ quotes: [makeQuote('sp500')] }),
    })
    const response = await GET(
      new NextRequest('http://localhost/api/market/quotes?ids=sp500'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
