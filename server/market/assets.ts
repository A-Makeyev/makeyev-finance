import type { MarketAsset } from './types.ts'

/**
 * The asset registry. Adding an instrument later (NVDA, ETH, a watchlist
 * asset...) is one entry here - same provider, same endpoint families, no new
 * API logic. The navigation tracker renders exactly the assets listed in
 * `MARKET_TRACKER_ASSET_IDS`, in order.
 *
 * Provider routing (symbols verified live 2026-09-09): the ETFs and Bitcoin
 * are served by FINNHUB on the free key (60 calls/min, no daily cap) -
 * QQQ / SPY / EIS / GLD (USO also works if oil is ever re-added) get
 * real-time IEX quotes; Bitcoin works through the
 * same /quote endpoint as an exchange-prefixed symbol, BINANCE:BTCUSDT
 * (plain BTC-USD returns zeros, and /crypto/candle is premium-only).
 * USD/ILS is served by FRANKFURTER (api.frankfurter.dev, the ECB's keyless
 * API, no rate limit): Finnhub forex is premium-only on the free key.
 * Index levels themselves (SPX, COMP, TA-35) and spot gold/forex are
 * premium-only on Finnhub, so rows track real US-listed ETFs that follow
 * the requested instruments - a product decision confirmed with the user.
 * The `proxyOf` field keeps that substitution explicit and swappable.
 */
export const MARKET_ASSETS: readonly MarketAsset[] = [
  {
    id: 'sp500',
    name: 'SPY',
    symbol: 'SPY',
    type: 'etf',
    provider: 'finnhub',
    currency: 'USD',
    endpoint: 'global-quote',
    decimals: 2,
  },
  {
    id: 'nasdaq',
    name: 'QQQ',
    symbol: 'QQQ',
    type: 'etf',
    provider: 'finnhub',
    currency: 'USD',
    endpoint: 'global-quote',
    decimals: 2,
  },
  {
    id: 'ta35',
    name: 'TA-35',
    symbol: 'EIS',
    type: 'etf',
    provider: 'finnhub',
    currency: 'USD',
    endpoint: 'global-quote',
    // Neither provider lists TASE instruments or the TA-35 index; EIS
    // (iShares MSCI Israel) is the closest US-listed Israel-equity
    // instrument.
    proxyOf: 'Tel Aviv 35',
    decimals: 2,
  },
  {
    id: 'gold',
    name: 'GOLD',
    symbol: 'GLD',
    type: 'etf',
    provider: 'finnhub',
    currency: 'USD',
    endpoint: 'global-quote',
    // GLD (SPDR Gold Shares) stands in for the spot gold price.
    proxyOf: 'Spot gold',
    decimals: 2,
  },
  {
    id: 'bitcoin',
    name: 'BTC',
    symbol: 'BINANCE:BTCUSDT',
    type: 'crypto',
    provider: 'finnhub',
    currency: 'USD',
    endpoint: 'global-quote',
    decimals: 0,
  },
  {
    id: 'usdils',
    name: 'USD/ILS',
    symbol: 'USDILS',
    type: 'currency',
    provider: 'frankfurter',
    currency: 'USD',
    endpoint: 'fx-daily',
    decimals: 4,
  },
] as const

/** Ordered asset ids shown in the navigation Markets section. */
export const MARKET_TRACKER_ASSET_IDS = [
  'sp500',
  'nasdaq',
  'ta35',
  'gold',
  'bitcoin',
  'usdils',
] as const

/** Ids whose quote is a crypto instrument (drives $ formatting in the UI). */
export const CRYPTO_ASSET_IDS = ['bitcoin'] as const

export function getMarketAsset(id: string): MarketAsset | undefined {
  return MARKET_ASSETS.find((asset) => asset.id === id)
}
