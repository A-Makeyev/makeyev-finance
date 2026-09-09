import { describe, expect, it } from 'vitest'
import { FrankfurterProvider } from '../../../server/market/FrankfurterProvider.ts'
import type { MarketAsset } from '../../../server/market/types.ts'

/**
 * Provider tests run against a canned fetchImpl (no network). Payload shapes
 * mirror live Frankfurter responses captured 2026-09-09 (daily series with
 * weekend/holiday gaps).
 */

const USDILS_ASSET: MarketAsset = {
  id: 'usdils',
  name: 'USD/ILS',
  symbol: 'USDILS',
  type: 'currency',
  provider: 'frankfurter',
  currency: 'USD',
  endpoint: 'fx-daily',
  decimals: 4,
}

const LIVE_SERIES = {
  base: 'USD',
  rates: {
    // Unsorted on purpose: the provider must sort by date itself.
    '2026-09-08': { ILS: 3.0118 },
    '2026-09-04': { ILS: 3.0076 },
    '2026-09-09': { ILS: 3.0192 },
    '2026-09-07': { ILS: 3.0108 },
  },
}

function okProvider(body: unknown, now = new Date('2026-09-09T12:00:00Z')) {
  const urls: string[] = []
  const fetchImpl = (async (url: string | URL | Request) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }) as typeof fetch
  return { provider: new FrankfurterProvider({ fetchImpl, now: () => now }), urls }
}

describe('FrankfurterProvider - USD/ILS daily series', () => {
  it('computes price and change from the last two published days', async () => {
    const { provider } = okProvider(LIVE_SERIES)

    const quote = await provider.getQuote(USDILS_ASSET)

    expect(quote).toMatchObject({
      assetId: 'usdils',
      name: 'USD/ILS',
      price: 3.0192,
      change: expect.closeTo(0.0074, 6),
      // 0.0074 / 3.0118 * 100 (hand-checked).
      changePercent: expect.closeTo(0.2457, 4),
      currency: 'USD',
      marketStatus: 'closed',
    })
    expect(quote.timestamp).toBe(new Date('2026-09-09T16:00:00Z').toISOString())
  })

  it('requests ~10 days back so ECB holidays never leave fewer than two points', async () => {
    const { provider, urls } = okProvider(LIVE_SERIES)

    await provider.getQuote(USDILS_ASSET)

    expect(urls[0]).toContain('base=USD&symbols=ILS')
    expect(urls[0]).toMatch(/\/2026-08-30\.\./)
  })

  it('rejects non-USD/ILS assets', async () => {
    const { provider } = okProvider(LIVE_SERIES)
    const eurAsset: MarketAsset = { ...USDILS_ASSET, symbol: 'EURUSD' }

    await expect(provider.getQuote(eurAsset)).rejects.toMatchObject({
      code: 'unsupported-symbol',
    })
  })

  it('throws malformed-response when fewer than two points exist', async () => {
    const { provider } = okProvider({ rates: { '2026-09-09': { ILS: 3.0192 } } })

    await expect(provider.getQuote(USDILS_ASSET)).rejects.toMatchObject({
      code: 'malformed-response',
    })
  })

  it('throws provider-error on HTTP failure and wraps network errors', async () => {
    const httpFail = new FrankfurterProvider({
      fetchImpl: (async () =>
        ({
          ok: false,
          status: 503,
          json: async () => ({}),
        }) as unknown as Response) as typeof fetch,
    })
    await expect(httpFail.getQuote(USDILS_ASSET)).rejects.toMatchObject({ code: 'provider-error' })

    const netFail = new FrankfurterProvider({
      fetchImpl: (async () => {
        throw new Error('connection refused')
      }) as unknown as typeof fetch,
    })
    await expect(netFail.getQuote(USDILS_ASSET)).rejects.toMatchObject({ code: 'provider-error' })
  })

  it('is always available (keyless)', () => {
    const { provider } = okProvider(LIVE_SERIES)
    expect(provider.available).toBe(true)
  })
})
