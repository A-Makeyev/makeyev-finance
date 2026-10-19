/**
 * Deterministic fixture for the average-rates page.
 *
 * Values mirror the real BOI workbooks (the October 2026 publication) so the
 * UI assertions read like the live page without any network access. The
 * history months are the real publication dates, with small synthetic changes
 * after the current row.
 */

export type RateBucketId =
  | 'over25'
  | '20to25'
  | '15to20'
  | '10to15'
  | '5to10'
  | '1to5'
  | 'upTo5'
  | 'upTo1'

export interface RateRowFixture {
  validFrom: string
  periodToDueDate: string | null
  average: number
  buckets: Partial<Record<RateBucketId, number>>
}

export interface RateTableFixture {
  kind: 'indexed' | 'nonIndexed'
  status: 'ok' | 'stale' | 'unavailable'
  buckets: RateBucketId[]
  rows: RateRowFixture[]
  asOf: string | null
  fetchedAt: string | null
}

export interface RatesFixture {
  tables: RateTableFixture[]
  historyRows: number
}

const PUBLICATION_DATES = [
  '2026-10-19',
  '2026-09-15',
  '2026-08-13',
  '2026-07-13',
  '2026-06-11',
  '2026-05-14',
  '2026-04-21',
  '2026-03-16',
  '2026-02-11',
  '2026-01-14',
  '2025-12-11',
  '2025-11-12',
]

const INDEXED_BUCKETS: RateBucketId[] = [
  'over25',
  '20to25',
  '15to20',
  '10to15',
  '5to10',
  'upTo5',
]

const NON_INDEXED_BUCKETS: RateBucketId[] = [
  'over25',
  '20to25',
  '15to20',
  '10to15',
  '5to10',
  '1to5',
  'upTo1',
]

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function history(
  average: number,
  current: Partial<Record<RateBucketId, number>>,
): RateRowFixture[] {
  return PUBLICATION_DATES.map((validFrom, index) => {
    const buckets: Partial<Record<RateBucketId, number>> = {}
    for (const [id, value] of Object.entries(current) as [RateBucketId, number][]) {
      buckets[id] = round2(value - index * 0.01)
    }
    return {
      validFrom,
      periodToDueDate: null,
      average: round2(average - index * 0.01),
      buckets,
    }
  })
}

export function ratesFixture(): RatesFixture {
  return {
    historyRows: 12,
    tables: [
      {
        kind: 'indexed',
        status: 'ok',
        buckets: [...INDEXED_BUCKETS],
        asOf: PUBLICATION_DATES[0],
        fetchedAt: '2026-10-19T12:00:00.000Z',
        rows: history(3.49, {
          over25: 3.53,
          '20to25': 3.37,
          '15to20': 3.46,
          '10to15': 3.24,
          '5to10': 3.49,
          upTo5: 3.5,
        }),
      },
      {
        kind: 'nonIndexed',
        status: 'ok',
        buckets: [...NON_INDEXED_BUCKETS],
        asOf: PUBLICATION_DATES[0],
        fetchedAt: '2026-10-19T12:00:00.000Z',
        rows: history(4.55, {
          over25: 4.89,
          '20to25': 4.79,
          '15to20': 4.74,
          '10to15': 4.61,
          '5to10': 4.59,
          '1to5': 4.51,
          upTo1: 4.35,
        }),
      },
    ],
  }
}

/** A response with one table unavailable, for the partial-failure UI state. */
export function ratesFixtureWithUnavailable(
  kind: 'indexed' | 'nonIndexed',
): RatesFixture {
  const fixture = ratesFixture()
  fixture.tables = fixture.tables.map((table) =>
    table.kind === kind
      ? { ...table, status: 'unavailable', rows: [], asOf: null, fetchedAt: null }
      : table,
  )
  return fixture
}
