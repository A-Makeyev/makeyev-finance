import {
  FALLBACK_INFLATION,
  computeTrackResult,
  type TrackResult,
  type TrackType,
} from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
import type { SavedTrackInput } from '@/stores/calculatorStore'

/**
 * A saved mix's displayed figures, recomputed LIVE from its stored tracks.
 *
 * Deliberately not a frozen copy of what the mix looked like when it was
 * saved: if the amortization rules or the market defaults change later, a
 * saved mix must show current numbers rather than stale ones. This mirrors
 * the calculator's own per-track computation (computeTrackResult) instead of
 * a second rendering path.
 */
export interface SavedMixSummary {
  /** Sum of the tracks' first payments - the mix's opening monthly payment. */
  monthlyPayment: number
  totalAmount: number
  /** Each track's share of the loan, for the mix summary line and the ring. */
  parts: Array<{ type: TrackType; sharePercent: number; amount: number }>
  /** False when a stored track no longer computes (e.g. out-of-range values). */
  valid: boolean
}

export function summarizeSavedMix(tracks: SavedTrackInput[]): SavedMixSummary {
  const results: TrackResult[] = []
  for (const track of tracks) {
    const result = computeTrackResult({
      principal: parseAmountText(track.amountText),
      years: Number(track.yearsText) || 0,
      annualRatePercent: Number(track.rateText) || 0,
      type: track.type,
      method: track.method,
      annualInflation: FALLBACK_INFLATION,
    })
    if (result) results.push(result)
  }

  const totalAmount = results.reduce((sum, result) => sum + result.principal, 0)
  return {
    monthlyPayment: results.reduce((sum, result) => sum + result.firstPayment, 0),
    totalAmount,
    parts: results.map((result) => ({
      type: result.type,
      sharePercent: totalAmount > 0 ? (result.principal / totalAmount) * 100 : 0,
      amount: result.principal,
    })),
    valid: results.length > 0 && results.length === tracks.length,
  }
}
