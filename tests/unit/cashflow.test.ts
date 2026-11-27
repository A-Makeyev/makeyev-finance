import { describe, expect, it } from 'vitest'
import {
  compareCashFlows,
  type CashFlowMonth,
  type CashFlowSide,
} from '@/features/compare/cashflow'

/**
 * The comparison is a pure diff over the shared monthly rows. These tests pin
 * the sign convention (positive = candidate better), the common horizon, the
 * remaining-balance row and the three break-even outcomes: immediate, a real
 * crossing, and never.
 */

function months(count: number, paid: number, overrides: Partial<CashFlowMonth> = {}): CashFlowMonth[] {
  return Array.from({ length: count }, (_, index) => ({
    year: Math.floor(index / 12) + 1,
    month: (index % 12) + 1,
    paid,
    interest: paid * 0.4,
    indexation: 0,
    closing: Math.max(0, 100_000 - (index + 1) * 1_000),
    ...overrides,
  }))
}

function side(
  label: string,
  rows: CashFlowMonth[],
  fees = 0,
): CashFlowSide {
  return { label, months: rows, fees }
}

describe('compareCashFlows', () => {
  it('marks a cheaper candidate as positive on every delta', () => {
    const baseline = side('Baseline', months(12, 1_000))
    const candidate = side(
      'Candidate',
      months(12, 900, { interest: 300, indexation: 40 }),
    )

    const comparison = compareCashFlows(baseline, candidate)!

    expect(comparison.firstPaymentDelta).toBe(100)
    // 12 x (400 - 300) = 1,200
    expect(comparison.interestDelta).toBe(1_200)
    // 12 x (0 - 40) = -480: the baseline is not indexed here, so the candidate
    // pays MORE indexation and the delta is negative.
    expect(comparison.indexationDelta).toBe(-480)
    expect(comparison.feesDelta).toBe(0)
    expect(comparison.balanceDelta).toBe(0)
    // 12 x 100 = 1,200
    expect(comparison.netCashFlowDelta).toBe(1_200)
    expect(comparison.horizonMonths).toBe(12)
    expect(comparison.horizonYears).toBe(1)
    expect(comparison.breaksEvenImmediately).toBe(true)
    expect(comparison.breakEvenMonth).toBe(1)
    expect(comparison.cumulativeSavings.at(-1)?.savings).toBe(1_200)
  })

  it('reports the baseline own totals, not just the deltas', () => {
    const baseline = side('Baseline', months(12, 1_000), 5_000)
    const candidate = side('Candidate', months(12, 900))

    const comparison = compareCashFlows(baseline, candidate)!

    expect(comparison.baselineTotals).toEqual({
      firstPayment: 1_000,
      // 12 x 400
      interest: 4_800,
      indexation: 0,
      fees: 5_000,
      // 100,000 less 12 payments of 1,000
      balance: 88_000,
      // 5,000 fees + 12 x 1,000 payments
      totalOutlay: 17_000,
    })
    // The candidate's deltas still reconcile against those figures: the
    // cheaper upfront fee (5,000) plus 12 months of 100 less payment.
    expect(comparison.netCashFlowDelta).toBe(6_200)
  })

  it('finds the first month where cumulative savings cross zero', () => {
    const baseline = side('Baseline', months(12, 1_000))
    const candidate = side('Candidate', [
      ...months(1, 1_200),
      ...months(1, 1_100).map((row, index) => ({ ...row, month: index + 2 })),
      ...months(1, 800).map((row) => ({ ...row, month: 3 })),
      ...months(9, 500).map((row, index) => ({ ...row, month: index + 4 })),
    ])

    const comparison = compareCashFlows(baseline, candidate)!

    // Month 1: -200, month 2: -300, month 3: -100, month 4: +400.
    expect(comparison.cumulativeSavings[0].savings).toBe(-200)
    expect(comparison.cumulativeSavings[1].savings).toBe(-300)
    expect(comparison.cumulativeSavings[2].savings).toBe(-100)
    expect(comparison.cumulativeSavings[3].savings).toBe(400)
    expect(comparison.breakEvenMonth).toBe(4)
    expect(comparison.breaksEvenImmediately).toBe(false)
  })

  it('returns null break-even when the curve never reaches zero', () => {
    const baseline = side('Baseline', months(24, 1_000))
    const candidate = side('Candidate', months(24, 1_100))

    const comparison = compareCashFlows(baseline, candidate)!

    expect(comparison.netCashFlowDelta).toBe(-2_400)
    expect(comparison.breakEvenMonth).toBeNull()
    expect(comparison.breaksEvenImmediately).toBe(false)
  })

  it('treats cheaper upfront costs as an immediate break-even', () => {
    const baseline = side('Baseline', months(12, 1_000), 5_000)
    const candidate = side('Candidate', months(12, 1_000), 0)

    const comparison = compareCashFlows(baseline, candidate)!

    expect(comparison.feesDelta).toBe(5_000)
    expect(comparison.netCashFlowDelta).toBe(5_000)
    expect(comparison.breakEvenMonth).toBe(1)
    expect(comparison.breaksEvenImmediately).toBe(true)
  })

  it('compares on the shorter term and keeps the remaining debt in its own row', () => {
    const baseline = side('Baseline', months(12, 1_000))
    const candidate = side(
      'Candidate',
      months(24, 1_000).map((row, index) =>
        index === 11 ? { ...row, closing: 5_000 } : row,
      ),
    )

    const comparison = compareCashFlows(baseline, candidate)!

    expect(comparison.horizonMonths).toBe(12)
    expect(comparison.horizonYears).toBe(1)
    // The baseline still owes 88,000 at month 12 (100,000 less 12 payments of
    // 1,000); the candidate's forced closing is 5,000, so it owes 83,000 less.
    expect(comparison.balanceDelta).toBe(83_000)
    expect(comparison.cumulativeSavings).toHaveLength(12)
  })

  it('has nothing to compare when either side has no schedule', () => {
    expect(compareCashFlows(side('Baseline', []), side('Candidate', months(12, 900)))).toBeNull()
    expect(compareCashFlows(side('Baseline', months(12, 900)), side('Candidate', []))).toBeNull()
  })
})
