import { describe, expect, it } from 'vitest'
import { allocateByShares, computeRefinance, type ProposedTrackInput } from '@/features/refinance/computeRefinance'
import type { ExistingMortgageTrack } from '@/features/refinance/existingMortgage'
import { MAX_TRACKS, MAX_YEARS } from '@/lib/amortization'
import { buildRefinanceSnapshot } from '@/features/refinance/snapshot'
import { proposedTracksFromSnapshot, toProposedTrackInputs } from '@/features/refinance/proposedTrack'

/**
 * Hand-checked refinance cases. The payment figures are the standard annuity
 * values for 100,000 over 120 months: 6.0% -> 1,110.21, 4.0% -> 1,012.45.
 * The 2,000 cash fee is recovered after about 21 monthly savings of 97.75.
 */

function track(overrides: Partial<ExistingMortgageTrack> = {}): ExistingMortgageTrack {
  return {
    id: 't1',
    label: null,
    type: 'fixed',
    linkage: 'unlinked',
    currentBalance: 100_000,
    originalPrincipal: 100_000,
    originalStartDate: '2017-01-01',
    originalTermMonths: 120,
    remainingMonths: 120,
    contractedAnnualRate: 6,
    marginPercent: null,
    rateBasis: 'annualNominal',
    method: 'spitzer',
    resetMonths: 0,
    lastRateResetDate: null,
    nextRateResetDate: null,
    historicalResets: [],
    graceMonths: 0,
    graceMode: 'interestOnly',
    maturityDate: '2027-01-01',
    dataStatus: 'userReviewed',
    ...overrides,
  }
}

const base = {
  existingLabel: 'Existing',
  proposedLabel: 'Proposed',
  tracks: [track()],
  proposedTracks: [
    {
      type: 'fixed' as const,
      sharePercent: 100,
      annualRatePercent: 4,
      termYears: 10,
      method: 'spitzer' as const,
      resetMonths: 0,
    },
  ],
  feeAmount: 2_000,
}

