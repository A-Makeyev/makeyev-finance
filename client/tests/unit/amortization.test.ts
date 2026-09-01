import { describe, expect, it } from 'vitest'
import {
  allocatePreset,
  assessDti,
  assessCapital,
  assessLtv,
  autoFixVariableMix,
  averageInterestRate,
  averagePaybackRatio,
  buildTrackScheduleRows,
  calculateWeightedAvgInterestRate,
  combineSchedules,
  computePurchaseTax,
  computeTrackResult,
  deriveLoanAmount,
  distributeEqually,
  effectiveAnnualRatePercent,
  estimateClosingCosts,
  first5yInterestShare,
  firstPaymentWithRateBump,
  paymentPer100k,
  redistributeTrackAmounts,
  scaleTrackAmounts,
  splitLargestForNewTrack,
  sumTotals,
  suggestedCapital,
  suggestedMinimumIncome,
  variableShareExceeded,
} from '@/lib/amortization'

const round2 = (value: number) => Math.round(value * 100) / 100

describe('computeTrackResult - Spitzer', () => {
  it('computes the classic annuity payment (P=100k, 10%/yr, 12mo)', () => {
    const result = computeTrackResult({
      principal: 100_000,
      years: 1,
      annualRatePercent: 10,
      type: 'fixed',
      method: 'spitzer',
    })
    expect(result).not.toBeNull()
    // Annuity: P·r/(1-(1+r)^-n); r=0.10/12, n=12 → 8791.59
    expect(round2(result!.firstPayment)).toBeCloseTo(8791.59, 1)
    expect(result!.yearlyRows).toHaveLength(1)
    expect(result!.yearlyRows[0].year).toBe(1)
    // Closing balance must reach exactly 0 (never negative).
    expect(result!.yearlyRows[0].closing).toBeCloseTo(0, 6)
    expect(round2(result!.totalPaid)).toBeCloseTo(8791.5917 * 12, 0)
    expect(round2(result!.highestPayment)).toBe(round2(result!.firstPayment))
  })

  it('uses the balance/remaining branch at a zero rate', () => {
    const result = computeTrackResult({
      principal: 120_000,
      years: 1,
      annualRatePercent: 0,
      type: 'fixed',
      method: 'spitzer',
    })
    expect(result!.firstPayment).toBe(10_000)
    expect(result!.totalInterest).toBe(0)
    expect(result!.totalPaid).toBeCloseTo(120_000, 6)
  })

  it('produces constant payments across a 30y term', () => {
    const result = computeTrackResult({
      principal: 1_000_000,
      years: 30,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
    })
    expect(result!.yearlyRows).toHaveLength(30)
    const first = result!.firstPayment
    result!.yearlyRows.forEach((row) => {
      expect(row.closing).toBeGreaterThanOrEqual(0)
    })
    // Final row closes the loan.
    expect(result!.yearlyRows[29].closing).toBeLessThan(1)
    expect(first).toBeGreaterThan(0)
    // Sum of yearly principal equals principal.
    expect(result!.yearlyRows.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(
      1_000_000,
      4,
    )
  })
})

describe('computeTrackResult - equal principal (קרן שווה)', () => {
  it('declining payments with exact principal split', () => {
    const result = computeTrackResult({
      principal: 120_000,
      years: 1,
      annualRatePercent: 12,
      type: 'fixed',
      method: 'equalPrincipal',
    })
    expect(result!.firstPayment).toBeCloseTo(11_200, 6) // 10000 + 1200
    expect(result!.highestPayment).toBeCloseTo(11_200, 6)
    expect(result!.totalInterest).toBeCloseTo(7800, 6) // 1200+1100+…+100
    expect(result!.totalPaid).toBeCloseTo(127_800, 6)
    expect(result!.yearlyRows[0].principal).toBeCloseTo(120_000, 6)
    expect(result!.yearlyRows[0].closing).toBeCloseTo(0, 6)
  })
})

describe('computeTrackResult - CPI-indexed tracks', () => {
  it('inflates the balance month-over-month from month 2', () => {
    const inflation = 0.12
    const factor = Math.pow(1 + inflation, 1 / 12)
    const result = computeTrackResult({
      principal: 100_000,
      years: 1,
      annualRatePercent: 0,
      type: 'fixedIndexed',
      method: 'equalPrincipal',
      annualInflation: inflation,
    })
    // First payment: un-inflated principal share, zero interest.
    expect(result!.firstPayment).toBeCloseTo(100_000 / 12, 6)
    // Second payment carries one inflation factor.
    // Exact total: sum over months of P·f^(m-1)/12
    let exact = 0
    for (let month = 1; month <= 12; month++) exact += (100_000 * Math.pow(factor, month - 1)) / 12
    expect(result!.totalPaid).toBeCloseTo(exact, 6)
    // Indexed balance can exceed nominal principal due to linkage.
    expect(result!.totalPaid).toBeGreaterThan(100_000)
  })

  it('falls back to 2% inflation when none provided', () => {
    const withFallback = computeTrackResult({
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
    })
    const explicit = computeTrackResult({
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      annualInflation: 0.02,
    })
    expect(withFallback!.totalPaid).toBe(explicit!.totalPaid)
    // And real CPI data changes the outcome (the live-data integration relies on this).
    const liveCpi = computeTrackResult({
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      annualInflation: 0.035,
    })
    expect(liveCpi!.totalPaid).not.toBe(withFallback!.totalPaid)
  })
})

describe('validation gate', () => {
  const base = {
    years: 10,
    annualRatePercent: 4,
    type: 'fixed',
    method: 'spitzer',
  } as const

  it.each([
    [{ ...base, principal: 0 }],
    [{ ...base, principal: -5 }],
    [{ ...base, principal: 1000, years: 0 }],
    [{ ...base, principal: 1000, years: 31 }],
    [{ ...base, principal: 1000, annualRatePercent: -0.1 }],
  ])('rejects %j', (input) => {
    expect(computeTrackResult(input)).toBeNull()
  })
})

describe('variable-rate ⅔ cap', () => {
  it('honours the +0.0001 tolerance like the source', () => {
    // 200k/300k = 0.666666… ≤ 2/3 + ε → allowed
    expect(variableShareExceeded(300_000, 200_000)).toBe(false)
    expect(variableShareExceeded(300_000, 210_000)).toBe(true)
  })
})

describe('autoFixVariableMix', () => {
  it('rebalances proportional-to-cap with last-track remainders', () => {
    const result = autoFixVariableMix([
      { amount: 60_000, isVariable: true },
      { amount: 30_000, isVariable: true },
      { amount: 30_000, isVariable: false },
    ])
    expect(result.convertedToFixedIndex).toBeNull()
    // targetVar = floor(120000·2/3) = 80000; var split ∝ original (last absorbs)
    expect(result.amounts[0]).toBe(53_333)
    expect(result.amounts[1]).toBe(26_667)
    expect(result.amounts[2]).toBe(40_000)
    expect(result.amounts.reduce((a, b) => a + b, 0)).toBe(120_000)
  })

  it('converts the last variable track when everything is variable', () => {
    const result = autoFixVariableMix([
      { amount: 40_000, isVariable: true },
      { amount: 40_000, isVariable: true },
      { amount: 40_000, isVariable: true },
    ])
    expect(result.convertedToFixedIndex).toBe(2)
    // After conversion the mix is within limits → amounts unchanged.
    expect(result.amounts).toEqual([40_000, 40_000, 40_000])
  })

  it('leaves compliant mixes untouched', () => {
    const result = autoFixVariableMix([
      { amount: 100_000, isVariable: false },
      { amount: 100_000, isVariable: true },
    ])
    expect(result.changed).toBe(false)
    expect(result.amounts).toEqual([100_000, 100_000])
  })
})

describe('loan derivation quirk (property OR starting, never both)', () => {
  it('prefers property value when present', () => {
    expect(deriveLoanAmount(900_000, 1_000_000, 100_000)).toBe(800_000)
  })
  it('falls back to starting amount otherwise', () => {
    expect(deriveLoanAmount(0, 1_000_000, 250_000)).toBe(750_000)
  })
  it('floors at zero', () => {
    expect(deriveLoanAmount(100_000, 0, 500_000)).toBe(0)
  })
})

describe('scaleTrackAmounts', () => {
  it('scales current amounts proportionally, last track absorbing rounding', () => {
    const result = scaleTrackAmounts([333, 333], [null, null], 1_000)
    expect(result).toEqual({ amounts: [500, 500], shareMemory: [null, null] })
  })

  it('stashes positive amounts into memory when the loan disappears', () => {
    const result = scaleTrackAmounts([300, 700], [null, null], 0)
    expect(result!.amounts).toEqual([0, 0])
    expect(result!.shareMemory).toEqual([300, 700])
  })

  it('restores from remembered shares', () => {
    const result = scaleTrackAmounts([0, 0], [300, 700], 1_000)
    expect(result!.amounts).toEqual([300, 700])
  })

  it('returns null when there is nothing to scale from', () => {
    expect(scaleTrackAmounts([0, 0], [null, null], 1_000)).toBeNull()
  })

  it('keeps remembered shares when the loan is 0 and amounts are already zeroed', () => {
    // Typing a property value keystroke-by-keystroke drives the loan through
    // 0 repeatedly; the remembered share must survive so tracks can be
    // restored once the loan turns positive again.
    const first = scaleTrackAmounts([945_345], [null], 0)!
    expect(first.shareMemory).toEqual([945_345])
    const second = scaleTrackAmounts([0], first.shareMemory, 0)!
    expect(second.shareMemory).toEqual([945_345])
    const restored = scaleTrackAmounts([0], second.shareMemory, 1_179_909)!
    expect(restored.amounts).toEqual([1_179_909])
  })
})

describe('redistributeTrackAmounts', () => {
  it('fills the other tracks proportionally so the sum equals the loan', () => {
    // Loan 1,544,000: editing track 1 to 386,000 leaves 1,158,000, split
    // 50/50 between two 772,000 tracks.
    expect(redistributeTrackAmounts(386_000, [772_000, 772_000], 1_544_000)).toEqual([
      579_000,
      579_000,
    ])
  })

  it('keeps the proportions of the others, last track absorbing rounding', () => {
    expect(redistributeTrackAmounts(400_000, [100_000, 300_000], 1_000_000)).toEqual([
      150_000,
      450_000,
    ])
    expect(redistributeTrackAmounts(1, [100_000, 100_000, 100_000], 1_000_003)).toEqual([
      333_334,
      333_334,
      333_334,
    ])
  })

  it('splits equally when the other tracks are all 0', () => {
    expect(redistributeTrackAmounts(500_000, [0, 0], 1_500_000)).toEqual([500_000, 500_000])
  })

  it('zeroes the others when the typed amount exceeds the loan', () => {
    expect(redistributeTrackAmounts(2_000_000, [772_000, 772_000], 1_544_000)).toEqual([0, 0])
  })

  it('returns null without other tracks or a loan', () => {
    expect(redistributeTrackAmounts(100_000, [], 1_000_000)).toBeNull()
    expect(redistributeTrackAmounts(100_000, [100_000], 0)).toBeNull()
  })
})

describe('splitLargestForNewTrack', () => {
  it('splits the largest amount in half for the new track, total unchanged', () => {
    // 772,000 / 2 = 386,000 exactly - the screenshot scenario. Ties split
    // from the first largest track.
    expect(splitLargestForNewTrack([772_000, 772_000])).toEqual([386_000, 772_000, 386_000])
  })

  it('splits an odd amount without losing or creating shekels', () => {
    const result = splitLargestForNewTrack([500, 772_001])!
    expect(result[2] + result[1]).toBe(772_001)
    expect(result[0]).toBe(500)
    expect(result.reduce((sum, amount) => sum + amount, 0)).toBe(772_501)
  })

  it('returns null when every existing amount is 0 (nothing to split)', () => {
    expect(splitLargestForNewTrack([0, 0])).toBeNull()
    expect(splitLargestForNewTrack([])).toBeNull()
  })
})

describe('distributeEqually', () => {
  it('floor-splits with the remainder on the last track', () => {
    expect(distributeEqually(1_000, 3)).toEqual([333, 333, 334])
  })
  it('is empty without a loan or tracks', () => {
    expect(distributeEqually(0, 3)).toEqual([])
    expect(distributeEqually(1_000, 0)).toEqual([])
  })
})

describe('preset allocation', () => {
  it('allocates shares and gives the remainder to the last preset track', () => {
    const allocated = allocatePreset('basket4', 1_000_000, null)
    expect(allocated).toHaveLength(3)
    expect(allocated[0]).toMatchObject({ type: 'prime', amount: 400_000 })
    expect(allocated[1]).toMatchObject({ type: 'fixed', amount: 340_000 })
    expect(allocated[2].amount).toBe(260_000)
    expect(allocated.reduce((sum, entry) => sum + entry.amount, 0)).toBe(1_000_000)
  })

  it('overrides prime preset rates with the live BOI rate', () => {
    const allocated = allocatePreset('basket2', 300_000, 6.05)
    expect(allocated[1].type).toBe('prime')
    expect(allocated[1].rate).toBe(6.05)
    expect(allocated[0].rate).toBe(4.5)
  })
})

describe('LTV assessment', () => {
  it('flags financing above the purpose limit and computes the max loan', () => {
    const warning = assessLtv(600_001, 1_000_000, 0, 'investment')
    expect(warning).not.toBeNull()
    expect(warning!.percentRounded).toBe(60)
    expect(warning!.percent).toBeCloseTo(60.0001, 2)
    expect(warning!.maxLoan).toBe(500_000)
  })

  it('respects the +0.01 tolerance and effective-value fallback', () => {
    expect(assessLtv(750_005, 1_000_000, 0, 'first')).toBeNull() // 75.0005 ≤ 75.01
    expect(assessLtv(750_200, 1_000_000, 0, 'first')).not.toBeNull()
    // No property value: effective value = loan + capital = 1M → 85% exceeds 75%.
    expect(assessLtv(850_000, 0, 150_000, 'first')).not.toBeNull()
  })

  it('skips entirely without property and capital', () => {
    expect(assessLtv(100_000, 0, 0, 'first')).toBeNull()
  })

  it('omits the warning for values too small to be a real home', () => {
    // Otherwise the ratio would show absurd percents like 6,666,667%.
    expect(assessLtv(1_000_000, 15, 0, 'first')).toBeNull()
    expect(assessLtv(600_000, 99_999, 0, 'investment')).toBeNull()
    expect(assessLtv(600_000, 100_000, 0, 'investment')).not.toBeNull()
  })
})

describe('capital note thresholds', () => {
  it('bad under required, good at required+15, neutral between', () => {
    expect(assessCapital(200_000, 1_000_000, 800_000, 'first')?.state).toBe('bad')
    expect(assessCapital(300_000, 1_000_000, 700_000, 'first')?.state).toBe('neutral')
    expect(assessCapital(400_000, 1_000_000, 600_000, 'first')?.state).toBe('good')
    expect(assessCapital(0, 1_000_000, 1_000_000, 'first')).toBeNull()
  })

  it('omits the note for values too small to be a real home', () => {
    // Otherwise the share shows absurd percents like 3333%.
    expect(assessCapital(500, 15, 0, 'first')).toBeNull()
    expect(assessCapital(40_000, 99_999, 0, 'first')).toBeNull()
    expect(assessCapital(40_000, 100_000, 0, 'first')).not.toBeNull()
  })
})

describe('suggestedCapital (required initial הון עצמי)', () => {
  it('is the purpose financing gap of the effective value', () => {
    // first = 75% finance → 25% of 1.5M = 375k.
    expect(suggestedCapital(1_500_000, 0, 0, 'first')).toBe(375_000)
    // upgrade = 70% → 30%.
    expect(suggestedCapital(1_000_000, 0, 0, 'upgrade')).toBe(300_000)
    // investment = 50% → 50%.
    expect(suggestedCapital(1_000_000, 0, 0, 'investment')).toBe(500_000)
  })

  it('uses loan + capital when property is unknown and rounds up to 500', () => {
    // effective = loan + capital.
    expect(suggestedCapital(0, 800_000, 200_000, 'first')).toBe(250_000)
    // Non-multiple of 500 rounds UP.
    expect(suggestedCapital(1_500_001, 0, 0, 'first')).toBe(375_500)
    expect(suggestedCapital(0, 0, 0, 'first')).toBeNull()
    // No value basis → no suggestion; modest values still hint (rounded to 500).
    expect(suggestedCapital(15, 0, 0, 'first')).toBe(500)
  })
})

describe('computePurchaseTax (מס רכישה progressive brackets)', () => {
  it('first home: 0% up to 1,978,745, then 3.5% / 5% / 8% / 10%', () => {
    expect(computePurchaseTax(1_500_000, 'first')).toBe(0)
    expect(computePurchaseTax(1_978_745, 'first')).toBe(0)
    expect(computePurchaseTax(2_000_000, 'first')).toBeCloseTo(0.035 * (2_000_000 - 1_978_745), 2)
    expect(computePurchaseTax(3_000_000, 'first')).toBeCloseTo(
      0.035 * (2_347_040 - 1_978_745) + 0.05 * (3_000_000 - 2_347_040),
      2,
    )
    expect(computePurchaseTax(7_000_000, 'first')).toBeCloseTo(
      0.035 * (2_347_040 - 1_978_745) +
      0.05 * (6_055_070 - 2_347_040) +
      0.08 * (7_000_000 - 6_055_070),
      2,
    )
    expect(computePurchaseTax(25_000_000, 'first')).toBeCloseTo(
      0.035 * (2_347_040 - 1_978_745) +
      0.05 * (6_055_070 - 2_347_040) +
      0.08 * (20_183_565 - 6_055_070) +
      0.1 * (25_000_000 - 20_183_565),
      2,
    )
  })

  it('second home: 8% from the first shekel, 10% above 6,055,070', () => {
    expect(computePurchaseTax(1_500_000, 'investment')).toBe(120_000)
    expect(computePurchaseTax(6_055_070, 'investment')).toBeCloseTo(0.08 * 6_055_070, 2)
    expect(computePurchaseTax(7_000_000, 'investment')).toBeCloseTo(
      0.08 * 6_055_070 + 0.1 * (7_000_000 - 6_055_070),
      2,
    )
  })

  it('upgrade (משפר דיור) is taxed like a first home', () => {
    expect(computePurchaseTax(2_000_000, 'upgrade')).toBe(computePurchaseTax(2_000_000, 'first'))
    expect(computePurchaseTax(9_000_000, 'upgrade')).toBe(computePurchaseTax(9_000_000, 'first'))
  })
})

describe('estimateClosingCosts (side costs + purchase tax)', () => {
  it('first home below the exemption: side costs only, no purchase tax', () => {
    const est = estimateClosingCosts(1_500_000, 0, 0, 'first')!
    expect(est.sideCosts).toBe(22_500)
    expect(est.purchaseTax).toBe(0)
    expect(est.total).toBe(22_500)
    expect(est.sideCostsPercent).toBe(1.5)
    expect(est.purchaseTaxPercent).toBe(0)
    // Uses loan + capital when property is unknown.
    expect(estimateClosingCosts(0, 800_000, 200_000, 'first')!.sideCosts).toBe(15_000)
    expect(estimateClosingCosts(0, 0, 0, 'first')).toBeNull()
  })

  it('first home above the exemption pays the progressive brackets', () => {
    const est = estimateClosingCosts(3_000_000, 0, 0, 'first')!
    const expected = 0.035 * (2_347_040 - 1_978_745) + 0.05 * (3_000_000 - 2_347_040)
    expect(est.purchaseTax).toBe(Math.ceil(expected / 500) * 500)
    expect(est.total).toBe(est.sideCosts + est.purchaseTax)
  })

  it('home improver is taxed like a first home', () => {
    expect(estimateClosingCosts(1_500_000, 0, 0, 'upgrade')!.purchaseTax).toBe(0)
  })

  it('second home: 8% from the first shekel, 10% above 6,055,070', () => {
    const est = estimateClosingCosts(1_500_000, 0, 0, 'investment')!
    expect(est.sideCosts).toBe(22_500)
    expect(est.purchaseTax).toBe(120_000)
    expect(est.total).toBe(142_500)
    expect(est.purchaseTaxPercent).toBeCloseTo(8, 1)
    const big = estimateClosingCosts(7_000_000, 0, 0, 'investment')!
    const expected = 0.08 * 6_055_070 + 0.1 * (7_000_000 - 6_055_070)
    expect(big.purchaseTax).toBe(Math.ceil(expected / 500) * 500)
    // Effective rate uses the unrounded tax - no distortion from the rounding.
    expect(big.purchaseTaxPercent).toBeCloseTo((expected / 7_000_000) * 100, 1)
  })

  it('omits the estimate for values too small to be a real home', () => {
    expect(estimateClosingCosts(15, 0, 0, 'investment')).toBeNull()
    expect(estimateClosingCosts(99_999, 0, 0, 'first')).toBeNull()
    expect(estimateClosingCosts(100_000, 0, 0, 'investment')!.purchaseTax).toBe(8_000)
    expect(estimateClosingCosts(0, 50_000, 20_000, 'first')).toBeNull()
  })
})

describe('DTI assessment', () => {
  it('suggests rounded minimum income and capped shortfall', () => {
    expect(suggestedMinimumIncome(5_000)).toBe(10_000)
    // Non-round payment must round UP to the 500-step (legacy formula).
    expect(suggestedMinimumIncome(5_067)).toBe(10_500)
    const warning = assessDti(5_000, 9_000)!
    expect(warning.minIncome).toBe(10_000)
    expect(warning.shortfallPercent).toBe(10)
  })

  it('passes at exactly 50% and ignores missing income', () => {
    expect(assessDti(5_000, 10_000)).toBeNull()
    expect(assessDti(5_000, 0)).toBeNull()
  })

  it('caps the shortfall display at 99%', () => {
    expect(assessDti(10_000, 1)!.shortfallPercent).toBe(99)
  })
})

describe('paybackRatio and aggregate rate/payout helpers', () => {
  it('exposes the guide-verified payback ratio for a Prime-style track', () => {
    // 105,000 / 10yr / 1.2% → total ≈ 111,478.40, ratio ≈ 1.0617 (guide fixture).
    const result = computeTrackResult({
      principal: 105_000,
      years: 10,
      annualRatePercent: 1.2,
      type: 'fixed',
      method: 'spitzer',
    })!
    expect(result!.totalPaid).toBeCloseTo(111_478.4, 0)
    expect(result!.paybackRatio).toBeCloseTo(1.0617, 3)
    // Self-consistency: ratio is total paid ÷ nominal principal.
    expect(result!.paybackRatio).toBeCloseTo(result!.totalPaid / result!.principal, 10)
  })

  it('carries the annual rate through to the result', () => {
    const result = computeTrackResult({
      principal: 100_000,
      years: 10,
      annualRatePercent: 3.25,
      type: 'fixedIndexed',
      method: 'spitzer',
    })!
    expect(result!.annualRatePercent).toBe(3.25)
  })

  it('averages rates unweighted and weighted by loan amount', () => {
    const small = computeTrackResult({
      principal: 10_000,
      years: 10,
      annualRatePercent: 1,
      type: 'fixed',
      method: 'spitzer',
    })!
    const large = computeTrackResult({
      principal: 300_000,
      years: 10,
      annualRatePercent: 3,
      type: 'fixed',
      method: 'spitzer',
    })!
    // Unweighted: (1 + 3) / 2 = 2% - misrepresents the blended cost.
    expect(averageInterestRate([small, large])).toBeCloseTo(2, 10)
    // Weighted: (10k·1 + 300k·3) / 310k = 2.94%
    expect(calculateWeightedAvgInterestRate([small, large])).toBeCloseTo(910 / 310, 10)
  })

  it('averages payback ratios across entered tracks', () => {
    const a = computeTrackResult({
      principal: 105_000,
      years: 10,
      annualRatePercent: 1.2,
      type: 'fixed',
      method: 'spitzer',
    })!
    const b = computeTrackResult({
      principal: 146_000,
      years: 10,
      annualRatePercent: 2.7,
      type: 'fixed',
      method: 'spitzer',
    })!
    const expected = (a.paybackRatio + b.paybackRatio) / 2
    expect(averagePaybackRatio([a, b])).toBeCloseTo(expected, 10)
    // Guide fixture: 105k/10yr/1.2% → 1.0617 and 146k/10yr/2.7% → 1.1422.
    expect(a.paybackRatio).toBeCloseTo(1.0617, 2)
    expect(b.paybackRatio).toBeCloseTo(1.1422, 2)
  })

  it('returns 0 for an empty set', () => {
    expect(averageInterestRate([])).toBe(0)
    expect(calculateWeightedAvgInterestRate([])).toBe(0)
    expect(averagePaybackRatio([])).toBe(0)
  })
})

describe('derived results-card metrics (replace total-loan card)', () => {
  const a = computeTrackResult({
    principal: 600_000,
    years: 20,
    annualRatePercent: 4.5,
    type: 'fixed',
    method: 'spitzer',
  })!
  const b = computeTrackResult({
    principal: 400_000,
    years: 20,
    annualRatePercent: 4.5,
    type: 'fixed',
    method: 'spitzer',
  })!
  const rows = combineSchedules([a, b])
  const totals = sumTotals([a, b])
  const totalLoan = 1_000_000

  it('balance after 5 years comes from the combined schedule', () => {
    const row5 = rows.find((row) => row.year === 5)
    expect(row5).toBeDefined()
    expect(row5!.closing).toBeGreaterThan(0)
    expect(row5!.closing).toBeLessThan(totalLoan)
    // Sanity: debt shrinks monotonically year over year.
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].closing).toBeLessThanOrEqual(rows[index - 1].closing + 1)
    }
  })

  it('average monthly payment sits between first and highest payment', () => {
    const avgMonthly = totals.totalPaid / (20 * 12)
    expect(avgMonthly).toBeGreaterThan(0)
    expect(avgMonthly).toBeGreaterThanOrEqual(totals.firstPayment - 1)
    expect(avgMonthly).toBeLessThanOrEqual(totals.highestPayment + 1)
  })

  it('first-payment interest share is the dominant annuity component', () => {
    const firstInterest = rows[0].interest / 12
    const share = (firstInterest / totals.firstPayment) * 100
    expect(share).toBeGreaterThan(50)
    expect(share).toBeLessThan(100)
  })

  it('overpay percent matches the payback identity', () => {
    const overpay = (totals.totalInterest / totalLoan) * 100
    expect(overpay).toBeCloseTo((totals.totalPaid / totalLoan - 1) * 100, 6)
    expect(overpay).toBeGreaterThan(0)
  })
})

