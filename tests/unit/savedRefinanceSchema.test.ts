import { describe, expect, it } from 'vitest'
import {
  MAX_REFINANCE_LABEL_LENGTH,
  MAX_SAVED_REFINANCES,
  savedRefinanceInputSchema,
} from '@/server/refinances/schema'
import { MAX_TRACKS, MAX_YEARS } from '@/lib/amortization'
import { emptyExistingMortgageTrack } from '@/features/refinance/existingMortgage'

/**
 * The API re-validates everything a client sends, so these are the real bounds
 * on a stored refinance proposal. The existing side deliberately keeps its
 * explicit `null` unknowns: a payoff statement may be incomplete, and a missing
 * value must never become a zero on the way to the database.
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

const valid = {
  label: 'First home refinance',
  snapshot: {
    version: 1 as const,
    existingTracks: [existingTrack],
    proposedTracks: [proposedTrack, { ...proposedTrack, sharePercent: 40 }],
    feeAmount: 12_000,
    feeMode: 'capitalized' as const,
  },
}

const withSnapshot = (patch: object) => ({
  ...valid,
  snapshot: { ...valid.snapshot, ...patch },
})

describe('savedRefinanceInputSchema', () => {
  it('accepts a well-formed proposal', () => {
    expect(savedRefinanceInputSchema.safeParse(valid).success).toBe(true)
  })

  it('keeps the saved-proposal cap at 4', () => {
    expect(MAX_SAVED_REFINANCES).toBe(4)
  })

  it('trims the label and rejects an empty or over-long one', () => {
    const parsed = savedRefinanceInputSchema.parse({ ...valid, label: '  Home  ' })
    expect(parsed.label).toBe('Home')
    expect(savedRefinanceInputSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false)
    expect(
      savedRefinanceInputSchema.safeParse({
        ...valid,
        label: 'x'.repeat(MAX_REFINANCE_LABEL_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('requires exactly the supported snapshot version', () => {
    for (const version of [0, 2, '1']) {
      expect(savedRefinanceInputSchema.safeParse(withSnapshot({ version })).success).toBe(false)
    }
  })

  it('requires at least one track on each side and bounds both at MAX_TRACKS', () => {
    const existing = (count: number) =>
      withSnapshot({ existingTracks: Array.from({ length: count }, () => existingTrack) })
    const proposed = (count: number) =>
      withSnapshot({ proposedTracks: Array.from({ length: count }, () => proposedTrack) })

    expect(savedRefinanceInputSchema.safeParse(withSnapshot({ existingTracks: [] })).success).toBe(
      false,
    )
    expect(savedRefinanceInputSchema.safeParse(withSnapshot({ proposedTracks: [] })).success).toBe(
      false,
    )
    expect(savedRefinanceInputSchema.safeParse(existing(MAX_TRACKS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(existing(MAX_TRACKS + 1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(proposed(MAX_TRACKS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(proposed(MAX_TRACKS + 1)).success).toBe(false)
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
          withSnapshot({ proposedTracks: [{ ...proposedTrack, sharePercent }] }),
        ).success,
      ).toBe(false)
    }
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({ proposedTracks: [{ ...proposedTrack, sharePercent: 100 }] }),
      ).success,
    ).toBe(true)
  })

  it('does not require the shares to sum to 100 (they are normalised at pricing)', () => {
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({
          proposedTracks: [
            { ...proposedTrack, sharePercent: 2 },
            { ...proposedTrack, sharePercent: 3 },
          ],
        }),
      ).success,
    ).toBe(true)
  })

  it('bounds the rate to 0..100 and the term to whole years within MAX_YEARS', () => {
    const withRate = (annualRatePercent: number) =>
      withSnapshot({ proposedTracks: [{ ...proposedTrack, annualRatePercent }] })
    expect(savedRefinanceInputSchema.safeParse(withRate(0)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withRate(100)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withRate(-0.1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withRate(100.1)).success).toBe(false)

    const withTerm = (termYears: number) =>
      withSnapshot({ proposedTracks: [{ ...proposedTrack, termYears }] })
    expect(savedRefinanceInputSchema.safeParse(withTerm(1)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withTerm(MAX_YEARS)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withTerm(0)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withTerm(MAX_YEARS + 1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withTerm(12.5)).success).toBe(false)
  })

  it('bounds the reset cadence to 0..120 whole months', () => {
    const withReset = (resetMonths: number) =>
      withSnapshot({ proposedTracks: [{ ...proposedTrack, resetMonths }] })
    expect(savedRefinanceInputSchema.safeParse(withReset(0)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withReset(120)).success).toBe(true)
    expect(savedRefinanceInputSchema.safeParse(withReset(-1)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withReset(121)).success).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withReset(12.5)).success).toBe(false)
  })

  it('rejects unknown track types, methods and fee modes', () => {
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({ proposedTracks: [{ ...proposedTrack, type: 'balloon' }] }),
      ).success,
    ).toBe(false)
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({ proposedTracks: [{ ...proposedTrack, method: 'grace' }] }),
      ).success,
    ).toBe(false)
    expect(savedRefinanceInputSchema.safeParse(withSnapshot({ feeMode: 'credit' })).success).toBe(
      false,
    )
  })

  it('rejects extra fields instead of silently dropping them', () => {
    expect(savedRefinanceInputSchema.safeParse({ ...valid, ownerId: 'someone-else' }).success).toBe(
      false,
    )
    expect(
      savedRefinanceInputSchema.safeParse(
        withSnapshot({ proposedTracks: [{ ...proposedTrack, amount: 500_000 }] }),
      ).success,
    ).toBe(false)
  })
})
