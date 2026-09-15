import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeScenario,
  sharedFeeProfileFromTexts,
  type SharedBuyerInputs,
} from '@/features/compare/computeScenario'
import { computeTrackResult } from '@/lib/amortization'
import { useComparisonStore, seedFromCalculator } from '@/stores/comparisonStore'
import type { TrackState } from '@/stores/calculatorStore'

/**
 * Comparison layer tests. The math is NOT re-derived here: every figure is
 * checked against the pure amortization.ts functions (the same source the
 * main calculator uses) plus hand-checked golden annuity values.
 */

function track(overrides: Partial<TrackState> = {}): TrackState {
  return {
    id: 't1',
    type: 'fixed',
    amountText: '1,000,000',
    yearsText: '15',
    rateText: '4.5',
    method: 'spitzer',
    isAutoRate: true,
    loanShareMemory: null,
    ...overrides,
  }
}

const baseInputs: SharedBuyerInputs = {
  propertyValueText: '1,200,000',
  capitalText: '200,000',
  incomeText: '',
  purpose: 'first',
  realtorPercent: 2,
  lawyerPercent: 0.5,
  appraiserFee: 0,
  renovations: 0,
  otherMonthly: 0,
  oneTimeExpenses: 0,
  ptiThresholdPercent: 33,
}

describe('computeScenario - golden values', () => {
  it('computes a single 15y fixed track (annuity: 1,000,000 @ 4.5%)', () => {
    // A = P·r/(1-(1+r)^-n); r=0.045/12, n=180 → 7,649.96/month.
    const result = computeScenario([track()], baseInputs)
    expect(result.isEmpty).toBe(false)
    expect(result.error).toBeNull()
    expect(Math.round(result.totals.firstPayment)).toBe(7_650)
    // The schedule recomputes the payment monthly on the remaining balance,
    // so the total lands a hair under 180 × A (1,376,992.6 → 1,376,988).
    expect(Math.round(result.totals.totalPaid)).toBe(1_376_988)
    expect(Math.round(result.totals.totalInterest)).toBe(376_988)
    expect(result.loanAmount).toBe(1_000_000)
    // Interest / loan ≈ 37.70% overpay.
    expect(result.overpayPercent).toBeCloseTo(37.6993, 2)
    // Single 4.5% track: weighted == plain average == 4.5.
    expect(result.weightedAvgInterestRate).toBeCloseTo(4.5, 6)
    expect(result.avgInterestRate).toBeCloseTo(4.5, 6)
    expect(result.maxTermYears).toBe(15)
    expect(result.summaryTypes).toEqual(['fixed'])
    expect(result.variableSharePercent).toBe(0)
  })

  it('matches the main calculator path for a two-track mix', () => {
    // 400k prime @ 5.75% + 600k fixed @ 4.5%, both 15y. Compared against the
    // raw pure functions directly (a lone prime track would trip the 2/3
    // variable cap in computeScenario's error gate).
    const primeTrack = track({ type: 'prime', amountText: '400,000', rateText: '5.75' })
    const fixedTrack = track({ amountText: '600,000' })
    const result = computeScenario([primeTrack, fixedTrack], baseInputs)
    expect(result.loanAmount).toBe(1_000_000)
    // Weighted average rate: (400·5.75 + 600·4.5)/1000 = 5.0.
    expect(result.weightedAvgInterestRate).toBeCloseTo(5.0, 6)
    // Variable share = 40%.
    expect(result.variableSharePercent).toBeCloseTo(40, 6)
    // The totals must equal the sum of the individually computed tracks.
    const primeResult = computeTrackResult({
      principal: 400_000,
      years: 15,
      annualRatePercent: 5.75,
      type: 'prime',
      method: 'spitzer',
    })!
    const fixedResult = computeTrackResult({
      principal: 600_000,
      years: 15,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
    })!
    expect(result.totals.firstPayment).toBeCloseTo(
      primeResult.firstPayment + fixedResult.firstPayment,
      4,
    )
    expect(result.totals.totalPaid).toBeCloseTo(primeResult.totalPaid + fixedResult.totalPaid, 2)
    expect(result.totals.totalInterest).toBeCloseTo(
      primeResult.totalInterest + fixedResult.totalInterest,
      2,
    )
  })

  it('stresses the first payment +1 point on variable tracks only', () => {
    const primeTrack = track({ type: 'prime', amountText: '400,000', rateText: '5.75' })
    const fixedTrack = track({ amountText: '600,000' })
    const result = computeScenario([primeTrack, fixedTrack], baseInputs)
    // The stressed first payment equals: prime repriced at 6.75% plus the
    // fixed track's unchanged payment (both from the raw pure functions).
    const primeStressed = computeTrackResult({
      principal: 400_000,
      years: 15,
      annualRatePercent: 6.75,
      type: 'prime',
      method: 'spitzer',
    })!
    const fixedPlain = computeTrackResult({
      principal: 600_000,
      years: 15,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
    })!
    expect(result.firstPaymentRateUp1).toBeCloseTo(
      primeStressed.firstPayment + fixedPlain.firstPayment,
      4,
    )
    // And the stressed first payment exceeds the unstressed one.
    expect(result.firstPaymentRateUp1).toBeGreaterThan(result.totals.firstPayment)
  })
})

