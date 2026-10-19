import { describe, expect, it } from 'vitest'
import {
  AVERAGE_RATE_BUCKETS,
  AVERAGE_RATE_KINDS,
  bucketIdsFor,
  formatAverageRate,
  recentRateRows,
  type AverageRateRow,
} from '@/lib/averageRates'

function row(validFrom: string, average = 3.5): AverageRateRow {
  return { validFrom, periodToDueDate: null, average, buckets: {} }
}

describe('average-rate bucket definitions', () => {
  it('uses the official column order for each workbook', () => {
    expect(bucketIdsFor('indexed')).toEqual([
      'over25',
      '20to25',
      '15to20',
      '10to15',
      '5to10',
      'upTo5',
    ])
    expect(bucketIdsFor('nonIndexed')).toEqual([
      'over25',
      '20to25',
      '15to20',
      '10to15',
      '5to10',
      '1to5',
      'upTo1',
    ])
  })

  it('has unique ids and sane boundaries in every kind', () => {
    for (const kind of AVERAGE_RATE_KINDS) {
      const buckets = AVERAGE_RATE_BUCKETS[kind]
      expect(new Set(buckets.map((bucket) => bucket.id)).size).toBe(buckets.length)
      for (const bucket of buckets) {
        if (bucket.fromYears !== null && bucket.toYears !== null) {
          expect(bucket.fromYears).toBeLessThan(bucket.toYears)
        }
      }
    }
  })
})

describe('formatAverageRate', () => {
  it('renders two-decimal percents in both locales', () => {
    expect(formatAverageRate(3.4909803402847603, 'en')).toBe('3.49%')
    expect(formatAverageRate(3.4909803402847603, 'he')).toBe('3.49%')
    expect(formatAverageRate(0, 'en')).toBe('0.00%')
    expect(formatAverageRate(4.5, 'en')).toBe('4.50%')
  })

  it('degrades missing and non-finite values to a dash', () => {
    expect(formatAverageRate(null, 'en')).toBe('-')
    expect(formatAverageRate(Number.NaN, 'en')).toBe('-')
    expect(formatAverageRate(Number.POSITIVE_INFINITY, 'en')).toBe('-')
  })
})

describe('recentRateRows', () => {
  const rows = [
    '2026-12-01',
    '2026-11-01',
    '2026-10-01',
    '2026-09-01',
    '2026-08-01',
    '2026-07-01',
    '2026-06-01',
    '2026-05-01',
    '2026-04-01',
    '2026-03-01',
    '2026-02-01',
    '2026-01-01',
    '2025-12-01',
    '2025-11-01',
    '2025-10-01',
  ].map((date) => row(date))

  it('returns at most the requested count in input order', () => {
    expect(recentRateRows(rows, 12)).toHaveLength(12)
    expect(recentRateRows(rows, 12)[0].validFrom).toBe('2026-12-01')
  })

  it('clamps a non-positive or fractional count to at least one row', () => {
    expect(recentRateRows(rows, 0)).toHaveLength(1)
    expect(recentRateRows(rows, 2.9)).toHaveLength(2)
  })
})