describe('effectiveAnnualRatePercent', () => {
  it('is ≥ nominal and ≈0.09pp higher at 4.5% monthly compounding', () => {
    const eff = effectiveAnnualRatePercent(4.5)
    expect(eff).toBeGreaterThan(4.5)
    expect(eff).toBeCloseTo(4.5938, 2)
  })

  it('returns 0 for zero, negatives and non-finite', () => {
    expect(effectiveAnnualRatePercent(0)).toBe(0)
    expect(effectiveAnnualRatePercent(-1)).toBe(0)
    expect(effectiveAnnualRatePercent(Number.NaN)).toBe(0)
  })
})

describe('buildTrackScheduleRows (per-track schedule with payback ratio)', () => {
  it('stamps the flat lifetime payback ratio on every row', () => {
    const result = computeTrackResult({
      principal: 105_000,
      years: 10,
      annualRatePercent: 1.2,
      type: 'fixed',
      method: 'spitzer',
    })!
    const rows = buildTrackScheduleRows(result)
    expect(rows).toHaveLength(10)
    // Every row carries the same lifetime ratio - first and last identical.
    expect(rows.every((row) => row.paybackRatio === result.paybackRatio)).toBe(true)
    expect(rows[0].paybackRatio).toBeCloseTo(result.paybackRatio, 10)
    expect(rows[9].paybackRatio).toBeCloseTo(result.paybackRatio, 10)
    // Each row's principal + interest + balance mirror the source yearlyRows.
    expect(rows[0].balance).toBeCloseTo(result.yearlyRows[0].closing, 6)
    expect(rows[4].principal).toBeCloseTo(result.yearlyRows[4].principal, 6)
    expect(rows[4].interest).toBeCloseTo(result.yearlyRows[4].interest, 6)
  })
})

