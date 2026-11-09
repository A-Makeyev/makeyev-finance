import { MAX_RATE_PERCENT, type TrackType } from './amortization'

/**
 * Typical market margin on a new prime track, in percentage points. The app's
 * margin is the track rate minus prime, so a "prime minus 0.7" offer is -0.7
 * here.
 *
 * An illustrative midpoint of the published prime discount range 0.5-0.9
 * percentage points for a strong file, checked on 2026-11-09. A margin is
 * contractual, so it does not follow the policy rate the way prime itself
 * does; this is a dated indication,
 * not a live index, and it never enters the mix unless the reader types it.
 *
 * Source: https://kinyanguide.com/en/mortgage/mortgage-rates-israel/
 */
export const TYPICAL_PRIME_MARGIN_PERCENT = -0.7

/**
 * Placeholder for the display-only market-margin field: the spread when the
 * reader entered a rate away from prime, otherwise the typical market margin.
 * A missing live prime rate still gets the typical figure: the margin is
 * contractual, so it stays useful while the rate feed is unavailable. Empty
 * for non-prime tracks, whose reference rate is set by the bank and is not
 * held by the app.
 */
export function suggestPrimeMargin(
  type: TrackType,
  rateText: string,
  primeRate: number | null,
): string {
  if (type !== 'prime') return ''

  if (primeRate !== null && Number.isFinite(primeRate) && primeRate > 0) {
    const enteredRate = Number.parseFloat(rateText)
    if (Number.isFinite(enteredRate) && enteredRate > 0) {
      const margin = Math.round((enteredRate - primeRate) * 100) / 100
      if (margin !== 0 && Math.abs(margin) <= MAX_RATE_PERCENT) return margin.toFixed(2)
    }
  }

  return TYPICAL_PRIME_MARGIN_PERCENT.toFixed(2)
}
