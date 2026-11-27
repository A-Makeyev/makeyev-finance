import { MAX_YEARS, defaultResetMonthsFor } from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
import type { TrackState } from '@/stores/calculatorStore'
import {
  emptyExistingMortgageTrack,
  linkageForTrackType,
  type ExistingMortgageTrack,
} from './existingMortgage'

/**
 * Hand-off from the calculator to /refinance.
 *
 * The calculator's mix describes the mortgage the visitor is modelling, so
 * opening refinance from there starts its "existing mortgage" side with that
 * mix instead of an empty form - the same idea as the comparison page seeding
 * scenario 1 from the calculator. The request is a module flag rather than a
 * copy of the numbers: the calculator store lives for the session, so the
 * refinance page reads the current state when it mounts. A navigation the
 * unsaved-changes guard vetoes therefore leaves the request pending, and the
 * next visit seeds from the state at that moment rather than from a stale
 * snapshot.
 */
let seedRequested = false

export function requestRefinanceSeed(): void {
  seedRequested = true
}

export function isRefinanceSeedRequested(): boolean {
  return seedRequested
}

/** Cleared once the refinance page has read the request on mount. */
export function clearRefinanceSeedRequest(): void {
  seedRequested = false
}

/**
 * Maps the calculator's track mix onto the existing-mortgage side. Only the
 * contract facts the calculator knows are carried over: the track amount is
 * the outstanding balance, the quoted rate the contracted rate, and the term
 * the remaining payments. A track with no amount, no rate or no term is not a
 * contract yet and is left out (an entered 0% rate is kept). The record is
 * marked user-reviewed because the visitor entered these figures, but it is
 * still their payoff statement that is authoritative on the refinance page.
 */
export function existingTracksFromCalculatorTracks(
  tracks: TrackState[],
): ExistingMortgageTrack[] {
  return tracks.flatMap((track) => {
    const balance = parseAmountText(track.amountText)
    const rateText = track.rateText.trim()
    const rate = Number(rateText.replace(',', '.'))
    const years = Number(track.yearsText)
    if (
      !(balance > 0) ||
      rateText === '' ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      !Number.isFinite(years) ||
      years < 1
    ) {
      return []
    }
    return [
      {
        ...emptyExistingMortgageTrack(track.id),
        type: track.type,
        linkage: linkageForTrackType(track.type),
        currentBalance: balance,
        contractedAnnualRate: rate,
        remainingMonths: Math.min(MAX_YEARS * 12, Math.max(1, Math.round(years * 12))),
        method: track.method,
        resetMonths: defaultResetMonthsFor(track.type),
        dataStatus: 'userReviewed' as const,
      },
    ]
  })
}
