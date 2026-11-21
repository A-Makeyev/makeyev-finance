import { describe, expect, it } from 'vitest'
import {
  emptyExistingMortgageTrack,
  existingMortgageSchema,
  existingMortgageTrackSchema,
  linkageForTrackType,
  originalTermMonthsFromDates,
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

  it('derives linkage only from a known type', () => {
    expect(linkageForTrackType('fixed')).toBe('unlinked')
    expect(linkageForTrackType('prime')).toBe('unlinked')
    expect(linkageForTrackType('variableIndexed')).toBe('cpi')
    expect(linkageForTrackType('fixedIndexed')).toBe('cpi')
    expect(linkageForTrackType(null)).toBeNull()
  })
})