describe('computeScenario - errors and caps', () => {
  it('flags an invalid term (0 years) with no numbers', () => {
    const result = computeScenario([track({ yearsText: '0' })], baseInputs)
    expect(result.error).toBe('positive')
    expect(result.totals.firstPayment).toBe(0)
  })

  it('flags a non-positive amount', () => {
    const result = computeScenario([track({ amountText: '-5' })], baseInputs)
    // '-5' parses to a negative principal → computeTrackResult null → error.
    expect(result.error).toBe('positive')
  })

  it('flags the variable cap above 2/3', () => {
    const result = computeScenario(
      [
        track({ type: 'prime', amountText: '700,000', rateText: '5.75' }),
        track({ amountText: '300,000' }),
      ],
      baseInputs,
    )
    expect(result.error).toBe('variableCap')
  })

  it('reports LTV violation above the purpose limit', () => {
    // Loan 1,000,000 on a 1,200,000 property = 83.3% > 75%.
    const result = computeScenario([track()], baseInputs)
    expect(result.ltv).not.toBeNull()
    expect(result.ltv!.limit).toBe(75)
    expect(result.ltv!.percent).toBeCloseTo(83.333, 1)
    expect(result.ltv!.maxLoan).toBe(900_000)
  })

  it('reports DTI above the 50% rule', () => {
    const result = computeScenario([track()], { ...baseInputs, incomeText: '10,000' })
    // 7,650 / 10,000 > 50% → minimum income ceil(7650·2/500)·500 = 15,500.
    expect(result.dti).not.toBeNull()
    expect(result.dti!.minIncome).toBe(15_500)
  })

  it('reports PTI above the adjustable 33% ceiling', () => {
    const result = computeScenario([track()], { ...baseInputs, incomeText: '20,000' })
    // First payment 7,650 + other 0 = 7,650; 33% of 20,000 = 6,600 → over.
    // minIncome = ceil(7650 / 0.33 / 500) · 500 = 23,500.
    expect(result.pti).not.toBeNull()
    expect(result.pti!.minIncome).toBe(23_500)
  })

  it('shows an empty scenario with regulatory context but zero numbers', () => {
    const result = computeScenario([track({ amountText: '' })], baseInputs)
    expect(result.isEmpty).toBe(true)
    expect(result.totals.firstPayment).toBe(0)
    // With property 1.2M and capital 200k the financing ratio is fine: no LTV.
    expect(result.ltv).toBeNull()
    expect(result.suggestedCapital).not.toBeNull()
    expect(result.upfrontTotal).not.toBeNull()
  })
})