describe('combined schedule', () => {
  it('merges per-track years, filtering exhausted tracks', () => {
    const long = computeTrackResult({
      principal: 600_000,
      years: 2,
      annualRatePercent: 4,
      type: 'fixed',
      method: 'spitzer',
    })!
    const short = computeTrackResult({
      principal: 400_000,
      years: 1,
      annualRatePercent: 4,
      type: 'fixed',
      method: 'spitzer',
    })!
    const rows = combineSchedules([long, short])
    expect(rows).toHaveLength(2)
    expect(rows[0].opening).toBeCloseTo(1_000_000, 6)
    // Year 2 only the long track contributes.
    expect(rows[1].opening).toBeCloseTo(long.yearlyRows[0].closing, 6)
  })

  it('derived metrics: balance after 5y, avg payment, interest share, overpay %', () => {
    const a = computeTrackResult({
      principal: 600_000,
      years: 20,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
    })!
    const b = computeTrackResult({
      principal: 400_000,
      years: 20,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
    })!
    const rows = combineSchedules([a, b])
    const totals = sumTotals([a, b])
    const totalLoan = 1_000_000

    // Balance after 5 years comes straight from the combined schedule.
    const row5 = rows.find((row) => row.year === 5)
    expect(row5).toBeDefined()
    expect(row5!.closing).toBeGreaterThan(0)
    expect(row5!.closing).toBeLessThan(totalLoan)

    // Average monthly payment = totalPaid / (years * 12).
    const avgMonthly = totals.totalPaid / (20 * 12)
    expect(avgMonthly).toBeGreaterThan(0)
    // Between first and highest (Spitzer flat: equal to first payment).
    expect(avgMonthly).toBeGreaterThanOrEqual(totals.firstPayment - 1)
    expect(avgMonthly).toBeLessThanOrEqual(totals.highestPayment + 1)

    // Interest share of the first payment: for an annuity at 4.5%/20y it is
    // high (most of the early payment is interest) but below 100%.
    const firstInterest = rows[0].interest / 12
    const share = (firstInterest / totals.firstPayment) * 100
    expect(share).toBeGreaterThan(50)
    expect(share).toBeLessThan(100)

    // Overpay percent: total interest / loan * 100, and must match the
    // payback-ratio identity (totalPaid = loan + interest).
    const overpay = (totals.totalInterest / totalLoan) * 100
    expect(overpay).toBeCloseTo((totals.totalPaid / totalLoan - 1) * 100, 6)
    expect(overpay).toBeGreaterThan(0)
  })
})

