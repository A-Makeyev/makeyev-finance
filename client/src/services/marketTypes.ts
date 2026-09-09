/**
 * Mirrors the server's normalized market schema (server/market/types.ts).
 * Duplicated deliberately: the client must not import server modules, and
 * the two shapes are pinned against each other by unit tests.
 */
export type MarketAssetType = 'index' | 'etf' | 'equity' | 'crypto' | 'currency'

export interface MarketQuote {
  assetId: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency: 'USD'
  timestamp: string
  marketStatus?: 'open' | 'closed'
  stale?: boolean
}

export interface MarketAssetMeta {
  id: string
  name: string
  symbol: string
  /** Instrument kind behind the row (drives crypto $ formatting in the UI). */
  type?: MarketAssetType
  /** Decimal places the server says this instrument's price uses. */
  decimals?: number
  proxyOf?: string
}

export interface MarketSnapshotResponse {
  quotes: MarketQuote[]
  refreshIntervalMs: number
  assets: MarketAssetMeta[]
  stale?: boolean
}
