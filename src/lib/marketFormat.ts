/**
 * Market display formatting. Pure functions - unit-tested with concrete
 * values (the project rule for any display math). Non-finite inputs degrade
 * to a hyphen placeholder instead of "NaN" or "Infinity" reaching the DOM.
 */
import type { MarketAssetType } from '@/services/marketTypes'

/** Groups thousands, keeps the asset's decimal precision (23456.781 → "23,456.78"). */
export function formatMarketPrice(price: number | null, decimals: number): string {
  if (price === null || !Number.isFinite(price)) return '-'
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Currency-aware price for a quote row. USD-quoted instruments get the $
 * prefix ("$112,345", "$765.96"); an FX pair gets the sign of its QUOTE leg
 * (USD/ILS is shekels per dollar, so "₪3.0192" states the unit, while the
 * registry's `currency: 'USD'` only marks the base leg); ILS-quoted index
 * levels (TA-35) stay plain numbers, because an index level is POINTS, not
 * shekels - the row spells that out in its tooltip instead. The distinction
 * rides on the server-declared quote currency and instrument type, never on
 * hardcoded asset ids.
 */
export function formatMarketQuotePrice(
  price: number | null,
  decimals: number,
  currency: 'USD' | 'ILS',
  type: MarketAssetType,
): string {
  if (price === null || !Number.isFinite(price)) return '-'
  const prefix = type === 'currency' ? '₪' : currency === 'USD' ? '$' : ''
  return `${prefix}${formatMarketPrice(price, decimals)}`
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

/** Direction of a single price move, for the strip's flash animation. */
export type PriceTickDirection = 'up' | 'down'

/**
 * Direction of a VISIBLE price tick, or null when nothing should animate.
 *
 * Compares the FORMATTED prices (the same formatter the strip renders with),
 * so a move too small to change the displayed number (654.3219 -> 654.3241
 * at 2 decimals) does not flash next to an identical number, which would
 * read as a bug. First paint has no previous value and never flashes, and
 * non-finite prices (the '-' placeholder) are filtered by the same rule.
 */
export function priceTickTrend(
  previous: number | null,
  next: number | null,
  decimals: number,
): PriceTickDirection | null {
  if (previous === null || next === null) return null
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null
  if (formatMarketPrice(previous, decimals) === formatMarketPrice(next, decimals)) return null
  return next > previous ? 'up' : 'down'
}