describe('firstPaymentWithRateBump', () => {
  const prime1M = computeTrackResult({
    principal: 1_000_000,
    years: 30,
    annualRatePercent: 5.75,
    type: 'prime',
    method: 'spitzer',
  })!
  const fixed500k = computeTrackResult({
    principal: 500_000,
    years: 30,
    annualRatePercent: 4.5,
    type: 'fixed',
    method: 'spitzer',
  })!

  it('leaves a fixed-only mix unchanged', () => {
    expect(firstPaymentWithRateBump([fixed500k], 1)).toBeCloseTo(fixed500k.firstPayment, 6)
  })

  it('reprices a prime track at rate +1 (golden: 5.75% → 6.75%)', () => {
    // P·r/(1-(1+r)^-360) at 6.75%/yr on 1M → 6485.98
    expect(firstPaymentWithRateBump([prime1M], 1)).toBeCloseTo(6485.98, 1)
    expect(firstPaymentWithRateBump([prime1M], 1)).toBeGreaterThan(prime1M.firstPayment)
  })

  it('reprices a prime track at rate −1 (golden: 5.75% → 4.75%)', () => {
    // P·r/(1-(1+r)^-360) at 4.75%/yr on 1M → 5216.47
    expect(firstPaymentWithRateBump([prime1M], -1)).toBeCloseTo(5216.47, 1)
    expect(firstPaymentWithRateBump([prime1M], -1)).toBeLessThan(prime1M.firstPayment)
  })

  it('a fixed track absorbs a negative bump untouched', () => {
    expect(firstPaymentWithRateBump([fixed500k], -1)).toBeCloseTo(fixed500k.firstPayment, 6)
  })

  it('bumps only the variable track in a mixed portfolio', () => {
    // 5835.73 (prime @ 6.75%) + 2533.43 (fixed @ 4.5% untouched)
    expect(firstPaymentWithRateBump([prime1M, fixed500k], 1)).toBeCloseTo(6485.98 + 2533.43, 1)
  })

  it('returns 0 for an empty mix', () => {
    expect(firstPaymentWithRateBump([], 1)).toBe(0)
  })
})

