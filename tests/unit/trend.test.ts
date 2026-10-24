import { describe, expect, it } from 'vitest'
import {
  compositionSegments,
  trendValues,
  type TrendSourceRow,
} from '@/features/compare/trend'

/**
 * The combined chart's per-metric series. Hand-checked golden values on a
 * two-year schedule, plus the empty and single-row boundaries.
 */

const rows: TrendSourceRow[] = [
  { year: 1, paid: 12000, principal: 8000, indexation: 0, interest: 4000, closing: 92000 },
  { year: 2, paid: 12000, principal: 8400, indexation: 0, interest: 3600, closing: 83600 },
]

describe('trendValues', () => {
  it('payment is the yearly total over 12 (the year average monthly payment)', () => {
    expect(trendValues(rows, 'payment')).toEqual([
      { year: 1, value: 1000 },
      { year: 2, value: 1000 },
    ])
  })

  it('balance is the remaining principal at each year end', () => {
    expect(trendValues(rows, 'balance')).toEqual([
      { year: 1, value: 92000 },
      { year: 2, value: 83600 },
    ])
  })

  it('interest accumulates, never resetting between years', () => {
    expect(trendValues(rows, 'interest')).toEqual([
      { year: 1, value: 4000 },
      { year: 2, value: 7600 },
    ])
  })

  it('total accumulates the amount paid', () => {
    expect(trendValues(rows, 'total')).toEqual([
      { year: 1, value: 12000 },
      { year: 2, value: 24000 },
    ])
  })

  it('prepayment is the fee at each year end, not a cumulative series', () => {
    const withFees: TrendSourceRow[] = [
      { ...rows[0], prepaymentFee: 500 },
      { ...rows[1], prepaymentFee: 300 },
    ]
    expect(trendValues(withFees, 'prepayment')).toEqual([
      { year: 1, value: 500 },
      { year: 2, value: 300 },
    ])
    // An unpriced row is a gap, not a zero: the schedule's last year has no
    // fee row, so the curve must end at the last priced year.
    expect(trendValues(rows, 'prepayment')).toEqual([])
    const pricedOnce: TrendSourceRow[] = [
      { ...rows[0], prepaymentFee: 500 },
      { ...rows[1] },
    ]
    expect(trendValues(pricedOnce, 'prepayment')).toEqual([{ year: 1, value: 500 }])
  })

  it('an empty schedule has no points', () => {
    expect(trendValues([], 'payment')).toEqual([])
    expect(trendValues([], 'interest')).toEqual([])
  })

  it('a single year returns one point', () => {
    expect(trendValues([rows[0]], 'payment')).toEqual([{ year: 1, value: 1000 }])
    expect(trendValues([rows[0]], 'total')).toEqual([{ year: 1, value: 12000 }])
  })

  it('a year with no interest keeps the cumulative line flat', () => {
    const principalOnly: TrendSourceRow[] = [
      { year: 1, paid: 5000, principal: 5000, indexation: 0, interest: 0, closing: 95000 },
      { year: 2, paid: 5000, principal: 5000, indexation: 0, interest: 0, closing: 90000 },
    ]
    expect(trendValues(principalOnly, 'interest')).toEqual([
      { year: 1, value: 0 },
      { year: 2, value: 0 },
    ])
  })

  it('indexation accumulates the CPI drift and stays 0 for a plain schedule', () => {
    expect(trendValues(rows, 'indexation')).toEqual([
      { year: 1, value: 0 },
      { year: 2, value: 0 },
    ])
    const indexed: TrendSourceRow[] = [
      { year: 1, paid: 12000, principal: 8000, indexation: 900, interest: 4000, closing: 92900 },
      { year: 2, paid: 12400, principal: 8600, indexation: 1000, interest: 3800, closing: 85300 },
    ]
    expect(trendValues(indexed, 'indexation')).toEqual([
      { year: 1, value: 900 },
      { year: 2, value: 1900 },
    ])
  })
})

describe('compositionSegments', () => {
  it('splits each year into net principal, indexation and interest (monthly)', () => {
    const indexed: TrendSourceRow[] = [
      { year: 1, paid: 12000, principal: 8000, indexation: 900, interest: 4000, closing: 92900 },
      { year: 2, paid: 12400, principal: 8600, indexation: 1000, interest: 3800, closing: 85300 },
    ]
    expect(compositionSegments(indexed)).toEqual([
      {
        year: 1,
        principalNet: 7100 / 12,
        indexation: 900 / 12,
        interest: 4000 / 12,
        payment: 12000 / 12,
      },
      {
        year: 2,
        principalNet: 7600 / 12,
        indexation: 1000 / 12,
        interest: 3800 / 12,
        payment: 12400 / 12,
      },
    ])
  })

  it('keeps a negative net principal and still reconciles to the payment', () => {
    const underwater: TrendSourceRow[] = [
      { year: 1, paid: 600, principal: 500, indexation: 800, interest: 100, closing: 700 },
    ]
    const [segment] = compositionSegments(underwater)
    expect(segment.principalNet).toBe(-300 / 12)
    expect(segment.indexation).toBe(800 / 12)
    expect(segment.interest).toBe(100 / 12)
    expect(segment.principalNet + segment.indexation + segment.interest).toBeCloseTo(
      segment.payment,
      9,
    )
  })

  it('leaves a non-indexed schedule as principal plus interest', () => {
    const [first] = compositionSegments(rows)
    expect(first).toEqual({
      year: 1,
      principalNet: 8000 / 12,
      indexation: 0,
      interest: 4000 / 12,
      payment: 12000 / 12,
    })
  })

  it('an empty schedule has no segments', () => {
    expect(compositionSegments([])).toEqual([])
  })
})

