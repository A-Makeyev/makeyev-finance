import { describe, expect, it } from 'vitest'
import { buildRefinanceSnapshot } from '@/features/refinance/snapshot'
import { emptyExistingMortgageTrack } from '@/features/refinance/existingMortgage'
import { MAX_REFINANCE_OFFERS, MAX_TRACKS, MAX_YEARS } from '@/lib/amortization'

const proposed = { type: 'fixed' as const, sharePercent: 100, annualRatePercent: 4,
  termYears: 20, method: 'spitzer' as const, resetMonths: 0 }

const proposal = { label: 'Fixed 20', proposedTracks: [proposed], feeAmount: 0, feeMode: 'cash' as const }

const input = {
  existingTracks: [emptyExistingMortgageTrack('one')],
  proposals: [proposal],
}

describe('refinance save eligibility', () => {
  it('preserves unknown existing fields and accepts a completed proposal', () => {
    expect(buildRefinanceSnapshot(input)?.existingTracks[0].currentBalance).toBeNull()
    expect(buildRefinanceSnapshot(input)?.proposals[0].proposedTracks[0].annualRatePercent).toBe(4)
    expect(buildRefinanceSnapshot(input)?.version).toBe(3)
  })

  it('stores several named proposals and trims their names', () => {
    const snapshot = buildRefinanceSnapshot({
      ...input,
      proposals: [
        { ...proposal, label: '  Fixed  ' },
        { ...proposal, label: 'Variable', proposedTracks: [{ ...proposed, type: 'variable' }] },
      ],
      existingResetStepPercent: 1,
    })

    expect(snapshot?.proposals.map((item) => item.label)).toEqual(['Fixed', 'Variable'])
    expect(snapshot?.proposals[1].proposedTracks[0].type).toBe('variable')
    expect(snapshot?.existingResetStepPercent).toBe(1)
  })

  it('blocks invalid proposed values before the save button is enabled', () => {
    for (const patch of [
      { sharePercent: 101 }, { sharePercent: Infinity }, { sharePercent: 0 },
      { annualRatePercent: -1 }, { annualRatePercent: 101 }, { annualRatePercent: NaN },
      { termYears: 0 }, { termYears: MAX_YEARS + 1 }, { termYears: 2.5 },
      { resetMonths: -1 }, { resetMonths: 121 },
    ]) {
      expect(
        buildRefinanceSnapshot({
          ...input,
          proposals: [{ ...proposal, proposedTracks: [{ ...proposed, ...patch }] }],
        }),
      ).toBeNull()
    }
  })

  it('enforces track, proposal and fee bounds', () => {
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: [{ ...proposal, proposedTracks: Array(MAX_TRACKS + 1).fill(proposed) }],
      }),
    ).toBeNull()
    expect(buildRefinanceSnapshot({ ...input, proposals: [] })).toBeNull()
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: Array.from({ length: MAX_REFINANCE_OFFERS }, () => proposal),
      }),
    ).not.toBeNull()
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: Array.from({ length: MAX_REFINANCE_OFFERS + 1 }, () => proposal),
      }),
    ).toBeNull()
    expect(buildRefinanceSnapshot({ ...input, proposals: [{ ...proposal, feeAmount: Infinity }] })).toBeNull()
    expect(buildRefinanceSnapshot({ ...input, proposals: [{ ...proposal, feeAmount: -1 }] })).toBeNull()
  })

  it('round-trips the balloon percentage and refuses an out-of-range one', () => {
    const snapshot = buildRefinanceSnapshot({
      ...input,
      proposals: [{ ...proposal, proposedTracks: [{ ...proposed, balloonPercent: 35 }] }],
    })!
    expect(snapshot.proposals[0].proposedTracks[0].balloonPercent).toBe(35)
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: [{ ...proposal, proposedTracks: [{ ...proposed, balloonPercent: 101 }] }],
      }),
    ).toBeNull()
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: [{ ...proposal, proposedTracks: [{ ...proposed, balloonPercent: 0 }] }],
      }),
    ).toBeNull()
  })

  it('is all or nothing: one incomplete proposal blocks the save', () => {
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: [proposal, { ...proposal, proposedTracks: [{ ...proposed, annualRatePercent: NaN }] }],
      }),
    ).toBeNull()
    expect(
      buildRefinanceSnapshot({
        ...input,
        proposals: [proposal, { ...proposal, proposedTracks: [] }],
      }),
    ).toBeNull()
  })
})
