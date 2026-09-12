import { describe, expect, it } from 'vitest'
import { YahooProvider } from '../../../server/market/YahooProvider.ts'
import type { MarketAsset } from '../../../server/market/types.ts'

/**
 * Provider tests run against a canned fetchImpl (no network). The payload
 * mirrors the LIVE TA-35 chart response captured from
 * query1.finance.yahoo.com/v8/finance/chart/TA35.TA?range=1d&interval=1d on
 * 2026-09-11 (regularMarketPrice 4221.44, chartPreviousClose 4273.70).
 */

const TA35_ASSET: MarketAsset = {
  id: 'ta35',
  name: 'TA-35',
  symbol: 'TA35.TA',
  type: 'index',
  provider: 'yahoo',
  currency: 'ILS',
  endpoint: 'chart-daily',
  decimals: 2,
}

/** Extra meta fields are kept so the fixture stays shaped like the real body. */
const LIVE_TA35_RESPONSE = {
  chart: {
    result: [
      {
        meta: {
          currency: 'ILS',
          symbol: 'TA35.TA',
          exchangeName: 'TLV',
          fullExchangeName: 'Tel Aviv',
          instrumentType: 'INDEX',
          regularMarketTime: 1789050241,
          regularMarketPrice: 4221.44,
          // Yahoo reported 0 here while the real change was -1.22%: the
          // provider must derive the change, never copy this field.
          regularMarketChangePercent: 0,
          longName: 'TA-35',
          shortName: 'TA-35',
          chartPreviousClose: 4273.7,
          priceHint: 2,
          dataGranularity: '1d',
          range: '1d',
        },
        timestamp: [1789050241],
        indicators: { quote: [{ close: [4221.43994140625] }] },
      },
    ],
    error: null,
  },
}

function okProvider(body: unknown): { provider: YahooProvider; urls: string[] } {
  const urls: string[] = []
  const fetchImpl = (async (url: string | URL | Request) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }) as typeof fetch
  return { provider: new YahooProvider({ fetchImpl }), urls }
}

describe('YahooProvider - chart quotes (TA-35)', () => {
  it('normalizes the live index level and derives the change from the closes', async () => {
    const { provider, urls } = okProvider(LIVE_TA35_RESPONSE)

    const quote = await provider.getQuote(TA35_ASSET)

    expect(quote).toMatchObject({
      assetId: 'ta35',
      name: 'TA-35',
      price: 4221.44,
      currency: 'ILS',
      marketStatus: 'closed',
    })
    // 4221.44 - 4273.70, derived because Yahoo's own percent read 0 here.
    expect(quote.change).toBeCloseTo(-52.26, 6)
    expect(quote.changePercent).toBeCloseTo(-1.2228, 3)
    expect(quote.changePercent).not.toBe(0)
    expect(quote.timestamp).toBe(new Date(1789050241 * 1000).toISOString())
    expect(urls[0]).toContain('TA35.TA?range=1d&interval=1d')
  })

  it('encodes the symbol into the chart path', async () => {
    const { provider, urls } = okProvider(LIVE_TA35_RESPONSE)

    await provider.getQuote({ ...TA35_ASSET, symbol: '^TA35' })

    expect(urls[0]).toContain('/chart/%5ETA35?range=1d&interval=1d')
  })

  it('keeps the price but nulls the change when no previous close is published', async () => {
    const { provider } = okProvider({
      chart: {
        result: [{ meta: { regularMarketPrice: 4221.44, regularMarketTime: 1789050241 } }],
      },
    })

    const quote = await provider.getQuote(TA35_ASSET)

    expect(quote.price).toBe(4221.44)
    expect(quote.change).toBeNull()
    expect(quote.changePercent).toBeNull()
  })

  it('falls back to the injected clock when the payload has no market time', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          chart: { result: [{ meta: { regularMarketPrice: 4221.44, chartPreviousClose: 4273.7 } }] },
        }),
      }) as unknown as Response) as typeof fetch
    const provider = new YahooProvider({
      fetchImpl,
      now: () => new Date('2026-09-11T12:00:00.000Z'),
    })

    const quote = await provider.getQuote(TA35_ASSET)

    expect(quote.timestamp).toBe('2026-09-11T12:00:00.000Z')
  })

  it('maps HTTP 429 to rate-limit so the route can answer 503', async () => {
    const fetchImpl = (async () =>
      ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response) as typeof fetch
    const provider = new YahooProvider({ fetchImpl })

    await expect(provider.getQuote(TA35_ASSET)).rejects.toMatchObject({ code: 'rate-limit' })
  })

  it('maps an HTTP failure to provider-error', async () => {
    const fetchImpl = (async () =>
      ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response) as typeof fetch
    const provider = new YahooProvider({ fetchImpl })

    await expect(provider.getQuote(TA35_ASSET)).rejects.toMatchObject({ code: 'provider-error' })
  })

  it('treats an empty result plus chart.error as unsupported-symbol', async () => {
    const { provider } = okProvider({
      chart: {
        result: [],
        error: { code: 'Not Found', description: 'No data found, symbol may be delisted' },
      },
    })

    await expect(provider.getQuote(TA35_ASSET)).rejects.toMatchObject({
      code: 'unsupported-symbol',
    })
  })

  it('wraps network failures as provider-error', async () => {
    const fetchImpl = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch
    const provider = new YahooProvider({ fetchImpl })

    await expect(provider.getQuote(TA35_ASSET)).rejects.toMatchObject({ code: 'provider-error' })
  })

  it('is always available (keyless)', () => {
    expect(new YahooProvider({ fetchImpl: (async () => ({})) as unknown as typeof fetch }).available).toBe(
      true,
    )
  })
})