describe('first5yInterestShare and paymentPer100k', () => {
  it('aggregates the first five years of interest share across tracks', () => {
    const long = computeTrackResult({
      principal: 600_000,
      years: 10,
      annualRatePercent: 4,
      type: 'fixed',
      method: 'spitzer',
    })!
    const short = computeTrackResult({
      principal: 400_000,
      years: 3,
      annualRatePercent: 4,
      type: 'fixed',
      method: 'spitzer',
    })!
    // Manual aggregate over both schedules' first five years.
    let interest = 0
    let paid = 0
    for (const result of [long, short]) {
      for (const row of result.yearlyRows) {
        if (row.year > 5) break
        interest += row.interest
        paid += row.paid
      }
    }
    expect(first5yInterestShare([long, short])).toBeCloseTo((interest / paid) * 100, 6)
    // Annuity: interest-heavy but a 10y term amortizes fast, so the 5-year
    // share sits well under half (measured ≈26% at 4%/10y).
    expect(first5yInterestShare([long])).toBeGreaterThan(20)
    expect(first5yInterestShare([long])).toBeLessThan(100)
  })

  it('returns 0 interest share with no rows', () => {
    expect(first5yInterestShare([])).toBe(0)
  })

  it('normalizes the first payment per ₪100k borrowed', () => {
    const track = computeTrackResult({
      principal: 250_000,
      years: 30,
      annualRatePercent: 5.75,
      type: 'fixed',
      method: 'spitzer',
    })!
    // 5835.73 payment on 250k → 2334.29 per ₪100k (2.5 units of 100k).
    expect(paymentPer100k([track])).toBeCloseTo((track.firstPayment / 250_000) * 100_000, 6)
    expect(paymentPer100k([])).toBe(0)
  })
})
