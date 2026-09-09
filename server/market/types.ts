/**
 * Provider-independent market data model.
 *
 * The UI (and any future page - watchlist, portfolio, crypto tracker) consumes
 * ONLY these shapes, never a raw provider payload. The server is the single
 * place that knows about provider payloads and API keys.
 *
 * A new asset is a data entry, not new API logic: add it to `assets.ts` and
 * (when its provider differs) one line in the provider's symbol map.
 */

/** Kind of instrument behind a market asset. Drives formatting, not logic. */
export type MarketAssetType = 'index' | 'etf' | 'equity' | 'crypto' | 'currency'

/** Which upstream serves this asset (the service routes by this field). */
export type MarketProviderName = 'finnhub' | 'frankfurter'

/** The query family an asset is served from. */
export type MarketEndpoint =
  | 'global-quote' // Finnhub US-traded ETFs/equities + exchange-prefixed crypto
  | 'fx-daily' // Frankfurter ECB daily FX series (USD/ILS)

/**
 * Normalized asset definition. `symbol` is the provider symbol (ETF ticker,
 * crypto code); `endpoint` selects the query family; `proxyOf` marks an
 * instrument that stands in for a requested-but-unsupported index so the UI
 * can disclose it (and so swapping in a real index provider later is a data
 * change, not a rewrite).
 */
export interface MarketAsset {
  id: string
  /** Provider-independent display name key; UI translates via i18n. */
  name: string
  symbol: string
  type: MarketAssetType
  provider: MarketProviderName
  currency: 'USD'
  endpoint: MarketEndpoint
  /** Set when the asset proxies an index the provider does not serve. */
  proxyOf?: string
  /** Decimal places used when formatting the price. */
  decimals: number
}

/**
 * A quote as the UI consumes it. Prices are plain numbers in the asset's
 * `currency`; change values may be null when the provider does not supply
 * them (the realtime crypto rate, for instance) - the UI renders an em-dash.
 */
export interface MarketQuote {
  assetId: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency: 'USD'
  /** ISO 8601 timestamp of the provider refresh (or cache write). */
  timestamp: string
  marketStatus?: 'open' | 'closed'
  /** True when the quote came from the TTL cache after its TTL expired. */
  stale?: boolean
}

export interface MarketSnapshot {
  quotes: MarketQuote[]
}

/**
 * Error taxonomy for provider failures. The service maps these to API
 * behavior; the provider throws them with provider-specific details.
 */
export type MarketErrorCode =
  'missing-key' | 'unsupported-symbol' | 'rate-limit' | 'provider-error' | 'malformed-response'

export class MarketDataError extends Error {
  readonly code: MarketErrorCode

  constructor(code: MarketErrorCode, message: string) {
    super(message)
    this.name = 'MarketDataError'
    this.code = code
  }
}
