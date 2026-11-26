import { describe, expect, it } from 'vitest'
import {
  addMonthsToDateOnly,
  emptyExistingMortgageTrack,
  existingMortgageSchema,
  existingMortgageTrackSchema,
  linkageForTrackType,
  monthsUntilDate,
  originalTermMonthsFromDates,
  projectedResetMonths,
  totalKnownBalance,
  type ExistingMortgage,
  type ExistingMortgageTrack,
} from '@/features/refinance/existingMortgage'

/**
 * Step 20 is about representation, not calculation. These tests pin the two
 * rules that make the model safe for a later refinance: linkage and dates are
 * preserved as recorded, and missing document data stays explicitly unknown
 * instead of becoming a zero or a guessed sum.
 */

function track(overrides: Partial<ExistingMortgageTrack> = {}): ExistingMortgageTrack {
  return {
    id: 'track-1',
    label: 'קבועה לא צמודה',
    type: 'fixed',
    linkage: 'unlinked',
    currentBalance: 400_000,
    originalPrincipal: 500_000,
    originalStartDate: '2020-01-15',
    originalTermMonths: 360,
    remainingMonths: 278,
    contractedAnnualRate: 4.5,
    marginPercent: null,
    rateBasis: 'annualNominal',
    method: 'spitzer',
    resetMonths: 0,
    lastRateResetDate: null,
    nextRateResetDate: null,
    historicalResets: [],
    graceMonths: 0,
    graceMode: 'interestOnly',
    balloonPercent: null,
    maturityDate: '2050-01-15',
    dataStatus: 'verified',
    ...overrides,
  }
}

function mortgage(overrides: Partial<ExistingMortgage> = {}): ExistingMortgage {
  return {
    id: 'mortgage-1',
    label: 'משכנתא קיימת',
    asOfDate: '2026-11-20',
    totalPayoffBalance: null,
    tracks: [track()],
    sourceDocumentIds: [],
    dataStatus: 'verified',
    ...overrides,
  }
}

describe('existing mortgage model', () => {
  it('parses a fully verified record and sums only complete balances', () => {
    const parsed = existingMortgageSchema.parse(
      mortgage({
        totalPayoffBalance: 900_000,
        tracks: [
          track({ id: 'a', currentBalance: 400_000 }),
          track({ id: 'b', currentBalance: 500_000 }),
        ],
      }),
    )

    expect(parsed.tracks).toHaveLength(2)
    expect(totalKnownBalance(parsed)).toBe(900_000)
    // Date-only term math: 2020-01-15 to 2050-01-15 is exactly 360 months.
    expect(
      originalTermMonthsFromDates({
        originalStartDate: '2020-01-15',
        maturityDate: '2050-01-15',
      }),
    ).toBe(360)
  })

  it('keeps unknown contract fields as null and refuses a partial payoff total', () => {
    const unknown = emptyExistingMortgageTrack('unknown-1')
    expect(unknown.currentBalance).toBeNull()
    expect(unknown.contractedAnnualRate).toBeNull()
    expect(unknown.remainingMonths).toBeNull()
    expect(unknown.dataStatus).toBe('unknown')

    const parsed = existingMortgageSchema.parse(
      mortgage({
        tracks: [track({ id: 'a', currentBalance: 400_000 }), { ...unknown, currentBalance: null }],
        dataStatus: 'partial',
      }),
    )

    // One known balance is not a payoff figure.
    expect(totalKnownBalance(parsed)).toBeNull()
  })

  it('allows linkage without a track type, but rejects a contradiction', () => {
    expect(
      existingMortgageTrackSchema.parse(track({ type: null, linkage: 'cpi' })).linkage,
    ).toBe('cpi')
    expect(
      existingMortgageTrackSchema.parse(track({ type: 'fixedIndexed', linkage: 'cpi' })).linkage,
    ).toBe('cpi')

    expect(() =>
      existingMortgageTrackSchema.parse(track({ type: 'fixed', linkage: 'cpi' })),
    ).toThrow(/linkage contradicts/)
    expect(() =>
      existingMortgageTrackSchema.parse(track({ type: 'variableIndexed5y', linkage: 'unlinked' })),
    ).toThrow(/linkage contradicts/)
  })

  it('preserves historical reset dates and rejects an unordered calendar', () => {
    const parsed = existingMortgageTrackSchema.parse(
      track({
        type: 'variable',
        linkage: 'unlinked',
        resetMonths: 60,
        lastRateResetDate: '2025-01-15',
        nextRateResetDate: '2030-01-15',
        historicalResets: [
          { date: '2020-01-15', rateBefore: 3.1, rateAfter: 3.4 },
          { date: '2025-01-15', rateBefore: 3.4, rateAfter: 3.9 },
        ],
      }),
    )

    expect(parsed.historicalResets.map((reset) => reset.date)).toEqual([
      '2020-01-15',
      '2025-01-15',
    ])

    expect(() =>
      existingMortgageTrackSchema.parse(
        track({
          historicalResets: [
            { date: '2025-01-15', rateBefore: 3.4, rateAfter: 3.9 },
            { date: '2020-01-15', rateBefore: 3.1, rateAfter: 3.4 },
          ],
        }),
      ),
    ).toThrow(/ascending date order/)
  })

  it('rejects impossible balances, rates, dates and reset order', () => {
    for (const bad of [
      track({ currentBalance: -1 }),
      track({ contractedAnnualRate: 101 }),
      track({ originalStartDate: '2026-02-30' }),
      track({ nextRateResetDate: '2024-01-15', lastRateResetDate: '2025-01-15' }),
      track({ graceMonths: 400, originalTermMonths: 360 }),
    ]) {
      expect(() => existingMortgageTrackSchema.parse(bad)).toThrow()
    }
    expect(() => existingMortgageSchema.parse(mortgage({ tracks: [] }))).toThrow()
  })

  it('stores a balloon percentage but never together with grace, and defaults it to null', () => {
    expect(existingMortgageTrackSchema.parse(track()).balloonPercent).toBeNull()
    expect(existingMortgageTrackSchema.parse(track({ balloonPercent: 40 })).balloonPercent).toBe(40)
    for (const balloonPercent of [0, -1, 100.5, Number.NaN]) {
      expect(() => existingMortgageTrackSchema.parse(track({ balloonPercent }))).toThrow()
    }
    expect(() =>
      existingMortgageTrackSchema.parse(track({ balloonPercent: 40, graceMonths: 6 })),
    ).toThrow(/balloon cannot be combined with grace/)
  })

  it('derives linkage only from a known type', () => {
    expect(linkageForTrackType('fixed')).toBe('unlinked')
    expect(linkageForTrackType('prime')).toBe('unlinked')
    expect(linkageForTrackType('variableIndexed')).toBe('cpi')
    expect(linkageForTrackType('fixedIndexed')).toBe('cpi')
    expect(linkageForTrackType(null)).toBeNull()
  })
})

