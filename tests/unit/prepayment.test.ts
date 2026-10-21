import { describe, expect, it } from 'vitest'
import { computeTrackResult, type AmortizationMethod, type TrackType } from '@/lib/amortization'
import {
  ageDiscountFor,
  feeAsAnnualRateAddition,
  cheapestPrepaymentOrder,
  deflatePayments,
  periodicFromEffectiveAnnual,
  periodicFromNominalAnnual,
  prepaymentExtras,
  prepaymentFee,
  presentValue,
  roundAgorot,
  streamToRateReset,
} from '@/lib/prepayment'

const PRINCIPAL = 400_000
const YEARS = 20
const RATE = 5

function schedule(
  overrides: {
    principal?: number
    years?: number
    rate?: number
    type?: TrackType
    method?: AmortizationMethod
    annualInflation?: number
  } = {},
) {
  const result = computeTrackResult({
    principal: overrides.principal ?? PRINCIPAL,
    years: overrides.years ?? YEARS,
    annualRatePercent: overrides.rate ?? RATE,
    type: overrides.type ?? 'fixed',
    method: overrides.method ?? 'spitzer',
    annualInflation: overrides.annualInflation,
  })
  if (!result) throw new Error('schedule fixture is invalid')
  return result
}

/** Remaining payments + balance at the end of month `paidMonths`. */
function atMonth(
  rows: { paid: number; closing: number }[],
  paidMonths: number,
): { payments: number[]; balance: number } {
  return {
    payments: rows.slice(paidMonths).map((row) => row.paid),
    balance: rows[paidMonths - 1].closing,
  }
}

/** Opening principal of each remaining month (the rate-addition basis). */
function openingBalances(
  rows: { closing: number }[],
  paidMonths: number,
  principal: number,
): number[] {
  const first = paidMonths === 0 ? principal : rows[paidMonths - 1].closing
  return [first, ...rows.slice(paidMonths, rows.length - 1).map((row) => row.closing)]
}

/** Annuity factor a(n, r) = (1 - (1 + r)^-n) / r. */
function annuityFactor(periods: number, periodicRate: number): number {
  if (periodicRate === 0) return periods
  return (1 - Math.pow(1 + periodicRate, -periods)) / periodicRate
}

describe('prepayment - rates and present value', () => {
  it('converts the nominal and effective annual quotes to monthly rates', () => {
    expect(periodicFromNominalAnnual(6)).toBeCloseTo(0.005, 12)
    expect(periodicFromEffectiveAnnual(6.1678)).toBeCloseTo(0.005, 6)
  })

  it('discounts a stream one period out', () => {
    expect(presentValue([100], 0.01)).toBeCloseTo(100 / 1.01, 10)
    expect(presentValue([100, 100], 0)).toBeCloseTo(200, 10)
    expect(presentValue([], 0.01)).toBe(0)
  })

  it('rounds to agorot', () => {
    expect(roundAgorot(1234.5678)).toBe(1234.57)
    expect(roundAgorot(Number.NaN)).toBe(0)
  })
})

