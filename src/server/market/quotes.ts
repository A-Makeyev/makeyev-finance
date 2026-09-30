import { marketConfig } from './config'
import { MarketDataService } from './MarketDataService'
import { MARKET_ASSETS } from './assets'
import { MarketDataError, type MarketQuote } from './types'

/**
 * Internal market-data API, ported from the legacy Express `marketRouter` into
 * a framework-agnostic handler so the Next route handler and the unit tests
 * share one code path (phase 3 folded the separate backend into Next).
 *
 * GET /api/market/quotes                -> every registered asset
 * GET /api/market/quotes?ids=a,b,c      -> the requested subset (watchlist-ready)
 *
 * The response is the normalized MarketQuote schema only. Provider API keys
 * and any raw upstream payloads never appear here.
 */

export interface MarketQuotesResponse {
  quotes: MarketQuote[]
  /** Present when the served snapshot has passed its cache TTL. */
  stale?: boolean
  /** Configured client refresh interval, so the UI never hard-codes it. */
  refreshIntervalMs: number
  /** Public display names of the assets backing the rows (proxy disclosure). */
  assets: Array<{
    id: string
    name: string
    proxyOf?: string
    /** Dated futures contract: its price sits above spot, and the UI says so. */
    futures?: boolean
    symbol: string
    type: string
    decimals: number
  }>
}

export interface QuotesResult {
  status: number
  body: MarketQuotesResponse | { error: string; code?: string }
}

let service: MarketDataService | null = null

function getService(): MarketDataService {
  if (!service) service = new MarketDataService()
  return service
}

/** Test seam: swap the service (or reset it) without module reload tricks. */
export function setMarketService(next: MarketDataService | null): void {
  service = next
}

/**
 * Resolves the API response for a quotes request. `ids` is the raw
 * comma-separated query value (or undefined for all assets); unknown ids are a
 * 400, a disabled provider a 503, a provider failure a 502/503.
 */
export async function handleQuotes(ids?: string): Promise<QuotesResult> {
  const requestedIds = ids
    ? ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : undefined

  const knownIds = new Set(MARKET_ASSETS.map((asset) => asset.id))
  if (requestedIds && requestedIds.some((id) => !knownIds.has(id))) {
    return { status: 400, body: { error: 'unknown asset id' } }
  }

  try {
    const current = getService()
    if (!current.available) {
      // Configured without a key: degrade to 503, never leak why in detail.
      return { status: 503, body: { error: 'market data unavailable' } }
    }
    const snapshot = await current.getQuotes(requestedIds)
    const assetMeta = MARKET_ASSETS.filter((asset) =>
      requestedIds ? requestedIds.includes(asset.id) : true,
    ).map((asset) => ({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      decimals: asset.decimals,
      ...(asset.proxyOf ? { proxyOf: asset.proxyOf } : {}),
      ...(asset.futures ? { futures: true } : {}),
    }))
    const body: MarketQuotesResponse = {
      quotes: snapshot.quotes,
      refreshIntervalMs: marketConfig.MARKET_DATA_REFRESH_INTERVAL,
      assets: assetMeta,
      ...(snapshot.quotes.some((quote) => quote.stale) ? { stale: true } : {}),
    }
    return { status: 200, body }
  } catch (error) {
    const code = error instanceof MarketDataError ? error.code : 'provider-error'
    const status = code === 'rate-limit' ? 503 : 502
    return { status, body: { error: 'market data unavailable', code } }
  }
}
