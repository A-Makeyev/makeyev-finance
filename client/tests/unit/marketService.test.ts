import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketDataService } from '../../../server/market/MarketDataService.ts'
import { MarketDataError } from '../../../server/market/types.ts'
import { loadSnapshot } from '../../../server/market/persistence.ts'
import { getMarketAsset, MARKET_ASSETS } from '../../../server/market/assets.ts'
import { cacheTtlForAsset, parseMarketConfig } from '../../../server/market/config.ts'
import type { MarketQuote } from '../../../server/market/types.ts'
import type { FinnhubProvider } from '../../../server/market/FinnhubProvider.ts'
import type { FrankfurterProvider } from '../../../server/market/FrankfurterProvider.ts'
import type { YahooProvider } from '../../../server/market/YahooProvider.ts'
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

function stubYahoo(impl: (assetId: string) => Promise<MarketQuote>): YahooProvider {
  return stubProvider(impl) as unknown as YahooProvider
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
          throw new MarketDataError('unsupported-symbol', 'no quote for TA-35')
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
    // Registry (2026-09-12): US ETFs + Bitcoin on Finnhub, USD/ILS on
    // Frankfurter, the TA-35 index and the gold contract on Yahoo. Three
    // providers, no fallback tier - each asset has exactly one source.
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
      yahooProvider: stubYahoo(async (id) => {
        servedFrom.push(`yahoo:${id}`)
        return quoteOf(id, 4221.44)
      }),
    })

    const snapshot = await service.getQuotes()

    // Each asset hit exactly the provider its registry entry names (order
    // varies with concurrent settlement; the set is what matters).
    expect([...servedFrom].sort()).toEqual(
      [
        'finnhub:sp500',
        'finnhub:nasdaq',
        'yahoo:ta35',
        'yahoo:gold',
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

  it('keeps gold as the metal itself: the front-month contract, not the GLD ETF', () => {
    // The row used to track GLD, at about a tenth of the metal price, so a
    // "GOLD" row showed ~$400 while gold traded near $4,400. GC=F is dollars
    // per troy ounce of the real thing; `futures` marks that it is the
    // front-month contract (a few percent above spot) and no longer a proxy.
    const gold = getMarketAsset('gold')
    expect(gold).toMatchObject({
      provider: 'yahoo',
      endpoint: 'chart-daily',
      symbol: 'GC=F',
      type: 'commodity',
      currency: 'USD',
      futures: true,
      decimals: 2,
    })
    expect(gold?.proxyOf).toBeUndefined()
  })

  it('keeps healthy-provider quotes when one provider fails', async () => {
    const service = new MarketDataService({
      finnhubProvider: stubFinnhub(async (id) => quoteOf(id, 100)),
      yahooProvider: stubYahoo(async (id) => quoteOf(id, 4221.44)),
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

  it('refreshes the real-time rows faster than the delayed ones (per-provider TTLs)', async () => {
    let now = 1_000_000
    const calls: string[] = []
    const service = new MarketDataService({
      finnhubProvider: stubFinnhub(async (id) => {
        calls.push(`finnhub:${id}`)
        return quoteOf(id, 100)
      }),
      yahooProvider: stubYahoo(async (id) => {
        calls.push(`yahoo:${id}`)
        return quoteOf(id, 4221.44)
      }),
      frankfurterProvider: stubFrankfurter(async (id) => {
        calls.push(`fx:${id}`)
        return quoteOf(id, 3)
      }),
      // Real-time US rows: 60s. Delayed index: 15min. Daily ECB rate: 6h.
      providerTtls: { finnhub: 60_000, yahoo: 15 * 60_000, frankfurter: 6 * 60 * 60 * 1000 },
      now: () => now,
    })

    await service.getQuotes(['sp500', 'ta35', 'usdils'])
    expect([...calls].sort()).toEqual(['finnhub:sp500', 'fx:usdils', 'yahoo:ta35'])

    // Past the 60s real-time TTL, still far inside the 15min and 6h ones.
    now += 61_000
    await service.getQuotes(['sp500', 'ta35', 'usdils'])

    expect(calls.filter((call) => call === 'finnhub:sp500')).toHaveLength(2)
    expect(calls.filter((call) => call === 'yahoo:ta35')).toHaveLength(1)
    expect(calls.filter((call) => call === 'fx:usdils')).toHaveLength(1)
  })

  it('does not hammer a provider that just failed (the failure is cached briefly)', async () => {
    let now = 1_000_000
    const getQuote = vi.fn(async () => {
      throw new MarketDataError('rate-limit', 'per-minute limit')
    })
    const service = new MarketDataService({
      providerOverride: stubProvider(getQuote),
      ttlMs: 60_000,
      now: () => now,
    })

    await expect(service.getQuotes(['sp500'])).rejects.toMatchObject({ code: 'rate-limit' })

    // Well inside the partial TTL: the cached failure answers, so a
    // rate-limited upstream is not hit again on every request.
    now += 5_000
    await expect(service.getQuotes(['sp500'])).rejects.toMatchObject({ code: 'rate-limit' })
    expect(getQuote).toHaveBeenCalledTimes(1)
  })

  it('throttles snapshot disk writes so a fast refresh does not rewrite the file', async () => {
    let now = 1_000_000
    const service = new MarketDataService({
      providerOverride: stubProvider(async (id) => quoteOf(id, 500)),
      ttlMs: 1_000,
      now: () => now,
    })

    await service.getQuotes(['sp500'])
    const first = loadSnapshot()
    expect(first?.savedAt).toBe(1_000_000)

    // Past the quote TTL (so it refetches) but inside the 5min write window:
    // the disk file is left alone.
    now += 1_500
    await service.getQuotes(['sp500'])
    expect(loadSnapshot()?.savedAt).toBe(first?.savedAt)

    // Past the write window: the snapshot is refreshed on disk again.
    now += 5 * 60 * 1000
    await service.getQuotes(['sp500'])
    expect(loadSnapshot()?.savedAt).toBe(now)
  })

  it('polls a live row faster than a delayed row from the same provider', async () => {
    let now = 1_000_000
    const calls: string[] = []
    const service = new MarketDataService({
      yahooProvider: stubYahoo(async (id) => {
        calls.push(`yahoo:${id}`)
        return quoteOf(id, 4221.44)
      }),
      // One provider, two cadences: the gold contract prints continuously, the
      // TASE index Yahoo republishes is ~15min behind.
      providerTtls: { yahoo: 15 * 60_000 },
      realtimeTtls: { yahoo: 1_000 },
      now: () => now,
    })

    await service.getQuotes(['gold', 'ta35'])
    expect([...calls].sort()).toEqual(['yahoo:gold', 'yahoo:ta35'])

    // Past the live TTL, far inside the delayed one: only the live row is
    // refetched. Polling the index here would spend requests on a number the
    // exchange has not published yet.
    now += 2_000
    await service.getQuotes(['gold', 'ta35'])
    expect(calls.filter((call) => call === 'yahoo:gold')).toHaveLength(2)
    expect(calls.filter((call) => call === 'yahoo:ta35')).toHaveLength(1)

    // The delayed row is NOT flagged stale: it is refreshed on its own
    // schedule, not showing expired cache.
    const snapshot = await service.getQuotes(['gold', 'ta35'])
    expect(snapshot.quotes.map((quote) => quote.assetId)).toEqual(['gold', 'ta35'])
    expect(snapshot.quotes.every((quote) => quote.stale !== true)).toBe(true)
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

/**
 * The strip's cadence is a budget, and this block is the ledger. Free-tier
 * limits (checked 2026-09-12): Finnhub = 60 API calls/minute on top of a 30
 * calls/second burst cap (finnhub.io/docs/api/rate-limit); Frankfurter is
 * keyless and uncapped; Yahoo publishes no number at all, and its observed
 * throttling starts in the low thousands of requests per hour. The assertions
 * below hold each provider to HALF its allowance, so a burst, a retry storm or
 * a second server instance still cannot trip a 429 - and adding rows without
 * rethinking the TTLs fails here instead of quietly eating a quota.
 *
 * These assertions run against the SHIPPED DEFAULTS (`parseMarketConfig({})`),
 * never the machine's .env: a deployment that overrides a TTL is making its own
 * choice, but the numbers we ship must be safe on their own.
 */
describe('refresh cadence and free-tier budget', () => {
  const FINNHUB_CALLS_PER_MINUTE = 60
  const YAHOO_REQUESTS_PER_HOUR = 2000
  const defaults = parseMarketConfig({})
  const ttlOf = (id: string) => cacheTtlForAsset(getMarketAsset(id)!, defaults)

  it('keeps the Finnhub group inside half the per-minute allowance', () => {
    const callsPerRefresh = MARKET_ASSETS.filter((a) => a.provider === 'finnhub').length
    const callsPerMinute = callsPerRefresh * (60_000 / ttlOf('sp500'))
    expect(callsPerMinute).toBeLessThanOrEqual(FINNHUB_CALLS_PER_MINUTE / 2)
  })

  it('keeps the Yahoo groups inside the informal hourly allowance', () => {
    const requestsPerHour = MARKET_ASSETS.filter((a) => a.provider === 'yahoo').reduce(
      (sum, asset) => sum + 3_600_000 / cacheTtlForAsset(asset, defaults),
      0,
    )
    expect(requestsPerHour).toBeLessThanOrEqual(YAHOO_REQUESTS_PER_HOUR / 2)
  })

  it('gives each row the cadence its own market prints at', () => {
    // Live instruments: seconds. Delayed/daily ones: minutes, never a fast poll
    // that cannot return a new number.
    expect(ttlOf('sp500')).toBeLessThanOrEqual(15_000)
    expect(ttlOf('gold')).toBeLessThanOrEqual(15_000)
    expect(ttlOf('ta35')).toBeGreaterThanOrEqual(60_000)
    expect(ttlOf('usdils')).toBeGreaterThanOrEqual(60_000)
    // Gold is Yahoo's live tier, the index its delayed one: that split is what
    // keeps both inside the budget above.
    expect(ttlOf('gold')).toBeLessThan(ttlOf('ta35'))
  })

  it('never lets the client poll slower than the fastest row refreshes', () => {
    const fastest = Math.min(...MARKET_ASSETS.map((asset) => cacheTtlForAsset(asset, defaults)))
    expect(defaults.MARKET_DATA_REFRESH_INTERVAL).toBeLessThanOrEqual(fastest)
  })
})