describe('prepayment - the BOI worked example', () => {
  // BOI circular 2103 and the Banking Order's published example: ₪500,000,
  // 5% contractual vs 4% average, 120 months, payment ₪5,303.28. The circular
  // quotes nominal annual rates, so both go in as nominal (not effective).
  const principal = 500_000
  const months = 120
  const contractual = 5
  const market = 4
  const payment =
    (principal * periodicFromNominalAnnual(contractual)) /
    (1 - Math.pow(1 + periodicFromNominalAnnual(contractual), -months))
  const payments = Array.from({ length: months }, () => payment)
  const base = {
    payments,
    balance: principal,
    annualRatePercent: contractual,
    marketRatePercent: market,
    marketRateIsEffective: false,
    type: 'fixed' as const,
    indexed: false,
  }

  it('reproduces ₪23,805 before the age reduction', () => {
    const fee = prepaymentFee({ ...base, monthsSinceOrigination: 0 })
    expect(fee.marketPresentValue).toBeCloseTo(523_805.47, 2)
    expect(fee.contractualPresentValue).toBeCloseTo(principal, 2)
    expect(fee.grossFee).toBeCloseTo(23_805.47, 2)
    // The circular rounds the published figure to whole shekels.
    expect(fee.fee).toBe(23_805.47)
  })

  it('reproduces ₪16,664 after the 30% reduction at ten years', () => {
    const fee = prepaymentFee({ ...base, monthsSinceOrigination: 120 })
    expect(fee.ageDiscount).toBe(0.3)
    expect(fee.fee).toBe(16_663.83) // ₪16,664 in the circular
  })

  it('applies the 20% tier at three years', () => {
    const fee = prepaymentFee({ ...base, monthsSinceOrigination: 36 })
    expect(fee.ageDiscount).toBe(0.2)
    expect(fee.fee).toBe(19_044.38)
  })

  it('treats an effective quote and its nominal equivalent the same', () => {
    const effective = (Math.pow(1 + periodicFromNominalAnnual(market), 12) - 1) * 100
    const asEffective = prepaymentFee({
      ...base,
      marketRatePercent: effective,
      marketRateIsEffective: true,
      monthsSinceOrigination: 0,
    })
    expect(asEffective.fee).toBe(23_805.47)
  })

  it("applies section 3(4)'s origination-rate cap to the same payments", () => {
    // C = 4.5%, the paper's second example. The order discounts the SAME
    // contracted payments at C, which gives ~₪12,096. The Knesset explainer's
    // ₪11,819 recomputes the payment at 4.5% as well, so it is not the
    // statutory formula; do not pin that figure here.
    const fee = prepaymentFee({
      ...base,
      originationAverageRatePercent: 4.5,
      originationAverageRateIsEffective: false,
      monthsSinceOrigination: 0,
    })
    expect(fee.contractualPresentValue).toBeCloseTo(511_709.49, 2)
    expect(fee.grossFee).toBeCloseTo(12_095.98, 2)
    expect(fee.fee).toBe(12_095.98)
  })

  it('never lets the cap raise the fee above the contractual-rate one', () => {
    const fee = prepaymentFee({
      ...base,
      originationAverageRatePercent: 6,
      originationAverageRateIsEffective: false,
      monthsSinceOrigination: 0,
    })
    expect(fee.grossFee).toBeCloseTo(23_805.47, 2)
  })
})

