import { describe, expect, it } from 'vitest'
import {
  MAX_SAVED_COMPARISONS,
  MAX_COMPARISON_LABEL_LENGTH,
  savedComparisonInputSchema,
} from '@/server/comparisons/schema'
import {
  MAX_MIXES,
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  PTI_MAX_THRESHOLD,
  PTI_MIN_THRESHOLD,
} from '@/lib/amortization'

/**
 * The route re-validates every client field, so these are the real bounds on
 * stored comparison snapshots. A comparison may be saved mid-edit, which is
 * why a blank track amount is accepted while a malformed value is not.
 */

const track = {
  type: 'fixed' as const,
  amountText: '1,000,000',
  yearsText: '30',
  yearsOverridden: false,
  rateText: '4.8',
  resetMonths: 0,
  graceMonths: 0,
  graceMode: 'interestOnly' as const,
  marginText: '',
  method: 'spitzer' as const,
}

const scenario = {
  label: 'First home',
  termYears: 30,
  activePreset: 'basket4' as const,
  approvalDateText: '2026-03-02',
  tracks: [track],
}

const shared = {
  propertyValueText: '1,500,000',
  capitalText: '400,000',
  incomeText: '25,000',
  purpose: 'first' as const,
  mortgageSumText: '1,000,000',
  realtorPercentText: '',
  lawyerPercentText: '1',
  appraiserFeeText: '',
  renovationAmountText: '50,000',
  otherExpenses: [{ monthlyText: '1,200', oneTimeText: '' }],
  ptiThresholdPercent: 33,
}

const valid = {
  label: 'First home options',
  snapshot: {
    version: 1 as const,
    shared,
    scenarios: [scenario, { ...scenario, label: '', activePreset: null }],
  },
}

