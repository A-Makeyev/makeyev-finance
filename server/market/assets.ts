import type { MarketAsset } from './types.ts'

/**
 * The asset registry. Adding an instrument later (NVDA, ETH, a watchlist
 * asset...) is one entry here - same provider, same endpoint families, no new
 * API logic. The navigation tracker renders exactly the assets listed in
 * `MARKET_TRACKER_ASSET_IDS`, in order.
 *
 * Provider routing (symbols verified live 2026-09-09 / 2026-09-11 / 2026-09-12):
 * the US instruments and Bitcoin are served by FINNHUB on the free key
 * (60 calls/min, no daily cap) - SPY / QQQ (USO also works if oil is ever
 * re-added) get real-time IEX quotes; Bitcoin works through the same /quote
 * endpoint as an exchange-prefixed symbol, BINANCE:BTCUSDT (plain BTC-USD
 * returns zeros, and /crypto/candle is premium-only).
 * USD/ILS is served by FRANKFURTER (api.frankfurter.dev, the ECB's keyless
 * API, no rate limit): Finnhub forex is premium-only on the free key.
 * TA-35 and GOLD are served by YAHOO (keyless chart endpoint). Finnhub serves
 * index and spot-metal levels only on paid plans and lists no TASE
 * instruments, while Yahoo publishes both the real index level (TA35.TA) and
 * the front-month gold contract (GC=F) - product decisions confirmed with the
 * user, who preferred the real instruments over US-listed proxies.
 *
 * On gold specifically: the row used to track GLD, the SPDR Gold Shares ETF,
 * at about 1/10th of the metal price. That was a share price wearing a metal's
 * name - GLD is roughly 0.09 oz per share today, and the ratio drifts down with
 * the fund's 0.40%/yr fee, so scaling it up would print a number no gold quote
 * agrees with. GC=F is the metal itself, priced for later delivery, so it sits
 * just above spot (live 2026-09-12: $4,408.90 for Dec 26 against $4,349.70
 * spot, about 1.4%); `futures` marks that so the UI can disclose it.
 * No row uses `proxyOf` any more; the field stays for the next instrument that
 * needs a stand-in.
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
    // The real TASE index level (index points, quoted in ILS), not a proxy.
    // No `realtime`: the TASE feed Yahoo republishes is delayed by about a
    // quarter of an hour, so this row sits out the provider's fast cadence.
    name: 'TA-35',
    symbol: 'TA35.TA',
    type: 'index',
    provider: 'yahoo',
    currency: 'ILS',
    endpoint: 'chart-daily',
    decimals: 2,
  },
  {
    id: 'gold',
    // COMEX front-month gold futures - the metal's own price, in dollars per
    // troy ounce, rather than an ETF share that merely follows it.
    name: 'GOLD',
    symbol: 'GC=F',
    type: 'commodity',
    provider: 'yahoo',
    currency: 'USD',
    endpoint: 'chart-daily',
    futures: true,
    // Futures print continuously, unlike the delayed TASE feed beside it, so
    // this row is polled at the fast Yahoo cadence (see config.ts).
    realtime: true,
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

/** Ids whose quote is a crypto instrument. */
export const CRYPTO_ASSET_IDS = ['bitcoin'] as const

export function getMarketAsset(id: string): MarketAsset | undefined {
  return MARKET_ASSETS.find((asset) => asset.id === id)
}