describe('computeScenario - shared inputs', () => {
  it('renovations eat into the capital before deriving the loan', () => {
    // Property 1.2M, capital 200k, renovations 50k → capital-for-loan 150k.
    // Loan 1,050,000 + capital 150,000 = 1,200,000 effective value → 87.5%.
    const result = computeScenario([track({ amountText: '1,050,000' })], {
      ...baseInputs,
      renovations: 50_000,
    })
    expect(result.ltv!.percent).toBeCloseTo(87.5, 4)
  })

  it('prices the fee profile from typed and cleared fields', () => {
    const profile = sharedFeeProfileFromTexts({
      realtorPercentText: '',
      lawyerPercentText: '',
      appraiserFeeText: '',
    })
    // Cleared fields fall back to the market norms.
    expect(profile.realtorPercent).toBe(2)
    expect(profile.lawyerPercent).toBe(0.5)
    expect(profile.appraiserFee).toBe(0)

    const typed = sharedFeeProfileFromTexts({
      realtorPercentText: '1.5',
      lawyerPercentText: '0.3',
      appraiserFeeText: '2,500',
    })
    expect(typed.realtorPercent).toBe(1.5)
    expect(typed.lawyerPercent).toBe(0.3)
    expect(typed.appraiserFee).toBe(2_500)
  })

  it('upfront total = suggested capital + purchase tax + fees', () => {
    // Property 1.2M first home: purchase tax = 0 (under the exemption).
    // Suggested capital = 25% of 1.2M = 300,000.
    // Realtor 2% = 24,000 → 28,320 VAT; lawyer 0.5% of 1.2M = 6,000 = floor
    // → 7,080 VAT. Upfront = 300,000 + 28,320 + 7,080.
    const result = computeScenario([track()], baseInputs)
    expect(result.upfrontTotal).toBe(300_000 + 28_320 + 7_080)
  })
})