describe('prepayment - the היוון formula', () => {
  it('the discounted remaining payments at the contractual rate ARE the balance', () => {
    const rows = schedule().monthlyRows
    for (const paidMonths of [12, 60, 120, 239]) {
      const { payments, balance } = atMonth(rows, paidMonths)
      expect(presentValue(payments, periodicFromNominalAnnual(RATE))).toBeCloseTo(balance, 6)
    }
  })

  it('matches the closed-form annuity difference, payment by payment', () => {
    const track = schedule()
    const paidMonths = 60
    const { payments, balance } = atMonth(track.monthlyRows, paidMonths)
    const market = 3.5

    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: market,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: paidMonths,
      onExitStation: false,
    })

    const periods = payments.length
    const marketMonthly = periodicFromEffectiveAnnual(market)
    const closedForm =
      track.firstPayment *
      (annuityFactor(periods, marketMonthly) - annuityFactor(periods, periodicFromNominalAnnual(RATE)))

    expect(fee.marketPresentValue - fee.contractualPresentValue).toBeCloseTo(closedForm, 6)
    expect(fee.contractualPresentValue).toBeCloseTo(balance, 6)
    // The age reduction (30% after 5 years) lands on top of that difference.
    expect(fee.ageDiscount).toBe(0.3)
    expect(fee.fee).toBe(roundAgorot(closedForm * 0.7))
    expect(fee.fee).toBeGreaterThan(0)
  })

  it('charges nothing when the market rate did not fall below the contractual one', () => {
    const rows = schedule().monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    // The market quote is an effective annual rate and the contractual one is
    // nominal, so an equal number put on each basis is NOT the same rate: the
    // equal-rate case has to be quoted nominal, and the rest are comfortably
    // above it.
    for (const [market, effective] of [
      [RATE, false],
      [RATE + 1, true],
      [RATE + 4, true],
    ] as const) {
      const fee = prepaymentFee({
        payments,
        balance,
        annualRatePercent: RATE,
        marketRatePercent: market,
        marketRateIsEffective: effective,
        type: 'fixed',
        indexed: false,
        monthsSinceOrigination: 60,
      })
      expect(fee.grossFee).toBe(0)
      expect(fee.fee).toBe(0)
    }
  })

  it('holds the same identity for a קרן שווה track', () => {
    const rows = schedule({ method: 'equalPrincipal' }).monthlyRows
    const { payments, balance } = atMonth(rows, 48)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: 48,
    })
    expect(fee.contractualPresentValue).toBeCloseTo(balance, 6)
    expect(fee.grossFee).toBeGreaterThan(0)
  })

  it('prices a five-year track to its next reset, not the whole loan', () => {
    const rows = schedule({ type: 'variable5y', years: 20, rate: RATE }).monthlyRows
    const paidMonths = 30 // 2.5 years in, so the next reset is 30 months away
    const untilReset = 30
    const { payments, balance } = atMonth(rows, paidMonths)
    const balanceAtReset = rows[paidMonths + untilReset - 1].closing
    const stream = streamToRateReset(payments, balanceAtReset, untilReset)

    expect(stream).toHaveLength(untilReset)
    // The reset balance is the last future payment, so the shorter stream still
    // discounts to today's balance (section 4(1)).
    expect(presentValue(stream, periodicFromNominalAnnual(RATE))).toBeCloseTo(balance, 6)

    const full = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: paidMonths,
    })
    const truncated = prepaymentFee({
      payments: stream,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: paidMonths,
    })
    // Discounting only to the reset is a much smaller exposure than pretending
    // the current rate runs for the remaining 17.5 years.
    expect(truncated.grossFee).toBeGreaterThan(0)
    expect(truncated.grossFee).toBeLessThan(full.grossFee * 0.5)
  })

  it('keeps the whole stream when the loan ends before the next reset', () => {
    const rows = schedule({ type: 'variable5y', years: 15, rate: RATE }).monthlyRows
    const { payments } = atMonth(rows, 150)
    const stream = streamToRateReset(payments, 123_456, 60)
    expect(stream).toEqual(payments)
  })

  it('compares an index-linked track on the real basis', () => {
    const track = schedule({ type: 'fixedIndexed', rate: 3, method: 'spitzer' })
    const rows = track.monthlyRows
    const paidMonths = 60
    const { payments, balance } = atMonth(rows, paidMonths)

    // The real (deflated) payments discounted at the real contractual rate give
    // today's balance - the identity the whole formula rests on.
    const real = deflatePayments(payments, 0.02, true)
    expect(presentValue(real, periodicFromNominalAnnual(3))).toBeCloseTo(balance, 6)

    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: 3,
      marketRatePercent: 2,
      type: 'fixedIndexed',
      indexed: true,
      monthsSinceOrigination: paidMonths,
    })
    // Default inflation must be the schedule's own 2%, not zero: otherwise the
    // nominal payments are left undeflated and PV overshoots the balance.
    expect(fee.contractualPresentValue).toBeCloseTo(balance, 6)
    expect(fee.grossFee).toBeGreaterThan(0)
    expect(fee.fee).toBe(roundAgorot(fee.grossFee * (1 - fee.ageDiscount)))
  })

  it('keeps the identity when the CPI assumption is not the default', () => {
    const track = schedule({ type: 'fixedIndexed', rate: 3, annualInflation: 0.05 })
    const rows = track.monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: 3,
      marketRatePercent: 2,
      type: 'fixedIndexed',
      indexed: true,
      annualInflation: 0.05,
      monthsSinceOrigination: 60,
    })
    expect(fee.contractualPresentValue).toBeCloseTo(balance, 6)
  })

  it('leaves non-indexed payments untouched when deflating', () => {
    const payments = [1000, 1000]
    expect(deflatePayments(payments, 0.03, false)).toEqual(payments)
    expect(deflatePayments(payments, 0.03, true)[1]).toBeLessThan(1000)
  })
})

