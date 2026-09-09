/**
 * Market display formatting. Pure functions - unit-tested with concrete
 * values (the project rule for any display math). Non-finite inputs degrade
 * to a hyphen placeholder instead of "NaN" or "Infinity" reaching the DOM.
 */

/** Groups thousands, keeps the asset's decimal precision (23456.781 → "23,456.78"). */
export function formatMarketPrice(price: number | null, decimals: number): string {
  if (price === null || !Number.isFinite(price)) return '-'
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Currency-prefixed price for crypto ("$112,345"). Indexes/ETFs stay plain
 * numbers: an ETF quote is a fund share price, not a currency amount, so a
 * "$" would misrepresent it.
 */
export function formatMarketCryptoPrice(price: number | null, decimals: number): string {
  if (price === null || !Number.isFinite(price)) return '-'
  return `$${formatMarketPrice(price, decimals)}`
}

/** Signed percent with 2 decimals: 0.4213 → "+0.42%", -1.37 → "-1.37%", 0 → "0.00%". */
export function formatMarketChangePercent(changePercent: number | null): string {
  if (changePercent === null || !Number.isFinite(changePercent)) return '-'
  const sign = changePercent > 0 ? '+' : changePercent < 0 ? '' : ''
  return `${sign}${changePercent.toFixed(2)}%`
}

/** Signed absolute change with the same precision as the price. */
export function formatMarketChange(change: number | null, decimals: number): string {
  if (change === null || !Number.isFinite(change)) return '-'
  const sign = change > 0 ? '+' : ''
  return `${sign}${formatMarketPrice(change, decimals)}`
}

/** Semantic tone for change values, mapping onto the app's theme colors. */
export type MarketTrend = 'up' | 'down' | 'flat'

export function marketTrendOf(changePercent: number | null): MarketTrend {
  if (changePercent === null || !Number.isFinite(changePercent) || changePercent === 0) {
    return 'flat'
  }
  return changePercent > 0 ? 'up' : 'down'
}
