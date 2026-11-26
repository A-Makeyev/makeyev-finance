import { describe, expect, it } from 'vitest'
import { computeTrackResult } from '@/lib/amortization'

/**
 * Hand-checked balloon schedules.
 *
 * Full balloon: 100,000 at 5% over 24 months pays interest only,
 * 100,000 * 0.05 / 12 = 416.6667 a month, and one final payment of
 * 100,416.6667, for 10,000 of interest in total.
 *
 * Partial balloon: the same loan with a 30% balloon amortizes 70,000 over 24
 * months and leaves 30,000 for maturity. Its first payment is the annuity
 * payment on 70,000 (3,071.00) plus the interest on the 30,000 held aside
 * (125.00) = 3,196.00.
 */

const base = {
  principal: 100_000,
  years: 2,
  termMonths: 24,
  annualRatePercent: 5,
  type: 'fixed' as const,
  method: 'spitzer' as const,
}

describe('balloon schedules', () => {
  it('pays interest only and the whole principal at maturity for a full balloon', () => {
    const result = computeTrackResult({ ...base, balloonPercent: 100 })!

    expect(result.balloonPercent).toBe(100)
    expect(result.balloonAmount).toBeCloseTo(100_000, 6)
    expect(result.firstPayment).toBeCloseTo(416.6667, 3)
    expect(result.monthlyRows).toHaveLength(24)
    expect(result.monthlyRows[0].principal).toBe(0)
    expect(result.monthlyRows[22].principal).toBe(0)
    expect(result.monthlyRows[22].closing).toBeCloseTo(100_000, 6)
    expect(result.monthlyRows[23].principal).toBeCloseTo(100_000, 6)
    expect(result.monthlyRows[23].paid).toBeCloseTo(100_416.6667, 3)
    expect(result.monthlyRows[23].closing).toBe(0)
    expect(result.totalInterest).toBeCloseTo(10_000, 6)
    expect(result.totalPaid).toBeCloseTo(110_000, 6)
    expect(result.firstAmortizingPayment).toBeCloseTo(100_416.6667, 3)
    expect(result.highestPayment).toBeCloseTo(100_416.6667, 3)
  })

  it('amortizes the non-balloon share and leaves 30% for maturity', () => {
    const result = computeTrackResult({ ...base, balloonPercent: 30 })!

    expect(result.balloonPercent).toBe(30)
    expect(result.balloonAmount).toBeCloseTo(30_000, 6)
    // 3,071.00 on the amortizing 70,000 plus 125.00 of interest on the 30,000.
    expect(result.firstPayment).toBeCloseTo(3_196.0, 2)
    expect(result.monthlyRows[0].principal).toBeCloseTo(2_779.33, 2)
    // After month 23 only the balloon plus the last amortizing payment's
    // worth of principal is left (about 3,058), and month 24 settles it.
    expect(result.monthlyRows[22].closing).toBeCloseTo(33_058.25, 1)
    expect(result.monthlyRows[23].principal).toBeCloseTo(33_058.25, 1)
    expect(result.monthlyRows[23].closing).toBe(0)
    // Every shekel of principal is either amortized or paid as the balloon.
    expect(result.totalInterest).toBeCloseTo(
      result.totalPaid - base.principal,
      6,
    )
    expect(result.totalPaid).toBeGreaterThan(100_000)
  })

  it('keeps every principal row on a partial balloon over a long term and absorbs the rounding remainder', () => {
    const result = computeTrackResult({
      principal: 100_000,
      years: 30,
      termMonths: 360,
      annualRatePercent: 4.5,
      type: 'fixed',
      method: 'spitzer',
      balloonPercent: 50,
    })!

    const principal = result.monthlyRows.reduce((sum, row) => sum + row.principal, 0)
    expect(principal).toBeCloseTo(100_000, 6)
    expect(result.monthlyRows[359].closing).toBe(0)
    expect(result.balloonAmount).toBeCloseTo(50_000, 6)
    // The last payment is the balloon plus interest, so it dwarfs the monthly.
    expect(result.monthlyRows[359].paid).toBeGreaterThan(50_000)
    expect(result.monthlyRows[358].paid).toBeLessThan(result.monthlyRows[0].paid * 1.1)
  })

  it('inflates the balloon with the CPI on an indexed track instead of freezing it', () => {
    const result = computeTrackResult({
      ...base,
      type: 'fixedIndexed',
      annualInflation: 0.02,
      balloonPercent: 30,
    })!

    // The balance is indexed from month 2, so 23 months at 2%/year:
    // 30,000 * (1.02)^(23/12) = 31,160.5.
    expect(result.balloonAmount).toBeCloseTo(31_160.5, 1)
    expect(result.monthlyRows[23].closing).toBe(0)
    expect(result.totalIndexation).toBeGreaterThan(0)
  })

  it('treats absent, null and zero as a fully amortizing schedule', () => {
    const plain = computeTrackResult(base)!
    const zero = computeTrackResult({ ...base, balloonPercent: 0 })!
    expect(zero).toEqual(plain)
    expect(zero.balloonPercent).toBe(0)
    expect(zero.balloonAmount).toBe(0)
    expect(zero.monthlyRows[23].closing).toBe(0)
  })

  it('refuses grace combined with a balloon and out-of-range percentages', () => {
    expect(computeTrackResult({ ...base, balloonPercent: 50, graceMonths: 6 })).toBeNull()
    expect(computeTrackResult({ ...base, balloonPercent: 50, graceMonths: 6, graceMode: 'interestOnly' })).toBeNull()
    for (const balloonPercent of [-1, 100.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(computeTrackResult({ ...base, balloonPercent }), String(balloonPercent)).toBeNull()
    }
    expect(computeTrackResult({ ...base, balloonPercent: 100 })).not.toBeNull()
  })
})