describe('prepayment - legal reductions and exemptions', () => {
  it('applies the loan-age reduction tiers', () => {
    expect(ageDiscountFor(0)).toBe(0)
    expect(ageDiscountFor(35)).toBe(0)
    expect(ageDiscountFor(36)).toBe(0.2)
    expect(ageDiscountFor(59)).toBe(0.2)
    expect(ageDiscountFor(60)).toBe(0.3)
  })

  it('exempts prime-based loans', () => {
    const rows = schedule({ type: 'fixed' }).monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'prime',
      indexed: false,
      monthsSinceOrigination: 60,
    })
    expect(fee.exemptReason).toBe('prime')
    expect(fee.fee).toBe(0)
    expect(fee.grossFee).toBeGreaterThan(0)
  })

  it('exempts tracks whose rate resets annually or more often', () => {
    const rows = schedule({ type: 'fixed' }).monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    for (const type of ['variable', 'variableIndexed'] as const) {
      const fee = prepaymentFee({
        payments,
        balance,
        annualRatePercent: RATE,
        marketRatePercent: 3,
        type,
        indexed: type === 'variableIndexed',
        monthsSinceOrigination: 60,
      })
      expect(fee.exemptReason).toBe('frequentReset')
      expect(fee.fee).toBe(0)
      expect(fee.grossFee).toBeGreaterThan(0)
    }
  })

  it('waives the fee at an exit station (rate reset)', () => {
    const rows = schedule({ type: 'variable5y' }).monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'variable5y',
      indexed: false,
      monthsSinceOrigination: 60,
      onExitStation: true,
    })
    expect(fee.exemptReason).toBe('exitStation')
    expect(fee.fee).toBe(0)
  })

  it('does not waive a fixed track on an exit-station flag', () => {
    // A fixed-rate loan has no rate-reset date, so the flag must be ignored.
    const rows = schedule({ type: 'fixed' }).monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: 60,
      onExitStation: true,
    })
    expect(fee.exemptReason).toBeNull()
    expect(fee.fee).toBeGreaterThan(0)
  })

  it('charges nothing when there is nothing left to repay', () => {
    const fee = prepaymentFee({
      payments: [],
      balance: 0,
      annualRatePercent: RATE,
      marketRatePercent: 2,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: 240,
    })
    expect(fee.fee).toBe(0)
  })
})

describe('prepayment - rate addition', () => {
  it('re-expresses the fee as an annual rate addition', () => {
    const rows = schedule().monthlyRows
    const { payments, balance } = atMonth(rows, 60)
    const fee = prepaymentFee({
      payments,
      balance,
      annualRatePercent: RATE,
      marketRatePercent: 3.5,
      type: 'fixed',
      indexed: false,
      monthsSinceOrigination: 60,
    })
    const openings = openingBalances(rows, 60, PRINCIPAL)
    const addition = feeAsAnnualRateAddition({ openingBalances: openings, fee: fee.fee })

    // The addition's extra interest over the remaining term IS the fee. The
    // figure is rounded to 0.01pp for display, so allow that rounding's worth
    // (a hundredth of a point over a 15-year balance path) as slack.
    const extraInterest = openings.reduce((total, opening) => total + (addition / 100 / 12) * opening, 0)
    expect(addition).toBeCloseTo((1200 * fee.fee) / openings.reduce((total, o) => total + o, 0), 2)
    expect(Math.abs(extraInterest - fee.fee)).toBeLessThan(fee.fee * 0.01)
    // A few points of a percent, not tens: a fee is a spread, not a rate.
    expect(addition).toBeGreaterThan(0)
    expect(addition).toBeLessThan(2)
    expect(openings).toHaveLength(payments.length)
  })

  it('is zero when there is no fee', () => {
    expect(
      feeAsAnnualRateAddition({ openingBalances: [900, 500, 100], fee: 0 }),
    ).toBe(0)
    expect(feeAsAnnualRateAddition({ openingBalances: [], fee: 100 })).toBe(0)
  })

  it('uses the real balance path for an index-linked track', () => {
    const feeAt = (annualInflation: number) => {
      const track = schedule({ type: 'fixedIndexed', rate: 3, annualInflation })
      const rows = track.monthlyRows
      const { payments, balance } = atMonth(rows, 60)
      const fee = prepaymentFee({
        payments,
        balance,
        annualRatePercent: 3,
        marketRatePercent: 2,
        type: 'fixedIndexed',
        indexed: true,
        annualInflation,
        monthsSinceOrigination: 60,
      })
      return feeAsAnnualRateAddition({
        openingBalances: openingBalances(rows, 60, track.principal),
        fee: fee.fee,
        indexed: true,
        annualInflation,
      })
    }

    // Deflating the nominal path recovers the same real balances whatever CPI
    // the schedule assumed, so the comparison measure must not move with it.
    expect(feeAt(0.02)).toBeCloseTo(feeAt(0.05), 2)
    expect(feeAt(0.02)).toBeGreaterThan(0)
  })
})

