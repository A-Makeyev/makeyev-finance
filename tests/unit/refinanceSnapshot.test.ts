import { describe, expect, it } from 'vitest'
import { buildRefinanceSnapshot } from '@/features/refinance/snapshot'
import { emptyExistingMortgageTrack } from '@/features/refinance/existingMortgage'
import { MAX_TRACKS, MAX_YEARS } from '@/lib/amortization'

const proposed = { type: 'fixed' as const, sharePercent: 100, annualRatePercent: 4,
  termYears: 20, method: 'spitzer' as const, resetMonths: 0 }
const input = { existingTracks: [emptyExistingMortgageTrack('one')],
  proposedTracks: [proposed], feeAmount: 0, feeMode: 'cash' as const }

describe('refinance save eligibility', () => {
  it('preserves unknown existing fields and accepts a completed proposal', () => {
    expect(buildRefinanceSnapshot(input)?.existingTracks[0].currentBalance).toBeNull()
    expect(buildRefinanceSnapshot(input)?.proposedTracks[0].annualRatePercent).toBe(4)
  })
  it('blocks invalid proposed values before the save button is enabled', () => {
    for (const patch of [
      { sharePercent: 101 }, { sharePercent: Infinity }, { sharePercent: 0 },
      { annualRatePercent: -1 }, { annualRatePercent: 101 }, { annualRatePercent: NaN },
      { termYears: 0 }, { termYears: MAX_YEARS + 1 }, { termYears: 2.5 },
      { resetMonths: -1 }, { resetMonths: 121 },
    ]) {
      expect(buildRefinanceSnapshot({ ...input, proposedTracks: [{ ...proposed, ...patch }] })).toBeNull()
    }
  })
  it('enforces track and fee bounds', () => {
    expect(buildRefinanceSnapshot({ ...input, proposedTracks: Array(MAX_TRACKS + 1).fill(proposed) })).toBeNull()
    expect(buildRefinanceSnapshot({ ...input, feeAmount: Infinity })).toBeNull()
    expect(buildRefinanceSnapshot({ ...input, feeAmount: -1 })).toBeNull()
  })
})
