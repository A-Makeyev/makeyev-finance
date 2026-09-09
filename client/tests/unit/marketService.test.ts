import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketDataService } from '../../../server/market/MarketDataService.ts'
import { MarketDataError } from '../../../server/market/types.ts'
import type { MarketQuote } from '../../../server/market/types.ts'
import type { FinnhubProvider } from '../../../server/market/FinnhubProvider.ts'
import type { FrankfurterProvider } from '../../../server/market/FrankfurterProvider.ts'
import type { MarketProvider } from '../../../server/market/MarketDataService.ts'

/** Service tests: normalization pass-through, caching, TTL expiry, partial failure. */

function quoteOf(assetId: string, price: number): MarketQuote {
  return {
    assetId,
    name: assetId,
    price,
    change: 1,
    changePercent: 0.1,
    currency: 'USD',
    timestamp: '2026-09-09T00:00:00.000Z',
  }
}

function stubProvider(impl: (assetId: string) => Promise<MarketQuote>): MarketProvider {
  return {
    getQuote: (asset) => impl(asset.id),
    available: true,
  }
}

function stubFinnhub(impl: (assetId: string) => Promise<MarketQuote>): FinnhubProvider {
  return stubProvider(impl) as unknown as FinnhubProvider
}

function stubFrankfurter(impl: (assetId: string) => Promise<MarketQuote>): FrankfurterProvider {
  return stubProvider(impl) as unknown as FrankfurterProvider
}

