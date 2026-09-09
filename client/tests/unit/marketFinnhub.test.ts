import { afterEach, describe, expect, it } from 'vitest'
import { FinnhubProvider } from '../../../server/market/FinnhubProvider.ts'
import type { MarketAsset } from '../../../server/market/types.ts'

/**
 * Provider tests run against a canned fetchImpl (no network). Payload shapes
 * mirror the live Finnhub /quote responses captured on 2026-09-09 with the
 * project key (QQQ/SPY/EIS real-time; plain BTC-USD returns the all-zero
 * "unknown symbol" body, while BINANCE:BTCUSDT returns a full quote).
 */

const ETF_ASSET: MarketAsset = {
  id: 'sp500',
  name: 'S&P 500',
  symbol: 'SPY',
  type: 'etf',
  provider: 'finnhub',
  currency: 'USD',
  endpoint: 'global-quote',
  proxyOf: 'S&P 500',
  decimals: 2,
}

const LIVE_SPY_RESPONSE = {
  c: 762.83,
  d: -3.13,
  dp: -0.4086,
  h: 764.47,
  l: 760.94,
  o: 764.09,
  pc: 765.96,
  t: 1788982885,
}

const ZERO_RESPONSE = { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }

const LIVE_BTC_RESPONSE = {
  c: 78274.01,
  d: -283.99,
  dp: -0.3613,
  h: 78950.0,
  l: 78101.0,
  o: 78701.0,
  pc: 78558.0,
  t: 1788982885,
}

function okProvider(bodies: unknown[]): { provider: FinnhubProvider; urls: string[] } {
  let call = 0
  const urls: string[] = []
  const fetchImpl = (async (url: string | URL | Request) => {
    urls.push(String(url))
    const body = bodies[Math.min(call, bodies.length - 1)]
    call++
    return { ok: true, status: 200, json: async () => body } as unknown as Response
  }) as typeof fetch
  return { provider: new FinnhubProvider({ apiKey: 'test-key', fetchImpl }), urls }
}

describe('FinnhubProvider - /quote (ETF assets)', () => {
  it('normalizes a successful quote with change fields and unix timestamp', async () => {
    const { provider, urls } = okProvider([LIVE_SPY_RESPONSE])

    const quote = await provider.getQuote(ETF_ASSET)

    expect(quote).toMatchObject({
      assetId: 'sp500',
      name: 'S&P 500',
      price: 762.83,
      change: -3.13,
      changePercent: -0.4086,
      currency: 'USD',
      marketStatus: 'closed',
    })
    expect(quote.timestamp).toBe(new Date(1788982885 * 1000).toISOString())
    expect(urls[0]).toContain('symbol=SPY')
    // The key travels as a query param but must never leak in errors below.
    expect(urls[0]).toContain('token=test-key')
  })

  it('treats the all-zero body as unsupported-symbol (plain crypto symbol)', async () => {
    const { provider } = okProvider([ZERO_RESPONSE])

    await expect(provider.getQuote(ETF_ASSET)).rejects.toMatchObject({
      code: 'unsupported-symbol',
    })
  })

  it('serves exchange-prefixed crypto symbols through the same endpoint', async () => {
    const BTC_ASSET: MarketAsset = {
      ...ETF_ASSET,
      id: 'bitcoin',
      name: 'BTC',
      symbol: 'BINANCE:BTCUSDT',
      type: 'crypto',
      proxyOf: undefined,
    }
    const { provider, urls } = okProvider([LIVE_BTC_RESPONSE])

    const quote = await provider.getQuote(BTC_ASSET)

    expect(quote).toMatchObject({
      assetId: 'bitcoin',
      name: 'BTC',
      price: 78274.01,
      change: -283.99,
      changePercent: -0.3613,
    })
    // The colon must survive URL encoding as a query-param value.
    expect(urls[0]).toContain('symbol=BINANCE%3ABTCUSDT')
  })

  it('throws provider-error on HTTP failure', async () => {
    const fetchImpl = (async () =>
      ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response) as typeof fetch
    const provider = new FinnhubProvider({ apiKey: 'test-key', fetchImpl })

    await expect(provider.getQuote(ETF_ASSET)).rejects.toMatchObject({ code: 'provider-error' })
  })

  it('wraps network failures as provider-error', async () => {
    const fetchImpl = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch
    const provider = new FinnhubProvider({ apiKey: 'test-key', fetchImpl })

    await expect(provider.getQuote(ETF_ASSET)).rejects.toMatchObject({ code: 'provider-error' })
  })

  it('reports unavailable without a key and throws missing-key', async () => {
    delete process.env.FINNHUB_API_KEY
    const provider = new FinnhubProvider({
      fetchImpl: (async () => ({})) as unknown as typeof fetch,
    })
    expect(provider.available).toBe(false)
    await expect(provider.getQuote(ETF_ASSET)).rejects.toMatchObject({ code: 'missing-key' })
  })
})

describe('FinnhubProvider - config integration', () => {
  afterEach(() => {
    delete process.env.FINNHUB_API_KEY
  })

  it('reads the key from the environment when not injected', async () => {
    process.env.FINNHUB_API_KEY = 'env-key'
    const { provider } = okProvider([LIVE_SPY_RESPONSE])
    // Rebuild so the constructor reads the env we just set.
    const envProvider = new FinnhubProvider({
      fetchImpl: (provider as never as { fetchImpl: typeof fetch }).fetchImpl,
    })
    expect(envProvider.available).toBe(true)

    const quote = await envProvider.getQuote(ETF_ASSET)
    expect(quote.price).toBe(762.83)
  })
})
