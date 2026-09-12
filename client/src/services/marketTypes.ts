/**
 * Mirrors the server's normalized market schema (server/market/types.ts).
 * Duplicated deliberately: the client must not import server modules, and
 * the two shapes are pinned against each other by unit tests.
 */
export type MarketAssetType =
  | 'index'
  | 'etf'
  | 'equity'
  | 'crypto'
  | 'currency'
  | 'commodity'

export interface MarketQuote {
  assetId: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  /** Quotation currency; index levels are points in that currency's terms. */
  currency: 'USD' | 'ILS'
  timestamp: string
  marketStatus?: 'open' | 'closed'
  stale?: boolean
}

export interface MarketAssetMeta {
  id: string
  name: string
  symbol: string
  /** Instrument kind behind the row (drives $ formatting in the UI). */
  type?: MarketAssetType
  /** Decimal places the server says this instrument's price uses. */
  decimals?: number
  proxyOf?: string
  /** Dated futures contract: priced above spot, so the UI says which it is. */
  futures?: boolean
}

export interface MarketSnapshotResponse {
  quotes: MarketQuote[]
  refreshIntervalMs: number
  assets: MarketAssetMeta[]
  stale?: boolean
}