describe('computeRefinance', () => {
  it('rejects invalid existing balances, rates and terms before projecting', () => {
    for (const patch of [
      { currentBalance: NaN }, { currentBalance: Infinity }, { currentBalance: -1 },
      { contractedAnnualRate: NaN }, { contractedAnnualRate: Infinity },
      { contractedAnnualRate: -1 }, { contractedAnnualRate: 101 },
      { remainingMonths: 0 }, { remainingMonths: -1 },
      { remainingMonths: 1.5 }, { remainingMonths: Infinity },
      { remainingMonths: MAX_YEARS * 12 + 1 },
    ]) {
      const result = computeRefinance({ ...base, tracks: [track(patch)], feeMode: 'cash' })
      expect(result.ready, JSON.stringify(patch)).toBe(false)
      expect(result.comparison).toBeNull()
      expect(Number.isFinite(result.totalBalance)).toBe(true)
      expect(Number.isFinite(result.proposedPrincipal)).toBe(true)
    }
  })

  it('accepts zero interest at the maximum term and rejects too many existing tracks', () => {
    const existing = track({ currentBalance: MAX_YEARS * 12 * 100, contractedAnnualRate: 0,
      remainingMonths: MAX_YEARS * 12 })
    const input = { ...base, tracks: [existing], feeAmount: 0, feeMode: 'cash' as const,
      proposedTracks: [{ ...base.proposedTracks[0], annualRatePercent: 0, termYears: MAX_YEARS }] }
    const result = computeRefinance(input)
    expect(result.ready).toBe(true)
    expect(result.existing!.monthlyPayment).toBe(100)
    expect(result.proposed!.monthlyPayment).toBe(100)
    expect(result.existing!.totalInterest).toBe(0)
    expect(computeRefinance({ ...input, tracks: Array.from({ length: MAX_TRACKS + 1 },
      (_, index) => ({ ...existing, id: String(index) })) }).ready).toBe(false)
  })

  it('reproduces allocations and cash flows after a snapshot round trip in either fee mode', () => {
    for (const feeMode of ['cash', 'capitalized'] as const) {
      const input = { ...base, feeMode, proposedTracks: [
        { ...base.proposedTracks[0], sharePercent: 33.333 },
        { ...base.proposedTracks[0], sharePercent: 66.667, annualRatePercent: 5 },
      ] }
      const before = computeRefinance(input)
      const snapshot = buildRefinanceSnapshot({ ...input, existingTracks: input.tracks })!
      const stored = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot
      const after = computeRefinance({ ...input, tracks: stored.existingTracks,
        proposedTracks: toProposedTrackInputs(proposedTracksFromSnapshot(stored.proposedTracks)),
        feeAmount: stored.feeAmount, feeMode: stored.feeMode })
      expect(before.ready).toBe(true)
      expect(after).toEqual(before)
      expect(after.proposedAllocations).toEqual(feeMode === 'cash' ? [33333, 66667] : [34000, 68000])
    }
  })

  it('rejects invalid fees in both payment modes', () => {
    for (const feeMode of ['cash', 'capitalized'] as const) {
      for (const feeAmount of [-1, NaN, Infinity]) {
        const result = computeRefinance({ ...base, feeMode, feeAmount })
        expect(result.ready).toBe(false)
        expect(result.missing).toContain('fee:invalid')
        expect(result.comparison).toBeNull()
        expect(Number.isFinite(result.proposedPrincipal)).toBe(true)
      }
    }
  })

  it('prices both sides from the current balance and reports the cash fee once', () => {
    const result = computeRefinance({ ...base, feeMode: 'cash' })

    expect(result.ready).toBe(true)
    expect(result.totalBalance).toBe(100_000)
    expect(result.proposedPrincipal).toBe(100_000)
    expect(result.existing!.monthlyPayment).toBeCloseTo(1_110.21, 1)
    expect(result.proposed!.monthlyPayment).toBeCloseTo(1_012.45, 1)

    // Positive = the refinance is cheaper. The fee is a candidate cost, so the
    // fee delta is negative and the break-even lands at month 21.
    expect(result.comparison!.feesDelta).toBe(-2_000)
    expect(result.comparison!.firstPaymentDelta).toBeCloseTo(97.75, 1)
    expect(result.comparison!.breakEvenMonth).toBe(21)
    expect(result.comparison!.breaksEvenImmediately).toBe(false)
  })

  it('capitalizes the fee into the principal instead of charging it again in cash', () => {
    const result = computeRefinance({ ...base, feeMode: 'capitalized' })

    expect(result.ready).toBe(true)
    expect(result.proposedPrincipal).toBe(102_000)
    expect(result.comparison!.feesDelta).toBe(0)
    // The capitalized payment must be above the no-fee payment but below the
    // cash-fee break-even's total first outlay (102,000 vs 100,000 + 2,000).
    expect(result.proposed!.monthlyPayment).toBeGreaterThan(1_012.45)
    expect(result.proposed!.monthlyPayment).toBeCloseTo(1_032.7, 1)
  })

  it('never invents a missing balance, rate, type, method or remaining term', () => {
    const cases: Array<[Partial<ExistingMortgageTrack>, string]> = [
      [{ currentBalance: null }, 'balance'],
      [{ contractedAnnualRate: null }, 'rate'],
      [{ type: null }, 'type'],
      [{ method: null }, 'method'],
      [{ remainingMonths: null }, 'remainingMonths'],
    ]

    for (const [overrides, field] of cases) {
      const result = computeRefinance({
        ...base,
        tracks: [track(overrides)],
        feeMode: 'cash',
      })
      expect(result.ready).toBe(false)
      expect(result.missing).toContain(`t1:${field}`)
      expect(result.existing).toBeNull()
      expect(result.comparison).toBeNull()
    }
  })

  it('names the proposed track fields that block the projection', () => {
    const cases: Array<[Partial<ProposedTrackInput>, string]> = [
      [{ type: null }, 'type'],
      [{ sharePercent: null }, 'share'],
      [{ sharePercent: 0 }, 'share'],
      [{ sharePercent: 101 }, 'share'],
      [{ annualRatePercent: null }, 'rate'],
      [{ annualRatePercent: 101 }, 'rate'],
      [{ termYears: 0 }, 'term'],
      [{ termYears: 10.5 }, 'term'],
      [{ method: null }, 'method'],
    ]

    for (const [override, field] of cases) {
      const result = computeRefinance({
        ...base,
        proposedTracks: [{ ...base.proposedTracks[0], ...override }],
        feeMode: 'cash',
      })
      expect(result.ready).toBe(false)
      expect(result.missing).toContain(`proposed:0:${field}`)
      expect(result.proposed).toBeNull()
    }
  })

  it('splits the new principal across proposed tracks by share', () => {
    const result = computeRefinance({
      ...base,
      proposedTracks: [
        {
          type: 'fixed',
          sharePercent: 50,
          annualRatePercent: 4,
          termYears: 10,
          method: 'spitzer',
          resetMonths: 0,
        },
        {
          type: 'fixed',
          sharePercent: 50,
          annualRatePercent: 5,
          termYears: 10,
          method: 'spitzer',
          resetMonths: 0,
        },
      ],
      feeMode: 'cash',
    })

    expect(result.ready).toBe(true)
    expect(result.proposedAllocations).toEqual([50_000, 50_000])
    // 50k at 4% (506.23) + 50k at 5% (530.33).
    expect(result.proposed!.monthlyPayment).toBeCloseTo(1_036.56, 1)
    expect(result.proposed!.monthly.length).toBe(120)
  })

  it('capitalizes the fee across the proposed shares', () => {
    const result = computeRefinance({
      ...base,
      proposedTracks: [
        {
          type: 'fixed',
          sharePercent: 60,
          annualRatePercent: 4,
          termYears: 10,
          method: 'spitzer',
          resetMonths: 0,
        },
        {
          type: 'fixed',
          sharePercent: 40,
          annualRatePercent: 4,
          termYears: 10,
          method: 'spitzer',
          resetMonths: 0,
        },
      ],
      feeMode: 'capitalized',
    })

    expect(result.ready).toBe(true)
    expect(result.proposedPrincipal).toBe(102_000)
    expect(result.proposedAllocations).toEqual([61_200, 40_800])
    expect(result.comparison!.feesDelta).toBe(0)
  })

  it('splits a multi-track existing mortgage into one combined monthly schedule', () => {
    const result = computeRefinance({
      ...base,
      tracks: [
        track({ id: 'a', currentBalance: 60_000, remainingMonths: 120 }),
        track({ id: 'b', currentBalance: 40_000, remainingMonths: 60 }),
      ],
      feeMode: 'cash',
    })

    expect(result.ready).toBe(true)
    expect(result.totalBalance).toBe(100_000)
    expect(result.existing!.termMonths).toBe(120)
    expect(result.existing!.monthly[0].paid).toBeGreaterThan(0)
    // Both tracks contribute: 60k over 120 months (666.12) plus 40k over 60
    // months (773.31), for a combined first payment of 1,439.44.
    expect(result.existing!.monthly[0].paid).toBeCloseTo(1_439.44, 1)
  })
})

describe('allocateByShares', () => {
  it('splits a principal exactly and keeps whole-shekel parts balanced', () => {
    expect(allocateByShares(100_000, [50, 50])).toEqual([50_000, 50_000])
    expect(allocateByShares(100_000, [33.33, 33.33, 33.34])).toEqual([33_330, 33_330, 33_340])
    // Equal thirds: the first track takes the odd shekel (largest-remainder).
    expect(allocateByShares(100, [1, 1, 1])).toEqual([34, 33, 33])
  })

  it('reconciles a fractional principal without negative parts', () => {
    const parts = allocateByShares(100_000.5, [33.33, 33.33, 33.34])
    expect(parts.reduce((sum, part) => sum + part, 0)).toBeCloseTo(100_000.5, 2)
    expect(parts.every((part) => part >= 0)).toBe(true)
  })

  it('returns zeroes when there is no principal or no share', () => {
    expect(allocateByShares(0, [50, 50])).toEqual([0, 0])
    expect(allocateByShares(100_000, [0, 0])).toEqual([0, 0])
    expect(allocateByShares(100_000, [])).toEqual([])
  })
})
