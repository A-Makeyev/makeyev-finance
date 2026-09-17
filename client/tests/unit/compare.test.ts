import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeScenario,
  sharedFeeProfileFromTexts,
  type SharedBuyerInputs,
} from '@/features/compare/computeScenario'
import { DEFAULT_TERM_YEARS, computeTrackResult } from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
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

  it('folds other monthly and one-time expenses into PTI and upfront', () => {
    // The shared buyer expenses describe the buyer, not the scenario: the
    // monthly amount joins the payment-to-income obligation, the one-time
    // amount joins the upfront cash. Golden values: first payment 7,649.9329
    // + 1,000 monthly = 8,649.9329 → minIncome ceil(8649.93/0.33/500)·500 =
    // 26,500. Upfront on the 1.2M property: 300,000 suggested capital +
    // 28,320 realtor VAT + 7,080 lawyer VAT + 5,000 one-time.
    const result = computeScenario([track()], {
      ...baseInputs,
      incomeText: '20,000',
      otherMonthly: 1_000,
      oneTimeExpenses: 5_000,
    })
    expect(result.pti).not.toBeNull()
    expect(result.pti!.payment).toBeCloseTo(8_649.9329, 3)
    expect(result.pti!.minIncome).toBe(26_500)
    expect(result.upfrontTotal).toBe(300_000 + 28_320 + 7_080 + 5_000)
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

  it('opens with the calculator default mix in scenario 1 and a blank scenario 2', () => {
    const state = useComparisonStore.getState()
    expect(state.scenarios).toHaveLength(2)
    expect(state.results).toHaveLength(2)
    // Scenario 1 (תרחיש 1): the same ₪1,000,000 תמהיל מומלץ (basket4) the
    // calculator opens with, via the same createInitialTracks. Golden values
    // hand-checked: 400k prime @ 5.75 + 340k fixed @ 4.5 + 260k indexed @ 3.0,
    // 15y annuity → first payment ₪7,718.13.
    const mix = state.scenarios[0]
    expect(mix.termYears).toBe(DEFAULT_TERM_YEARS)
    // The sum field opens like the calculator's: ₪1,000,000, the mix total.
    expect(mix.mortgageSumText).toBe('1,000,000')
    expect(mix.activePreset).toBe('basket4')
    expect(mix.tracks.map((t) => t.type)).toEqual(['prime', 'fixed', 'variableIndexed5y'])
    expect(mix.tracks.map((t) => t.amountText)).toEqual(['400,000', '340,000', '260,000'])
    expect(mix.tracks.map((t) => t.rateText)).toEqual(['5.75', '4.5', '3'])
    expect(state.results[0].isEmpty).toBe(false)
    expect(state.results[0].error).toBeNull()
    expect(state.results[0].loanAmount).toBe(1_000_000)
    expect(Math.round(state.results[0].totals.firstPayment)).toBe(7_718)
    // Scenario 2 stays the blank alternative the user defines: a single track
    // with no amount and the type's default rate, so a typed amount never
    // prices a 0% loan (the blank-rate trap the blur guard closes too).
    const alt = state.scenarios[1]
    expect(alt.termYears).toBe(DEFAULT_TERM_YEARS)
    expect(alt.tracks).toHaveLength(1)
    expect(alt.tracks[0].amountText).toBe('')
    expect(alt.tracks[0].rateText).toBe('4.5')
    expect(alt.tracks[0].yearsText).toBe(String(DEFAULT_TERM_YEARS))
    // The blank column reads as empty, not as a ₪0 mortgage.
    expect(state.results[1].isEmpty).toBe(true)
    expect(state.results[1].totals.firstPayment).toBe(0)
    expect(state.results[1].loanAmount).toBe(0)
  })

  it('recomputes all scenarios when a shared input changes', () => {
    useComparisonStore.getState().reset()
    // The opening mix borrows ₪1,000,000 in scenario 1. Setting a property
    // (with no capital) re-derives the loan to the full price - the tracks
    // scale up with it (calculator parity), so the LTV sits at 100%.
    useComparisonStore.getState().setPropertyValue('2,000,000', null)
    const scaled = useComparisonStore.getState()
    expect(scaled.results[0].loanAmount).toBe(2_000_000)
    expect(scaled.scenarios[0].mortgageSumText).toBe('2,000,000')
    expect(scaled.results[0].ltv).not.toBeNull()
    expect(scaled.results[0].ltv!.percentRounded).toBe(100)
    // Capital 1M brings the loan back to 1M on the 2M property = 50%.
    useComparisonStore.getState().setCapital('1,000,000', null)
    const financed = useComparisonStore.getState()
    expect(financed.results[0].loanAmount).toBe(1_000_000)
    expect(financed.scenarios[0].mortgageSumText).toBe('1,000,000')
    expect(financed.results[0].ltv).toBeNull()
    // Drop the capital back to 200k: the loan jumps to 1M again (the tracks
    // re-allocate with it), then the property drops to 1.2M.
    useComparisonStore.getState().setCapital('200,000', null)
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    const after = useComparisonStore.getState().results[0].ltv
    // 1M on 1.2M = 83.3% → violation appears; the shared edit repriced it.
    expect(after).not.toBeNull()
    expect(after!.effectiveValue).toBe(1_200_000)
  })

  it('duplicates a scenario with independent track ids', () => {
    const store = useComparisonStore.getState()
    const firstId = store.scenarios[0].id
    // The opening mix already carries three tracks - a real deep-copy workout.
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
    useComparisonStore.getState().updateTrackAmount(copy.id, copy.tracks[0].id, '300,000', null)
    const after = useComparisonStore.getState()
    expect(after.scenarios[1].tracks[0].amountText).toBe('300,000')
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

    // The track window is exercised on scenario 2 (opens with one track);
    // scenario 1 already sits at the 3-track max with the default mix.
    const blank = useComparisonStore.getState().scenarios[1]
    useComparisonStore.getState().addTrack(blank.id)
    useComparisonStore.getState().addTrack(blank.id)
    expect(useComparisonStore.getState().scenarios[1].tracks).toHaveLength(3)
    useComparisonStore.getState().addTrack(blank.id)
    expect(useComparisonStore.getState().scenarios[1].tracks).toHaveLength(3)
    useComparisonStore.getState().removeTrack(blank.id, blank.tracks[0].id)
    expect(useComparisonStore.getState().scenarios[1].tracks).toHaveLength(2)
  })

  it('recomputes a scenario when its tracks change', () => {
    const store = useComparisonStore.getState()
    // Scenario 2's single blank track: a clean one-track repricing (scenario 1
    // is the opening mix, whose variable cap a big single edit would trip).
    const scenario = store.scenarios[1]
    useComparisonStore
      .getState()
      .updateTrackAmount(scenario.id, scenario.tracks[0].id, '1,000,000', null)
    const before = useComparisonStore.getState().results[1].totals.firstPayment
    expect(before).toBeGreaterThan(0)
    useComparisonStore
      .getState()
      .updateTrackAmount(scenario.id, scenario.tracks[0].id, '200,000', null)
    const after = useComparisonStore.getState().results[1].totals.firstPayment
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

  it('seedFromCalculator copies the shared inputs and the calculator mix into scenario 1', () => {
    seedFromCalculator({
      propertyValueText: '1,500,000',
      capitalText: '300,000',
      incomeText: '25,000',
      purpose: 'upgrade',
      realtorPercentText: '',
      lawyerPercentText: '',
      appraiserFeeText: '',
      renovationAmountText: '',
      otherExpenses: [{ label: 'מס דירה', amountText: '1,000', oneTimeAmountText: '5,000' }],
      ptiThresholdPercent: 33,
      termYears: 20,
      mortgageSumText: '800,000',
      activePreset: null,
      // A realistic mix: a lone prime track would trip the 2/3 variable cap,
      // exactly as it does in the main calculator (parity below). In the real
      // calculator the slider keeps every track's years in sync with
      // termYears, so the seeded track carries 20 here too.
      tracks: [track({ amountText: '800,000', yearsText: '20' })],
    })
    const state = useComparisonStore.getState()
    expect(state.shared.propertyValueText).toBe('1,500,000')
    expect(state.shared.purpose).toBe('upgrade')
    // The calculator's expense rows arrive as editable rows (fresh ids), not
    // as pre-summed numbers - the sums derive at recompute time.
    expect(state.shared.otherExpenses).toHaveLength(1)
    expect(state.shared.otherExpenses[0].label).toBe('מס דירה')
    expect(state.shared.otherExpenses[0].monthlyText).toBe('1,000')
    expect(state.shared.otherExpenses[0].oneTimeText).toBe('5,000')
    expect(state.scenarios).toHaveLength(2)
    expect(state.scenarios[0].tracks[0].amountText).toBe('800,000')
    expect(state.scenarios[0].termYears).toBe(20)
    // The calculator's sum field travels with the mix (parity).
    expect(state.scenarios[0].mortgageSumText).toBe('800,000')
    expect(state.scenarios[1].mortgageSumText).toBe('')
    // Scenario 2 is a blank alternative with fresh ids: the mix the user arrived
    // with is scenario 1, the comparison column is theirs to define.
    expect(state.scenarios[1].tracks).toHaveLength(1)
    expect(state.scenarios[1].tracks[0].id).not.toBe(state.scenarios[0].tracks[0].id)
    expect(state.scenarios[1].tracks[0].amountText).toBe('')
    expect(state.scenarios[1].termYears).toBe(20)
    expect(state.results[1].isEmpty).toBe(true)
    // Results were recomputed against the seeded inputs.
    expect(state.results[0].loanAmount).toBe(800_000)
    expect(state.results[0].maxTermYears).toBe(20)
  })

  it('typing a mortgage sum fills the blank preset tracks at the preset proportions', () => {
    // Scenario 2 opens blank (one empty fixed track). Pick a preset, then type
    // a sum: the tracks must re-allocate at the preset's own proportions.
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[1]
    useComparisonStore.getState().loadScenarioPreset(scenario.id, 'basket4')
    useComparisonStore.getState().setScenarioMortgageSum(scenario.id, '1,000,000', null)
    const after = useComparisonStore.getState()
    const filled = after.scenarios[1].tracks
    // Recommended mix 40/34/26 of 1,000,000, hand-checked golden split.
    expect(filled.map((track) => track.amountText)).toEqual(['400,000', '340,000', '260,000'])
    // Types and default rates land too (prime takes the fallback live rate).
    expect(filled.map((track) => track.type)).toEqual(['prime', 'fixed', 'variableIndexed5y'])
    expect(filled.map((track) => track.rateText)).toEqual(['5.75', '4.5', '3'])
    expect(after.results[1].loanAmount).toBe(1_000_000)
    expect(Math.round(after.results[1].totals.firstPayment)).toBe(7_718)
  })

  it('typing a mortgage sum scales an existing hand-built mix proportionally', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[1]
    // A hand-built two-track mix (no property set): typing 120k into the
    // first track, then adding one - the calculator parity split funds the
    // new track with half of the largest (120k → 60k + 60k).
    useComparisonStore.getState().updateTrackAmount(scenario.id, scenario.tracks[0].id, '120,000', null)
    useComparisonStore.getState().addTrack(scenario.id)
    const state2 = useComparisonStore.getState()
    const second = state2.scenarios[1].tracks[1]
    useComparisonStore.getState().updateTrackAmount(state2.scenarios[1].id, second.id, '80,000', null)
    // Tracks now hold 60k + 80k; the sum field mirrors their total.
    expect(useComparisonStore.getState().scenarios[1].mortgageSumText).toBe('140,000')
    // Scale the same 3:4 proportions up to a 1,000,000 loan via the sum input.
    useComparisonStore.getState().setScenarioMortgageSum(state2.scenarios[1].id, '1,000,000', null)
    const after = useComparisonStore.getState()
    // 60/140 and 80/140 scale: 428,571 + 571,429 (last track absorbs rounding).
    expect(after.scenarios[1].tracks.map((track) => track.amountText)).toEqual([
      '428,571',
      '571,429',
    ])
    // The sum field keeps the typed text.
    expect(after.scenarios[1].mortgageSumText).toBe('1,000,000')
  })

  it('property value drives the sum field and locks the loan (calculator parity)', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[1]
    // Give scenario 2 the recommended preset, then set a property + capital.
    useComparisonStore.getState().loadScenarioPreset(scenario.id, 'basket4')
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    useComparisonStore.getState().setCapital('200,000', null)
    const after = useComparisonStore.getState()
    // Loan = 1,200,000 - 200,000 = 1,000,000, mirrored into the sum field.
    expect(after.scenarios[1].mortgageSumText).toBe('1,000,000')
    expect(after.scenarios[1].tracks.map((track) => track.amountText)).toEqual([
      '400,000',
      '340,000',
      '260,000',
    ])
    // Clearing the property restores loan + capital into the sum field.
    useComparisonStore.getState().setPropertyValue('', null)
    const cleared = useComparisonStore.getState()
    expect(cleared.scenarios[1].mortgageSumText).toBe('1,200,000')
    // Tracks keep their last allocation while the property is gone.
    expect(cleared.scenarios[1].tracks.map((track) => track.amountText)).toEqual([
      '400,000',
      '340,000',
      '260,000',
    ])
  })

  it('editing one track with a property set rebalances the others live', () => {
    // Property 1.2M, capital 200k pins scenario 1's loan at 1,000,000 (the
    // opening preset mix 400/340/260). Editing track 1 to 500k must pull the
    // others down proportionally (340:260 held) so the sum stays the loan.
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    useComparisonStore.getState().setCapital('200,000', null)
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    useComparisonStore
      .getState()
      .updateTrackAmount(scenario.id, scenario.tracks[0].id, '500,000', null)
    const after = useComparisonStore.getState()
    const amounts = after.scenarios[0].tracks.map((track) => parseAmountText(track.amountText))
    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    // The tracks always sum to the pinned loan after live rebalancing.
    expect(total).toBe(1_000_000)
    expect(amounts[0]).toBe(500_000)
    // Others keep their proportions of the remaining 500k: 340:260 → 212.5+...
    expect(amounts[1]).toBe(Math.round((500_000 * 340_000) / 600_000))
    expect(amounts[2]).toBe(1_000_000 - 500_000 - amounts[1])
  })

  it('track amount blur snaps the tracks back to the pinned loan', () => {
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    useComparisonStore.getState().setCapital('200,000', null)
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    // Overshoot the loan with one track edit (others may sit at 0 mid-edit).
    useComparisonStore
      .getState()
      .updateTrackAmount(scenario.id, scenario.tracks[0].id, '2,000,000', null)
    useComparisonStore.getState().commitTrackAmountBlur(scenario.id, scenario.tracks[0].id)
    const after = useComparisonStore.getState()
    const amounts = after.scenarios[0].tracks.map((track) => parseAmountText(track.amountText))
    const total = amounts.reduce((sum, amount) => sum + amount, 0)
    // The blur snap scales the (kept) proportions back to the 1,000,000 loan.
    expect(total).toBe(1_000_000)
  })

  it('loadScenarioPreset on a priced scenario re-allocates at the current loan', () => {
    const store = useComparisonStore.getState()
    const scenario = store.scenarios[0]
    // Scenario 1 opens with basket4 at 1,000,000; switching to basket2 gives
    // the fixed/prime halves at the same total.
    useComparisonStore.getState().loadScenarioPreset(scenario.id, 'basket2')
    const after = useComparisonStore.getState()
    expect(after.scenarios[0].tracks.map((track) => track.type)).toEqual(['fixed', 'prime'])
    expect(after.scenarios[0].tracks.map((track) => track.amountText)).toEqual(['500,000', '500,000'])
    expect(after.scenarios[0].activePreset).toBe('basket2')
    expect(after.results[0].loanAmount).toBe(1_000_000)
  })

  it('shared expense rows reprice the PTI check and the upfront total', () => {
    // Scenario 1's opening mix: first payment 7,718.13. Income 20,000 →
    // over the 33% ceiling; minIncome ceil(7718.13/0.33/500)·500 = 23,500.
    useComparisonStore.getState().setIncome('20,000', null)
    let pti = useComparisonStore.getState().results[0].pti
    expect(pti).not.toBeNull()
    expect(pti!.minIncome).toBe(23_500)

    // A ₪1,000/month expense lifts the obligation to 8,718.13 → 26,500.
    useComparisonStore.getState().addSharedExpense()
    const rows = useComparisonStore.getState().shared.otherExpenses
    expect(rows).toHaveLength(2)
    useComparisonStore.getState().updateSharedExpenseMonthly(rows[1].id, '1,000', null)
    pti = useComparisonStore.getState().results[0].pti
    expect(pti!.payment).toBeCloseTo(8_718.13, 2)
    expect(pti!.minIncome).toBe(26_500)
    // The boundary itself: at the reported minimum the warning clears.
    useComparisonStore.getState().setIncome('26,500', null)
    expect(useComparisonStore.getState().results[0].pti).toBeNull()

    // The one-time amount joins the upfront cash: property 1.2M, capital
    // 200k → suggested 300,000 + fees 35,400, +5,000 one-time.
    useComparisonStore.getState().setIncome('', null)
    useComparisonStore.getState().updateSharedExpenseLabel(rows[1].id, 'מס ביטוח לאומי')
    useComparisonStore.getState().updateSharedExpenseOneTime(rows[1].id, '5,000', null)
    useComparisonStore.getState().setPropertyValue('1,200,000', null)
    useComparisonStore.getState().setCapital('200,000', null)
    expect(useComparisonStore.getState().shared.otherExpenses[1].label).toBe('מס ביטוח לאומי')
    expect(useComparisonStore.getState().results[0].upfrontTotal).toBe(300_000 + 28_320 + 7_080 + 5_000)

    // Removing the row reprices everything back down.
    useComparisonStore.getState().removeSharedExpense(rows[1].id)
    const cleared = useComparisonStore.getState()
    expect(cleared.shared.otherExpenses).toHaveLength(1)
    expect(cleared.results[0].upfrontTotal).toBe(300_000 + 28_320 + 7_080)
  })

  it('caps shared expense rows at MAX_OTHER_EXPENSES (3)', () => {
    // Opens with one blank row (calculator parity: the calculator opens with
    // one as well).
    expect(useComparisonStore.getState().shared.otherExpenses).toHaveLength(1)
    useComparisonStore.getState().addSharedExpense()
    useComparisonStore.getState().addSharedExpense()
    expect(useComparisonStore.getState().shared.otherExpenses).toHaveLength(3)
    useComparisonStore.getState().addSharedExpense()
    expect(useComparisonStore.getState().shared.otherExpenses).toHaveLength(3)
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
      mortgageSumText: '800,000',
      activePreset: null,
      tracks: [track({ type: 'prime', amountText: '800,000', rateText: '5.75' })],
    })
    const state = useComparisonStore.getState()
    expect(state.results[0].error).toBe('variableCap')
    expect(state.results[0].totals.firstPayment).toBe(0)
  })
})
