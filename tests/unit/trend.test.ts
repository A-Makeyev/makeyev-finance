import { describe, expect, it } from 'vitest'
import { trendValues, type TrendSourceRow } from '@/features/compare/trend'

/**
 * The combined chart's per-metric series. Hand-checked golden values on a
 * two-year schedule, plus the empty and single-row boundaries.
 */

const rows: TrendSourceRow[] = [
  { year: 1, paid: 12000, principal: 8000, interest: 4000, closing: 92000 },
  { year: 2, paid: 12000, principal: 8400, interest: 3600, closing: 83600 },
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
      { year: 1, paid: 5000, principal: 5000, interest: 0, closing: 95000 },
      { year: 2, paid: 5000, principal: 5000, interest: 0, closing: 90000 },
    ]
    expect(trendValues(principalOnly, 'interest')).toEqual([
      { year: 1, value: 0 },
      { year: 2, value: 0 },
    ])
  })
})
