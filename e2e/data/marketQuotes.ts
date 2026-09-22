/**
 * Shared fixture data for the Markets strip (`/api/market/quotes`).
 *
 * Both the marketTracker and heroScrollCue suites serve this snapshot through
 * their mocks; keeping it here means a fixture change (a price, an asset)
 * happens in one place instead of drifting between the two suites.
 */

/** One quote row as the endpoint returns it. */
export interface FixtureQuote {
  assetId: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency: 'USD' | 'ILS'
  timestamp: string
  marketStatus?: 'open' | 'closed'
  stale?: boolean
}

export interface FixtureAssetMeta {
  id: string
  name: string
  symbol: string
  type: 'etf' | 'index' | 'commodity' | 'crypto' | 'currency'
  decimals: number
  futures?: boolean
}

/** Asset metadata, mirroring the server's assets array. */
export const ASSETS_META: FixtureAssetMeta[] = [
  { id: 'sp500', name: 'SPY', symbol: 'SPY', type: 'etf', decimals: 2 },
  { id: 'nasdaq', name: 'QQQ', symbol: 'QQQ', type: 'etf', decimals: 2 },
  { id: 'ta35', name: 'TA-35', symbol: 'TA35.TA', type: 'index', decimals: 2 },
  { id: 'gold', name: 'GOLD', symbol: 'GC=F', type: 'commodity', decimals: 2, futures: true },
  { id: 'bitcoin', name: 'BTC', symbol: 'BINANCE:BTCUSDT', type: 'crypto', decimals: 0 },
  { id: 'usdils', name: 'USD/ILS', symbol: 'USDILS', type: 'currency', decimals: 4 },
]

/** Fills the optional fields with the snapshot's usual defaults. */
export function quoteOf(
  partial: Partial<FixtureQuote> & Pick<FixtureQuote, 'assetId' | 'price' | 'changePercent'>,
): FixtureQuote {
  return {
    name: partial.assetId,
    change: partial.changePercent === null ? null : 1,
    currency: 'USD',
    timestamp: '2026-09-09T00:00:00.000Z',
    marketStatus: 'closed',
    ...partial,
  }
}

/**
 * One quote per asset, chosen so every formatting branch shows up: flat,
 * down, up, an ILS-quoted index, a commodity and an FX pair.
 */
export const MIXED_QUOTES: FixtureQuote[] = [
  quoteOf({ assetId: 'sp500', price: 765.96, changePercent: 0 }),
  quoteOf({ assetId: 'nasdaq', price: 521.4, changePercent: -0.3255 }),
  // TA-35 is the real TASE index level, quoted in ILS: no $ prefix.
  quoteOf({ assetId: 'ta35', price: 125.32, changePercent: -0.781, currency: 'ILS' }),
  // Gold is the COMEX front-month contract: dollars per ounce of the metal,
  // not the ~$400 GLD share price it used to show.
  quoteOf({ assetId: 'gold', price: 4408.9, changePercent: 0.9081 }),
  quoteOf({ assetId: 'bitcoin', price: 79551.34, changePercent: 1.24, marketStatus: 'open' }),
  quoteOf({ assetId: 'usdils', price: 3.0192, changePercent: 0.386 }),
]

/** The response envelope the client expects, with the server's refresh cadence. */
export function snapshotBody(quotes: FixtureQuote[]) {
  return { quotes, refreshIntervalMs: 900000, assets: ASSETS_META }
}