describe('prepayment - cheapest payoff order', () => {
  const candidates = [
    { id: 'cheap', balance: 200_000, fee: 1_000 }, // 0.5 agorot per shekel
    { id: 'expensive', balance: 100_000, fee: 5_000 }, // 5 agorot per shekel
    { id: 'free', balance: 50_000, fee: 0 },
  ]

  it('allocates the cheapest shekels first', () => {
    const plan = cheapestPrepaymentOrder(candidates, 120_000)
    expect(plan.order).toEqual(['free', 'cheap', 'expensive'])
    expect(plan.allocations).toEqual([
      { id: 'free', amount: 50_000, fee: 0 },
      { id: 'cheap', amount: 70_000, fee: 350 },
    ])
    expect(plan.allocated).toBe(120_000)
    expect(plan.totalFee).toBe(350)
  })

  it('caps at the balances actually available', () => {
    const plan = cheapestPrepaymentOrder(candidates, 1_000_000)
    expect(plan.allocated).toBe(350_000)
    expect(plan.totalFee).toBe(6_000)
    expect(plan.allocations.map((allocation) => allocation.id)).toEqual([
      'free',
      'cheap',
      'expensive',
    ])
  })

  it('scales the fee pro rata for a partial prepayment', () => {
    const plan = cheapestPrepaymentOrder(candidates, 150_000)
    expect(plan.allocations).toEqual([
      { id: 'free', amount: 50_000, fee: 0 },
      { id: 'cheap', amount: 100_000, fee: 500 },
    ])
  })

  it('returns an empty plan for a zero amount', () => {
    const plan = cheapestPrepaymentOrder(candidates, 0)
    expect(plan.allocations).toEqual([])
    expect(plan.totalFee).toBe(0)
  })
})

describe('prepayment - operational, notice and CPI components', () => {
  it('charges the ₪60 cap once per track', () => {
    expect(
      prepaymentExtras({
        trackCount: 3,
        amountRepaid: 0,
        indexedAmountRepaid: 0,
        noNotice: false,
        firstHalfOfMonth: false,
        annualInflation: 0.03,
      }),
    ).toEqual({
      operationalFee: 180,
      noNoticeFee: 0,
      cpiCompensationFee: 0,
      total: 180,
    })
  })

  it('adds 0.1% only when notice was short', () => {
    const base = {
      trackCount: 1,
      amountRepaid: 200_000,
      indexedAmountRepaid: 0,
      firstHalfOfMonth: false,
      annualInflation: 0.03,
    }
    expect(prepaymentExtras({ ...base, noNotice: false }).noNoticeFee).toBe(0)
    expect(prepaymentExtras({ ...base, noNotice: true }).noNoticeFee).toBe(200)
  })

  it('adds CPI compensation only for indexed money repaid on days 1-15', () => {
    const base = {
      trackCount: 1,
      amountRepaid: 100_000,
      indexedAmountRepaid: 100_000,
      noNotice: false,
      annualInflation: 0.036,
    }
    expect(prepaymentExtras({ ...base, firstHalfOfMonth: false }).cpiCompensationFee).toBe(0)
    const fee = prepaymentExtras({ ...base, firstHalfOfMonth: true })
    // 100,000 × 0.5 × ((1.036)^(1/12) - 1) = 147.58.
    expect(fee.cpiCompensationFee).toBe(147.58)
    expect(fee.total).toBe(207.58)
  })

  it('does not charge CPI compensation on the non-indexed part', () => {
    const fee = prepaymentExtras({
      trackCount: 1,
      amountRepaid: 100_000,
      indexedAmountRepaid: 0,
      noNotice: false,
      firstHalfOfMonth: true,
      annualInflation: 0.036,
    })
    expect(fee.cpiCompensationFee).toBe(0)
  })

  it('keeps every component non-negative at the boundaries', () => {
    const fee = prepaymentExtras({
      trackCount: -2,
      amountRepaid: -100,
      indexedAmountRepaid: 999_999,
      noNotice: true,
      firstHalfOfMonth: true,
      annualInflation: -0.01,
    })
    expect(fee).toEqual({
      operationalFee: 0,
      noNoticeFee: 0,
      cpiCompensationFee: 0,
      total: 0,
    })
  })
})
