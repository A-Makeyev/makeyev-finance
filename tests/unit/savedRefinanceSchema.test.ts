import { describe, expect, it } from 'vitest'
import {
  MAX_REFINANCE_LABEL_LENGTH,
  MAX_REFINANCE_PROPOSALS,
  MAX_SAVED_REFINANCES,
  normalizeRefinanceSnapshot,
  savedRefinanceInputSchema,
  storedRefinanceSnapshotSchema,
} from '@/server/refinances/schema'
import { MAX_TRACKS, MAX_YEARS } from '@/lib/amortization'
import { emptyExistingMortgageTrack } from '@/features/refinance/existingMortgage'

/**
 * The API re-validates everything a client sends, so these are the real bounds
 * on a stored refinance plan. The existing side deliberately keeps its explicit
 * `null` unknowns: a payoff statement may be incomplete, and a missing value
 * must never become a zero on the way to the database.
 */

const existingTrack = {
  ...emptyExistingMortgageTrack('track-1'),
  type: 'fixed' as const,
  linkage: 'unlinked' as const,
  currentBalance: 800_000,
  remainingMonths: 240,
  contractedAnnualRate: 4.5,
  method: 'spitzer' as const,
  resetMonths: 0,
  dataStatus: 'verified' as const,
}

const proposedTrack = {
  type: 'fixed' as const,
  sharePercent: 60,
  annualRatePercent: 4.8,
  termYears: 30,
  method: 'spitzer' as const,
  resetMonths: 0,
}

const proposal = {
  label: 'Balanced',
  proposedTracks: [proposedTrack, { ...proposedTrack, sharePercent: 40 }],
  feeAmount: 12_000,
  feeMode: 'capitalized' as const,
}

const valid = {
  label: 'First home refinance',
  snapshot: {
    version: 3 as const,
    existingTracks: [existingTrack],
    proposals: [proposal],
    existingResetStepPercent: 0,
  },
}

const withSnapshot = (patch: object) => ({
  ...valid,
  snapshot: { ...valid.snapshot, ...patch },
})

const withProposal = (patch: object) => ({
  ...valid,
  snapshot: { ...valid.snapshot, proposals: [{ ...proposal, ...patch }] },
})