describe('projected reset calendar', () => {
  it('adds whole months without rolling a month-end date into the next month', () => {
    expect(addMonthsToDateOnly('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDateOnly('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonthsToDateOnly('2030-01-15', 60)).toBe('2035-01-15')
    expect(addMonthsToDateOnly('2026-02-30', 1)).toBeNull()
  })

  it('rounds a date up to the first payment on or after it', () => {
    // 2026-11-21 to 2027-03-01: the March payment is the 4th payment.
    expect(monthsUntilDate('2026-11-21', '2027-03-01')).toBe(4)
    // A reset later in the as-of month already applies to month 1.
    expect(monthsUntilDate('2026-11-21', '2026-11-30')).toBe(1)
    expect(monthsUntilDate('2026-11-21', '2026-11-01')).toBe(1)
    // A reset after the as-of day in the following month applies to month 2.
    expect(monthsUntilDate('2026-11-21', '2026-12-31')).toBe(2)
    expect(monthsUntilDate('not-a-date', '2027-03-01')).toBeNull()
  })

  it('starts the existing calendar at the recorded next reset, not month zero', () => {
    const resets = projectedResetMonths(
      track({
        type: 'variable',
        resetMonths: 60,
        lastRateResetDate: '2025-01-15',
        nextRateResetDate: '2030-01-15',
      }),
      '2026-11-20',
      278,
    )

    // 2030-01-15 is 38 payments away; the next resets follow every 60 months.
    expect(resets).toEqual([38, 98, 158, 218, 278])

    const withoutStatedNext = projectedResetMonths(
      track({
        type: 'variable',
        resetMonths: 60,
        lastRateResetDate: '2025-01-15',
        nextRateResetDate: null,
      }),
      '2026-11-20',
      120,
    )
    expect(withoutStatedNext).toEqual([38, 98])
  })

  it('rolls a stale recorded reset forward by whole cadences', () => {
    expect(
      projectedResetMonths(
        track({
          type: 'variable',
          resetMonths: 60,
          nextRateResetDate: '2020-01-01',
          lastRateResetDate: '2015-01-01',
        }),
        '2026-11-21',
        120,
      )[0],
    ).toBe(38)
  })

  it('falls back to one full cadence only when no reset date was recorded', () => {
    expect(
      projectedResetMonths(
        track({ type: 'variable', resetMonths: null, lastRateResetDate: null, nextRateResetDate: null }),
        '2026-11-21',
        120,
      ),
    ).toEqual([13, 25, 37, 49, 61, 73, 85, 97, 109])
  })

  it('projects no resets for a track that does not reset or after the term ends', () => {
    expect(
      projectedResetMonths(
        track({ type: 'fixed', resetMonths: 0, nextRateResetDate: '2027-03-01' }),
        '2026-11-21',
        120,
      ),
    ).toEqual([])
    expect(
      projectedResetMonths(
        track({ type: 'variable', resetMonths: 60, nextRateResetDate: '2027-03-01' }),
        '2026-11-21',
        3,
      ),
    ).toEqual([])
    expect(
      projectedResetMonths(
        track({ type: 'variable', resetMonths: 60, nextRateResetDate: '2027-03-01' }),
        'bad-date',
        120,
      ),
    ).toEqual([])
  })
})
