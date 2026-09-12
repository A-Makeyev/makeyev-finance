import { MarketDataError, type MarketAsset, type MarketQuote } from './types.ts'

/**
 * Yahoo Finance provider - keyless daily quotes for the instruments the other
 * providers cannot serve.
 *
 * Why this provider exists (verified live 2026-09-11): the user asked for the
 * real TA-35 index level instead of the EIS ETF proxy. Finnhub serves index
 * levels only on paid plans and does not list TASE instruments at all, so the
 * only keyless source for TA-35 (TA35.TA) is Yahoo's public chart endpoint.
 *
 * Request shape: /v8/finance/chart/{symbol}?range=1d&interval=1d. The response
 * `meta` carries everything needed for a strip row: regularMarketPrice (the
 * latest level), chartPreviousClose (the previous session's close, which is
 * what a daily change is measured against) and regularMarketTime.
 *
 * Do NOT use meta.regularMarketChangePercent: on the live TA-35 payload it
 * reported 0 while the real change was -1.22%, so the change is always derived
 * from price - previousClose here. Never trust a pre-computed upstream percent
 * over the two numbers it is supposed to come from.
 *
 * Honest limitations: Yahoo's chart endpoint is undocumented and outside any
 * stated free-tier agreement, so it can rate-limit (429) or change shape
 * without notice. Failures degrade to a placeholder row like every other
 * asset; nothing here invents a number.
 *
 * Error handling contract: every failure surfaces as a MarketDataError with a
 * typed code; raw Yahoo payloads never escape this module. There is no key, so
 * nothing to leak.
 */

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

interface YahooChartWire {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string
        symbol?: string
        instrumentType?: string
        regularMarketPrice?: number
        /** Close of the session before the requested range = previous close. */
        chartPreviousClose?: number
        previousClose?: number
        /** Unix seconds of the latest trade. */
        regularMarketTime?: number
      }
    }>
    error?: { code?: string; description?: string } | null
  }
}

export interface YahooProviderOptions {
  /** Overridable for tests. */
  fetchImpl?: typeof fetch
  now?: () => Date
}

export class YahooProvider {
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date

  constructor(options: YahooProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
    this.now = options.now ?? (() => new Date())
  }

  /** Keyless service: always usable. */
  get available(): boolean {
    return true
  }

  async getQuote(asset: MarketAsset, signal?: AbortSignal): Promise<MarketQuote> {
    const url = `${BASE_URL}/${encodeURIComponent(asset.symbol)}?range=1d&interval=1d`

    let payload: YahooChartWire
    try {
      const response = await this.fetchImpl(url, {
        signal,
        headers: { accept: 'application/json' },
      })
      // Yahoo throttles by IP rather than by key; surface it as rate-limit so
      // the route answers 503 (retryable) instead of a hard failure.
      if (response.status === 429) {
        throw new MarketDataError('rate-limit', 'Yahoo rate limit')
      }
      if (!response.ok) {
        throw new MarketDataError('provider-error', `Yahoo HTTP ${response.status}`)
      }
      payload = (await response.json()) as YahooChartWire
    } catch (error) {
      if (error instanceof MarketDataError) throw error
      throw new MarketDataError(
        'provider-error',
        `Yahoo request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const meta = payload?.chart?.result?.[0]?.meta
    const price = meta?.regularMarketPrice
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      // Yahoo answers an unknown symbol with an empty result array plus a
      // chart.error object, so this covers both cases.
      throw new MarketDataError('unsupported-symbol', `Yahoo returned no quote for ${asset.symbol}`)
    }

    const previousClose = firstFinite([meta?.chartPreviousClose, meta?.previousClose])
    // A missing previous close is reported as an unknown change (the UI
    // renders a placeholder) rather than a made-up 0%.
    let change: number | null = null
    let changePercent: number | null = null
    if (previousClose !== null) {
      change = price - previousClose
      changePercent = (change / previousClose) * 100
    }

    const marketTime = meta?.regularMarketTime
    const timestamp =
      typeof marketTime === 'number' && Number.isFinite(marketTime) && marketTime > 0
        ? new Date(marketTime * 1000).toISOString()
        : this.now().toISOString()

    return {
      assetId: asset.id,
      name: asset.name,
      price,
      change,
      changePercent,
      currency: asset.currency,
      timestamp,
      // The chart payload always describes the last session, never an
      // intraday session state; do not invent an "open" status from it.
      marketStatus: 'closed',
    }
  }
}

/** First finite number in the list, or null - avoids trusting a 0 placeholder. */
function firstFinite(values: Array<number | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return null
}