describe('savedRefinanceInputSchema', () => {
  it('accepts a well-formed multi-proposal plan', () => {
    expect(savedRefinanceInputSchema.safeParse(valid).success).toBe(true)
    const two = withSnapshot({
      proposals: [proposal, { ...proposal, label: 'Cheaper', feeAmount: 0 }],
    })
    expect(savedRefinanceInputSchema.safeParse(two).success).toBe(true)
  })

  it('keeps the saved-plan cap at 4 and the offer cap at 4', () => {
    expect(MAX_SAVED_REFINANCES).toBe(4)
    expect(MAX_REFINANCE_PROPOSALS).toBe(4)
  })

  it('trims the plan and proposal labels and accepts an unnamed proposal', () => {
    const parsed = savedRefinanceInputSchema.parse({
      ...valid,
      label: '  Home  ',
      snapshot: {
        ...valid.snapshot,
        proposals: [{ ...proposal, label: '  Fixed  ' }, { ...proposal, label: '' }],
      },
    })
    expect(parsed.label).toBe('Home')
    expect(parsed.snapshot.proposals.map((item) => item.label)).toEqual(['Fixed', ''])
    expect(savedRefinanceInputSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false)
    expect(
      savedRefinanceInputSchema.safeParse({
        ...withProposal({ label: 'x'.repeat(MAX_REFINANCE_LABEL_LENGTH + 1) }),
      }).success,
    ).toBe(false)
  })

  it('requires version 3 for new saves but still reads versions 1 and 2', () => {
    for (const version of [0, 1, 2, '3']) {
      expect(savedRefinanceInputSchema.safeParse(withSnapshot({ version })).success).toBe(false)
    }
    const legacy = {
      version: 1,
      existingTracks: [existingTrack],
      proposedTracks: proposal.proposedTracks,
      feeAmount: proposal.feeAmount,
      feeMode: proposal.feeMode,
    }
    expect(storedRefinanceSnapshotSchema.safeParse(legacy).success).toBe(true)
    const version2 = {
      version: 2,
      existingTracks: [existingTrack],
      proposals: [proposal],
      existingResetStepPercent: 0,
    }
    expect(storedRefinanceSnapshotSchema.safeParse(version2).success).toBe(true)
  })

  it('normalizes a version 1 record to one unnamed version 2 proposal', () => {
    const normalized = normalizeRefinanceSnapshot({
      version: 1,
      existingTracks: [existingTrack],
      proposedTracks: proposal.proposedTracks,
      feeAmount: 5_000,
      feeMode: 'cash',
      existingResetStepPercent: 1,
    })

    expect(normalized.version).toBe(3)
    expect(normalized.proposals).toEqual([
      {
        label: '',
        proposedTracks: proposal.proposedTracks.map((track) => ({
          ...track,
          balloonPercent: null,
        })),
        feeAmount: 5_000,
        feeMode: 'cash',
      },
    ])
    expect(normalized.existingResetStepPercent).toBe(1)
  })

  it('normalizes a version 2 record to version 3 with no balloon on any track', () => {
    const normalized = normalizeRefinanceSnapshot({
      version: 2,
      existingTracks: [existingTrack],
      proposals: [proposal],
      existingResetStepPercent: 0,
    })

    expect(normalized.version).toBe(3)
    expect(normalized.existingTracks[0].balloonPercent).toBeNull()
    expect(normalized.proposals[0].proposedTracks[0].balloonPercent).toBeNull()
  })

  it('stores and validates a balloon percentage on both sides, and rejects grace with a balloon', () => {
    const withBalloon = withProposal({
      proposedTracks: [{ ...proposedTrack, balloonPercent: 40 }],
    })
    expect(savedRefinanceInputSchema.safeParse(withBalloon).success).toBe(true)
    expect(
      savedRefinanceInputSchema.parse(withBalloon).snapshot.proposals[0].proposedTracks[0]
        .balloonPercent,
    ).toBe(40)

    for (const balloonPercent of [0, -1, 100.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        savedRefinanceInputSchema.safeParse(
          withProposal({ proposedTracks: [{ ...proposedTrack, balloonPercent }] }),
        ).success,
      ).toBe(false)
    }
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({
          existingTracks: [{ ...existingTrack, graceMonths: 6, balloonPercent: 40 }],
        }),
      ).success,
    ).toBe(false)
  })

  it('bounds both sides and requires at least one proposal', () => {
    const existing = (count: number) =>
      withSnapshot({ existingTracks: Array.from({ length: count }, () => existingTrack) })
    const proposals = (count: number) =>
      withSnapshot({ proposals: Array.from({ length: count }, () => proposal) })
    const tracks = (count: number) =>
      withProposal({
        proposedTracks: Array.from({ length: count }, () => proposedTrack),
      })

    expect(savedRefinanceInputSchema.safeParse(withSnapshot({ existingTracks: [] })).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withSnapshot({ proposals: [] })).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(existing(MAX_TRACKS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(existing(MAX_TRACKS + 1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(proposals(MAX_REFINANCE_PROPOSALS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(proposals(MAX_REFINANCE_PROPOSALS + 1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(tracks(MAX_TRACKS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(tracks(MAX_TRACKS + 1)).success).toBe(false)
  })

  it('accepts an existing track with explicit unknown values', () => {
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({ existingTracks: [emptyExistingMortgageTrack('track-1')] }),
      ).success,
    ).toBe(true)
  })

  it('rejects a zero, negative, over-100 or non-finite share', () => {
    for (const sharePercent of [0, -1, 100.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        savedRefinanceInputSchema.safeParse(
          withProposal({ proposedTracks: [{ ...proposedTrack, sharePercent }] }),
        ).success,
      ).toBe(false)
    }
    expect(
      savedRefinanceInputSchema.safeParse(
        withProposal({ proposedTracks: [{ ...proposedTrack, sharePercent: 100 }] }),
      ).success,
    ).toBe(true)
  })

  it('does not require the shares to sum to 100 (they are normalised at pricing)', () => {
    expect(
      savedRefinanceInputSchema.safeParse(
        withProposal({
          proposedTracks: [
            { ...proposedTrack, sharePercent: 2 },
            { ...proposedTrack, sharePercent: 3 },
          ],
        }),
      ).success,
    ).toBe(true)
  })

  it('bounds each proposal fee, rate, term and reset cadence', () => {
    expect(savedRefinanceInputSchema.safeParse(withProposal({ feeAmount: 0 })).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withProposal({ feeAmount: -1 })).success).toBe(false)
    expect(
      savedRefinanceInputSchema.safeParse(withProposal({ feeAmount: Number.POSITIVE_INFINITY }))
        .success,
    ).toBe(false)

    const withRate = (annualRatePercent: number) =>
      withProposal({ proposedTracks: [{ ...proposedTrack, annualRatePercent }] })
    expect(savedRefinanceInputSchema.safeParse(withRate(0)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withRate(100)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withRate(-0.1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withRate(100.1)).success).toBe(false)

    const withTerm = (termYears: number) =>
      withProposal({ proposedTracks: [{ ...proposedTrack, termYears }] })
    expect(savedRefinanceInputSchema.safeParse(withTerm(1)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withTerm(MAX_YEARS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withTerm(0)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withTerm(MAX_YEARS + 1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withTerm(12.5)).success).toBe(false)

    const withReset = (resetMonths: number) =>
      withProposal({ proposedTracks: [{ ...proposedTrack, resetMonths }] })
    expect(savedRefinanceInputSchema.safeParse(withReset(0)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withReset(120)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withReset(-1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withReset(121)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withReset(12.5)).success).toBe(false)
  })

  it('bounds the reset-rate assumption to -100..100 percentage points', () => {
    for (const existingResetStepPercent of [-100, 0, 100]) {
      expect(
        savedRefinanceInputSchema.safeParse(withSnapshot({ existingResetStepPercent })).success,
      ).toBe(true)
    }
    for (const existingResetStepPercent of [-101, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        savedRefinanceInputSchema.safeParse(withSnapshot({ existingResetStepPercent })).success,
      ).toBe(false)
    }
  })

  it('rejects unknown track types, methods and fee modes', () => {
    expect(
      savedRefinanceInputSchema.safeParse(
        withProposal({ proposedTracks: [{ ...proposedTrack, type: 'balloon' }] }),
      ).success,
    ).toBe(false)
    expect(
      savedRefinanceInputSchema.safeParse(
        withProposal({ proposedTracks: [{ ...proposedTrack, method: 'grace' }] }),
      ).success,
    ).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withProposal({ feeMode: 'credit' })).success).toBe(
      false,
    )
  })

  it('rejects extra fields instead of silently dropping them', () => {
    expect(savedRefinanceInputSchema.safeParse({ ...valid, ownerId: 'someone-else' }).success).toBe(
      false,
    )
    expect(
      savedRefinanceInputSchema.safeParse(
        withProposal({ proposedTracks: [{ ...proposedTrack, amount: 500_000 }] }),
      ).success,
    ).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withProposal({ ownerId: 'x' })).success).toBe(false)
  })
})