describe('comparisonStore', () => {
  beforeEach(() => {
    useComparisonStore.getState().reset()
  })

  it('starts with two scenarios computed from the default mix', () => {
    const state = useComparisonStore.getState()
    expect(state.scenarios).toHaveLength(2)
    expect(state.results).toHaveLength(2)
    // Both scenarios are the same mix → identical totals.
    expect(state.results[0].totals.firstPayment).toBe(state.results[1].totals.firstPayment)
    expect(state.results[0].totals.firstPayment).toBeGreaterThan(0)
  })

  it('recomputes all scenarios when a shared input changes', () => {
    useComparisonStore.getState().reset()
    // Seed a property first so the LTV context has a basis to compare.
    useComparisonStore.getState().setPropertyValue('2,000,000', null)
    const before = useComparisonStore.getState().results[0].ltv
    expect(before).toBeNull() // loan 1M on 2M property = 50% → compliant
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    const after = useComparisonStore.getState().results[0].ltv
    // 1M on 1.2M = 83.3% → violation appears; the shared edit repriced it.
    expect(after).not.toBeNull()
    expect(after!.effectiveValue).toBe(1_200_000)
  })

  it('duplicates a scenario with independent track ids', () => {
    const store = useComparisonStore.getState()
    const firstId = store.scenarios[0].id
    store.duplicateScenario(firstId)
    const state = useComparisonStore.getState()
    expect(state.scenarios).toHaveLength(3)
    const original = state.scenarios[0]
    const copy = state.scenarios[1]
    expect(copy.tracks).toHaveLength(original.tracks.length)
    for (let index = 0; index < original.tracks.length; index++) {
      expect(copy.tracks[index].id).not.toBe(original.tracks[index].id)
      expect(copy.tracks[index].amountText).toBe(original.tracks[index].amountText)
    }
    // Editing the copy never touches the original.
    useComparisonStore.getState().updateTrackAmount(copy.id, copy.tracks[0].id, '500,000', null)
    const after = useComparisonStore.getState()
    expect(after.scenarios[1].tracks[0].amountText).toBe('500,000')
    expect(after.scenarios[0].tracks[0].amountText).toBe('400,000')
  })

  it('enforces the 2..3 scenario window and the 1..3 track window', () => {
    const store = useComparisonStore.getState()
    store.addScenario()
    expect(useComparisonStore.getState().scenarios).toHaveLength(3)
    store.addScenario()
    expect(useComparisonStore.getState().scenarios).toHaveLength(3)

    store.removeScenario(useComparisonStore.getState().scenarios[0].id)
    expect(useComparisonStore.getState().scenarios).toHaveLength(2)
    store.removeScenario(useComparisonStore.getState().scenarios[0].id)
    expect(useComparisonStore.getState().scenarios).toHaveLength(2)

    const scenario = useComparisonStore.getState().scenarios[0]
    useComparisonStore.getState().removeTrack(scenario.id, scenario.tracks[0].id)
    expect(useComparisonStore.getState().scenarios[0].tracks).toHaveLength(2)
  })

  it('recomputes a scenario when its tracks change', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    const before = useComparisonStore.getState().results[0].totals.firstPayment
    useComparisonStore
      .getState()
      .updateTrackAmount(scenario.id, scenario.tracks[0].id, '200,000', null)
    const after = useComparisonStore.getState().results[0].totals.firstPayment
    expect(after).toBeLessThan(before)
  })

  it('clamps track years live and on blur', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    // Live typing clamps immediately (same contract as the main calculator:
    // constrainYearsText clamps 99 → 30 while typing).
    useComparisonStore.getState().updateTrackYears(scenario.id, scenario.tracks[0].id, '99')
    expect(useComparisonStore.getState().scenarios[0].tracks[0].yearsText).toBe('30')
    useComparisonStore.getState().commitTrackYearsBlur(scenario.id, scenario.tracks[0].id)
    expect(useComparisonStore.getState().scenarios[0].tracks[0].yearsText).toBe('30')
    // Clearing is allowed live; blur restores the 1-year minimum.
    useComparisonStore.getState().updateTrackYears(scenario.id, scenario.tracks[0].id, '')
    expect(useComparisonStore.getState().scenarios[0].tracks[0].yearsText).toBe('')
    useComparisonStore.getState().commitTrackYearsBlur(scenario.id, scenario.tracks[0].id)
    expect(useComparisonStore.getState().scenarios[0].tracks[0].yearsText).toBe('1')
  })

  it('reseeds a cleared rate on blur to the type default (5.75 for prime)', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    const trackId = store.scenarios[0].tracks[0].id
    useComparisonStore.getState().changeTrackType(scenario.id, trackId, 'prime')
    useComparisonStore.getState().updateTrackRate(scenario.id, trackId, '')
    useComparisonStore.getState().commitTrackRateBlur(scenario.id, trackId)
    const track = useComparisonStore.getState().scenarios[0].tracks.find((t) => t.id === trackId)!
    expect(track.rateText).toBe('5.75')
  })

  it('term slider drives every track term in the scenario', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    useComparisonStore.getState().setScenarioTermYears(scenario.id, 25)
    const after = useComparisonStore.getState()
    after.scenarios[0].tracks.forEach((track) => {
      expect(track.yearsText).toBe('25')
    })
    expect(after.results[0].maxTermYears).toBe(25)
  })

  it('seedFromCalculator copies shared inputs and both scenario mixes', () => {
    seedFromCalculator({
      propertyValueText: '1,500,000',
      capitalText: '300,000',
      incomeText: '25,000',
      purpose: 'upgrade',
      realtorPercentText: '',
      lawyerPercentText: '',
      appraiserFeeText: '',
      renovationAmountText: '',
      otherExpenses: [{ amountText: '1,000', oneTimeAmountText: '5,000' }],
      ptiThresholdPercent: 33,
      termYears: 20,
      // A realistic mix: a lone prime track would trip the 2/3 variable cap,
      // exactly as it does in the main calculator (parity below). In the real
      // calculator the slider keeps every track's years in sync with
      // termYears, so the seeded track carries 20 here too.
      tracks: [track({ amountText: '800,000', yearsText: '20' })],
    })
    const state = useComparisonStore.getState()
    expect(state.shared.propertyValueText).toBe('1,500,000')
    expect(state.shared.purpose).toBe('upgrade')
    expect(state.shared.otherMonthly).toBe(1_000)
    expect(state.shared.oneTimeExpenses).toBe(5_000)
    expect(state.scenarios).toHaveLength(2)
    expect(state.scenarios[0].tracks[0].amountText).toBe('800,000')
    expect(state.scenarios[0].termYears).toBe(20)
    // Scenario 2 is a duplicate with fresh ids.
    expect(state.scenarios[1].tracks[0].id).not.toBe(state.scenarios[0].tracks[0].id)
    // Results were recomputed against the seeded inputs.
    expect(state.results[0].loanAmount).toBe(800_000)
    expect(state.results[0].maxTermYears).toBe(20)
  })

  it('seedFromCalculator surfaces the variable-cap error for a lone prime mix (parity)', () => {
    seedFromCalculator({
      propertyValueText: '',
      capitalText: '',
      incomeText: '',
      purpose: 'first',
      realtorPercentText: '',
      lawyerPercentText: '',
      appraiserFeeText: '',
      renovationAmountText: '',
      otherExpenses: [],
      ptiThresholdPercent: 33,
      termYears: 15,
      tracks: [track({ type: 'prime', amountText: '800,000', rateText: '5.75' })],
    })
    const state = useComparisonStore.getState()
    expect(state.results[0].error).toBe('variableCap')
    expect(state.results[0].totals.firstPayment).toBe(0)
  })
})