describe('savedComparisonInputSchema', () => {
  it('accepts a well-formed comparison', () => {
    expect(savedComparisonInputSchema.safeParse(valid).success).toBe(true)
  })

  it('trims the comparison label and rejects an empty one', () => {
    const parsed = savedComparisonInputSchema.parse({ ...valid, label: '  Home  ' })
    expect(parsed.label).toBe('Home')
    expect(savedComparisonInputSchema.safeParse({ ...valid, label: '   ' }).success).toBe(false)
    expect(
      savedComparisonInputSchema.safeParse({
        ...valid,
        label: 'x'.repeat(MAX_COMPARISON_LABEL_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('requires exactly the supported snapshot version', () => {
    const snapshot = (version: number) => ({ ...valid, snapshot: { ...valid.snapshot, version } })
    expect(savedComparisonInputSchema.safeParse(snapshot(1)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(snapshot(2)).success).toBe(false)
    expect(savedComparisonInputSchema.safeParse(snapshot(0)).success).toBe(false)
  })

  it('keeps the comparison cap and scenario bounds separate from track bounds', () => {
    expect(MAX_SAVED_COMPARISONS).toBe(4)
    const scenarios = (count: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: Array.from({ length: count }, () => scenario),
      },
    })
    expect(savedComparisonInputSchema.safeParse(scenarios(2)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(scenarios(MAX_MIXES)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(scenarios(1)).success).toBe(false)
    expect(savedComparisonInputSchema.safeParse(scenarios(MAX_MIXES + 1)).success).toBe(false)
  })

  it('bounds tracks per mix to MAX_TRACKS', () => {
    const tracks = (count: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, tracks: Array.from({ length: count }, () => track) }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(tracks(MAX_TRACKS)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(tracks(MAX_TRACKS + 1)).success).toBe(false)
  })

  it('accepts a blank track amount, years and rate for a mix still being built', () => {
    const blank = { ...track, amountText: '', yearsText: '', rateText: '' }
    expect(
      savedComparisonInputSchema.safeParse({
        ...valid,
        snapshot: { ...valid.snapshot, scenarios: [{ ...scenario, tracks: [blank] }, scenario] },
      }).success,
    ).toBe(true)
  })

  it('rejects malformed amounts and negative numbers', () => {
    for (const amountText of ['1 000', '-500', '1.5', 'abc']) {
      expect(
        savedComparisonInputSchema.safeParse({
          ...valid,
          snapshot: {
            ...valid.snapshot,
            scenarios: [{ ...scenario, tracks: [{ ...track, amountText }] }, scenario],
          },
        }).success,
      ).toBe(false)
    }
  })

  it('bounds track years to 1..MAX_YEARS and the scenario term the same way', () => {
    const withYears = (yearsText: string) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, tracks: [{ ...track, yearsText }] }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(withYears('0')).success).toBe(false)
    expect(savedComparisonInputSchema.safeParse(withYears(String(MAX_YEARS))).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withYears(String(MAX_YEARS + 1))).success).toBe(
      false,
    )
    expect(savedComparisonInputSchema.safeParse(withYears('12.5')).success).toBe(false)

    const withTerm = (termYears: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, termYears }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(withTerm(0)).success).toBe(false)
    expect(savedComparisonInputSchema.safeParse(withTerm(MAX_YEARS)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withTerm(MAX_YEARS + 1)).success).toBe(false)
  })

  it('accepts only the supported reset cadences', () => {
    const withReset = (resetMonths: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, tracks: [{ ...track, resetMonths }] }, scenario],
      },
    })
    for (const resetMonths of [0, 12, 18, 24, 30, 36, 48, 60, 84, 120]) {
      expect(savedComparisonInputSchema.safeParse(withReset(resetMonths)).success).toBe(true)
    }
    for (const resetMonths of [-12, 6, 72, 121]) {
      expect(savedComparisonInputSchema.safeParse(withReset(resetMonths)).success).toBe(false)
    }
  })

  it('rejects a grace longer than the track term', () => {
    const withGrace = (graceMonths: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, tracks: [{ ...track, graceMonths }] }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(withGrace(30 * 12)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withGrace(30 * 12 + 1)).success).toBe(false)
  })

  it('rejects an unknown purpose, preset, track type or method', () => {
    const withShared = (patch: object) => ({
      ...valid,
      snapshot: { ...valid.snapshot, shared: { ...shared, ...patch } },
    })
    expect(savedComparisonInputSchema.safeParse(withShared({ purpose: 'holiday' })).success).toBe(
      false,
    )

    const withScenario = (patch: object) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, ...patch }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(withScenario({ activePreset: 'basket9' })).success).toBe(
      false,
    )
    expect(
      savedComparisonInputSchema.safeParse(
        withScenario({ tracks: [{ ...track, type: 'balloon' }] }),
      ).success,
    ).toBe(false)
    expect(
      savedComparisonInputSchema.safeParse(
        withScenario({ tracks: [{ ...track, method: 'grace' }] }),
      ).success,
    ).toBe(false)
  })

  it('accepts a blank or real approval date and rejects junk', () => {
    const withDate = (approvalDateText: string) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        scenarios: [{ ...scenario, approvalDateText }, scenario],
      },
    })
    expect(savedComparisonInputSchema.safeParse(withDate('')).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withDate('2026-03-02')).success).toBe(true)
    for (const approvalDateText of ['2026-02-30', '02/03/2026', '2026-3-2', '2026-03-02 ']) {
      expect(savedComparisonInputSchema.safeParse(withDate(approvalDateText)).success).toBe(false)
    }
  })

  it('bounds the PTI threshold inclusively', () => {
    const withPti = (ptiThresholdPercent: number) => ({
      ...valid,
      snapshot: { ...valid.snapshot, shared: { ...shared, ptiThresholdPercent } },
    })
    expect(savedComparisonInputSchema.safeParse(withPti(PTI_MIN_THRESHOLD * 100)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withPti(PTI_MAX_THRESHOLD * 100)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(withPti(PTI_MIN_THRESHOLD * 100 - 0.1)).success).toBe(
      false,
    )
    expect(savedComparisonInputSchema.safeParse(withPti(PTI_MAX_THRESHOLD * 100 + 0.1)).success).toBe(
      false,
    )
  })

  it('caps the shared expense rows', () => {
    const expenses = (count: number) => ({
      ...valid,
      snapshot: {
        ...valid.snapshot,
        shared: {
          ...shared,
          otherExpenses: Array.from({ length: count }, () => ({
            monthlyText: '1',
            oneTimeText: '',
          })),
        },
      },
    })
    expect(savedComparisonInputSchema.safeParse(expenses(MAX_OTHER_EXPENSES)).success).toBe(true)
    expect(savedComparisonInputSchema.safeParse(expenses(MAX_OTHER_EXPENSES + 1)).success).toBe(
      false,
    )
  })
})