describe('MarketDataService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Redirect the snapshot disk cache away from the real .cache/ so tests
    // neither pollute nor read runtime data.
    process.env.MARKET_CACHE_DIR = '.cache-test'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.MARKET_CACHE_DIR
    fs.rmSync(path.resolve('.cache-test'), { recursive: true, force: true })
  })

  it('returns normalized quotes in registry order for multiple assets', async () => {
    const service = new MarketDataService({
      providerOverride: stubProvider(async (id) => quoteOf(id, 100)),
    })

    const snapshot = await service.getQuotes(['sp500', 'bitcoin', 'ta35'])

    expect(snapshot.quotes.map((quote) => quote.assetId)).toEqual(['sp500', 'bitcoin', 'ta35'])
    expect(snapshot.quotes.every((quote) => quote.price === 100)).toBe(true)
  })

  it('serves repeated calls from cache without re-fetching (one provider call per asset)', async () => {
    const getQuote = vi.fn(async (id: string) => quoteOf(id, 100))
    const service = new MarketDataService({ providerOverride: stubProvider(getQuote) })

    await service.getQuotes(['sp500', 'bitcoin'])
    await service.getQuotes(['sp500', 'bitcoin'])
    await service.getQuotes(['sp500', 'bitcoin'])

    expect(getQuote).toHaveBeenCalledTimes(2) // once per asset, not per request
  })

  it('collapses concurrent calls onto one provider batch', async () => {
    const getQuote = vi.fn(async (id: string) => quoteOf(id, 100))
    const service = new MarketDataService({ providerOverride: stubProvider(getQuote) })

    const [a, b, c] = await Promise.all([
      service.getQuotes(['sp500']),
      service.getQuotes(['sp500']),
      service.getQuotes(['sp500']),
    ])

    expect(getQuote).toHaveBeenCalledTimes(1)
    expect(a.quotes).toEqual(b.quotes)
    expect(b.quotes).toEqual(c.quotes)
  })

  it('refetches after the TTL expires and serves the fresh result unmarked', async () => {
    let now = 1_000_000
    const getQuote = vi.fn(async (id: string) => quoteOf(id, 200))
    const service = new MarketDataService({
      providerOverride: stubProvider(getQuote),
      ttlMs: 1_000,
      now: () => now,
    })

    await service.getQuotes(['sp500'])
    now += 900 // still fresh
    const fresh = await service.getQuotes(['sp500'])
    expect(getQuote).toHaveBeenCalledTimes(1)
    expect(fresh.quotes[0].stale).toBeUndefined()

    now += 200 // past TTL: refetch succeeds -> fresh data, never "stale"
    const refreshed = await service.getQuotes(['sp500'])
    expect(getQuote).toHaveBeenCalledTimes(2)
    expect(refreshed.quotes[0].stale).toBeUndefined()
  })

  it('serves the expired snapshot marked stale when a post-TTL refresh fails', async () => {
    let now = 1_000_000
    let failing = false
    const service = new MarketDataService({
      providerOverride: stubProvider(async (id) => {
        if (failing) throw new MarketDataError('rate-limit', 'daily limit reached')
        return quoteOf(id, 200)
      }),
      ttlMs: 1_000,
      now: () => now,
    })

    await service.getQuotes(['sp500'])
    failing = true
    now += 2_000 // past TTL and the refresh fails
    const stale = await service.getQuotes(['sp500'])
    expect(stale.quotes[0].price).toBe(200)
    expect(stale.quotes[0].stale).toBe(true)
  })

  it('keeps healthy quotes when one asset fails (per-asset isolation)', async () => {
    const service = new MarketDataService({
      providerOverride: stubProvider(async (id) => {
        if (id === 'ta35') {
          throw new MarketDataError('unsupported-symbol', 'no quote for EIS')
        }
        return quoteOf(id, 300)
      }),
    })

    const snapshot = await service.getQuotes(['sp500', 'ta35', 'bitcoin'])

    expect(snapshot.quotes.map((quote) => quote.assetId)).toEqual(['sp500', 'bitcoin'])
  })

  it('throws when every asset fails', async () => {
    const service = new MarketDataService({
      providerOverride: stubProvider(async () => {
        throw new MarketDataError('rate-limit', 'daily limit')
      }),
    })

    await expect(service.getQuotes(['sp500'])).rejects.toMatchObject({ code: 'rate-limit' })
  })

  it('discloses a partial snapshot with stale flags and keeps it cached for the full TTL', async () => {
    let now = 1_000_000
    const getQuote = vi.fn(async (id: string) => {
      if (id === 'ta35') throw new MarketDataError('rate-limit', 'per-minute limit')
      return quoteOf(id, 300)
    })
    const service = new MarketDataService({
      providerOverride: stubProvider(getQuote),
      ttlMs: 6 * 60 * 60 * 1000,
      now: () => now,
    })

    // ta35 is rate-limited: the snapshot arrives without it, and its quotes
    // are flagged so the UI never presents the shortfall as complete data.
    const partial = await service.getQuotes(['sp500', 'ta35', 'bitcoin'])
    expect(partial.quotes.map((quote) => quote.assetId)).toEqual(['sp500', 'bitcoin'])
    expect(partial.quotes.every((quote) => quote.stale === true)).toBe(true)

    // Still within the TTL: served from cache (budget protection - the free
    // key allows 25 requests/day) and still flagged.
    now += 60 * 1000
    const cached = await service.getQuotes(['sp500', 'ta35', 'bitcoin'])
    expect(getQuote).toHaveBeenCalledTimes(3) // one batch, no refetch
    expect(cached.quotes.every((quote) => quote.stale === true)).toBe(true)
  })

  it('serves the persisted snapshot flagged stale when the provider fails and memory is empty', async () => {
    // Persistence writes land in .cache/ (git-ignored); the writer below is
    // the same real code path the server uses at runtime.
    const good = new MarketDataService({
      providerOverride: stubProvider(async (id) => quoteOf(id, 424.42)),
      ttlMs: 60 * 1000,
    })
    await good.getQuotes(['sp500']) // complete snapshot -> written to disk

    // A fresh service instance (empty memory) with the provider down now
    // falls back to the disk snapshot, flagged stale.
    const restarted = new MarketDataService({
      providerOverride: stubProvider(async () => {
        throw new MarketDataError('rate-limit', 'daily limit')
      }),
      ttlMs: 60 * 1000,
    })
    const revived = await restarted.getQuotes(['sp500'])
    expect(revived.quotes[0].price).toBe(424.42)
    expect(revived.quotes[0].stale).toBe(true)
  })

  it('rethrows when the provider fails with nothing cached or persisted', async () => {
    const service = new MarketDataService({
      providerOverride: stubProvider(async () => {
        throw new MarketDataError('rate-limit', 'daily limit')
      }),
      persist: false,
    })
    await expect(service.getQuotes(['sp500'])).rejects.toMatchObject({ code: 'rate-limit' })
  })

  it('routes every registered asset to its registry provider', async () => {
    // Registry (2026-09-09): ETFs + Bitcoin on Finnhub, USD/ILS on
    // Frankfurter. Two providers total, no fallback tier.
    const servedFrom: string[] = []
    const service = new MarketDataService({
      finnhubProvider: stubFinnhub(async (id) => {
        servedFrom.push(`finnhub:${id}`)
        return quoteOf(id, 100)
      }),
      frankfurterProvider: stubFrankfurter(async (id) => {
        servedFrom.push(`fx:${id}`)
        return quoteOf(id, 3)
      }),
    })

    const snapshot = await service.getQuotes()

    // Each asset hit exactly the provider its registry entry names (order
    // varies with concurrent settlement; the set is what matters).
    expect([...servedFrom].sort()).toEqual(
      [
        'finnhub:sp500',
        'finnhub:nasdaq',
        'finnhub:ta35',
        'finnhub:gold',
        'finnhub:bitcoin',
        'fx:usdils',
      ].sort(),
    )
    // Registry order preserved regardless of resolution order.
    expect(snapshot.quotes.map((quote) => quote.assetId)).toEqual([
      'sp500',
      'nasdaq',
      'ta35',
      'gold',
      'bitcoin',
      'usdils',
    ])
  })

  it('keeps healthy-provider quotes when one provider fails', async () => {
    const service = new MarketDataService({
      finnhubProvider: stubFinnhub(async (id) => quoteOf(id, 100)),
      frankfurterProvider: stubFrankfurter(async () => {
        throw new MarketDataError('provider-error', 'ECB unreachable')
      }),
    })

    const snapshot = await service.getQuotes()
    expect(snapshot.quotes.map((quote) => quote.assetId)).toEqual([
      'sp500',
      'nasdaq',
      'ta35',
      'gold',
      'bitcoin',
    ])
    // Partial snapshot (usdils missing) is disclosed via stale flags.
    expect(snapshot.quotes.every((quote) => quote.stale === true)).toBe(true)
  })

  it('uses the real providers by default (wired via config)', async () => {
    process.env.FINNHUB_API_KEY = 'env-key'
    try {
      const service = new MarketDataService()
      expect(service.available).toBe(true)
    } finally {
      delete process.env.FINNHUB_API_KEY
    }
  })
})
