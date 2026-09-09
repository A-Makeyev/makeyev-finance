import { getFinnhubKey } from './config.ts'
import { MarketDataError, type MarketAsset, type MarketQuote } from './types.ts'

/**
 * Finnhub provider - real-time US ETF/equity quotes on the free key.
 *
 * Free-key reality (verified live 2026-09-09, key in .env):
 * - /quote serves QQQ / SPY / EIS with real-time IEX data including change
 *   fields (c = current, d = change, dp = change %, t = unix ts).
 * - /quote on plain crypto symbols (BTC-USD) returns all zeros - NOT "no
 *   data" semantics, so it must be treated as unsupported here. Crypto
 *   candles (/crypto/candle) are premium-only. Exchange-prefixed symbols
 *   DO work: BINANCE:BTCUSDT returns a full real-time quote, so Bitcoin
 *   is served by this same provider through the /quote endpoint.
 * - Free tier: 60 calls/minute, no daily cap.
 *
 * Error handling contract: every failure surfaces as a MarketDataError with
 * a typed code; raw Finnhub payloads never escape this module, and the key
 * never appears in an error message or response.
 */

const BASE_URL = 'https://finnhub.io/api/v1'

interface FinnhubQuoteWire {
  c?: number // current price
  d?: number | null // change
  dp?: number | null // change percent
  h?: number
  l?: number
  o?: number
  pc?: number // previous close
  t?: number // unix seconds of the quote
}

export interface FinnhubProviderOptions {
  /** Overridable for tests; defaults to the configured environment key. */
  apiKey?: string
  fetchImpl?: typeof fetch
}

export class FinnhubProvider {
  private readonly apiKey: string | undefined
  private readonly fetchImpl: typeof fetch

  constructor(options: FinnhubProviderOptions = {}) {
    this.apiKey = options.apiKey ?? getFinnhubKey()
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
  }

  get available(): boolean {
    return this.apiKey !== undefined
  }

  async getQuote(asset: MarketAsset, signal?: AbortSignal): Promise<MarketQuote> {
    if (!this.apiKey) {
      throw new MarketDataError('missing-key', 'FINNHUB_API_KEY is not configured')
    }
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(asset.symbol)}&token=${this.apiKey}`
    let payload: FinnhubQuoteWire
    try {
      const response = await this.fetchImpl(url, { signal })
      if (!response.ok) {
        throw new MarketDataError('provider-error', `Finnhub HTTP ${response.status}`)
      }
      payload = (await response.json()) as FinnhubQuoteWire
    } catch (error) {
      if (error instanceof MarketDataError) throw error
      throw new MarketDataError(
        'provider-error',
        `Finnhub request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const price = payload?.c
    const timestamp = payload?.t
    // All-zero quote with t=0 is Finnhub's "unknown symbol / no data".
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || !timestamp) {
      throw new MarketDataError(
        'unsupported-symbol',
        `Finnhub returned no quote for ${asset.symbol}`,
      )
    }

    const change = typeof payload.d === 'number' && Number.isFinite(payload.d) ? payload.d : null
    const changePercent =
      typeof payload.dp === 'number' && Number.isFinite(payload.dp) ? payload.dp : null

    return {
      assetId: asset.id,
      name: asset.name,
      price,
      change,
      changePercent,
      currency: asset.currency,
      timestamp: new Date(timestamp * 1000).toISOString(),
      // Free real-time quotes come from IEX during US market hours; when the
      // market is shut the quote simply stops moving. We do not invent an
      // intraday session status here.
      marketStatus: 'closed',
    }
  }
}
