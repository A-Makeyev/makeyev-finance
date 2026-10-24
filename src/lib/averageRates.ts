/**
 * Bank of Israel average mortgage-rate tables.
 *
 * Shared by the server parser (which reads the two official XLS workbooks) and
 * the rates page. Pure types and display helpers only, so this module is safe
 * in both bundles.
 *
 * Source: the Bank of Israel's monthly "average rate on mortgages" page,
 * https://www.boi.org.il/information/interestrates/mortgage/ . The two
 * workbooks are the official tables used for early-repayment-fee calculations:
 *   - pribmash.xls  -> CPI-indexed mortgages
 *   - mashfix.xls   -> non-indexed shekel mortgages
 *
 * The bucket boundaries follow the workbooks. Periods include their upper
 * bound, as the BOI page states; "over 25" is the only open-ended bucket.
 */

export const AVERAGE_RATE_KINDS = ['indexed', 'nonIndexed'] as const

/**
 * Comparison rate used when the Bank of Israel table is missing or does not
 * cover a term. Shared by every early-repayment estimate so the calculator and
 * the comparison cannot fall back to different numbers.
 */
export const FALLBACK_MARKET_RATE_PERCENT = 3.5

export type AverageRateKind = (typeof AVERAGE_RATE_KINDS)[number]

export type AverageRateBucketId =
  | 'over25'
  | '20to25'
  | '15to20'
  | '10to15'
  | '5to10'
  | '1to5'
  | 'upTo5'
  | 'upTo1'

export interface AverageRateBucket {
  id: AverageRateBucketId
  /** Exclusive lower bound in years ("over N"), or null for the bottom bucket. */
  fromYears: number | null
  /** Inclusive upper bound in years ("up to N"), or null for the open top bucket. */
  toYears: number | null
}

/**
 * The bucket order is the workbook column order, because the parser maps
 * columns positionally after validating the count. Keep it in sync with the
 * official tables (newest table first, then the shorter-term buckets).
 */
export const AVERAGE_RATE_BUCKETS: Record<
  AverageRateKind,
  readonly AverageRateBucket[]
> = {
  indexed: [
    { id: 'over25', fromYears: 25, toYears: null },
    { id: '20to25', fromYears: 20, toYears: 25 },
    { id: '15to20', fromYears: 15, toYears: 20 },
    { id: '10to15', fromYears: 10, toYears: 15 },
    { id: '5to10', fromYears: 5, toYears: 10 },
    { id: 'upTo5', fromYears: null, toYears: 5 },
  ],
  nonIndexed: [
    { id: 'over25', fromYears: 25, toYears: null },
    { id: '20to25', fromYears: 20, toYears: 25 },
    { id: '15to20', fromYears: 15, toYears: 20 },
    { id: '10to15', fromYears: 10, toYears: 15 },
    { id: '5to10', fromYears: 5, toYears: 10 },
    { id: '1to5', fromYears: 1, toYears: 5 },
    { id: 'upTo1', fromYears: null, toYears: 1 },
  ],
}

/** Bucket ids in the order the workbook (and the table) presents them. */
export function bucketIdsFor(kind: AverageRateKind): AverageRateBucketId[] {
  return AVERAGE_RATE_BUCKETS[kind].map((bucket) => bucket.id)
}

/**
 * The bucket a given loan term falls in, for picking the comparison rate of a
 * track with that many years left. Bounds include their upper end and exclude
 * the lower one (the BOI's own reading of the table), so 5 years lands in
 * "up to 5" and 5.5 in "5-10". Null when no bucket covers the term.
 */
export function bucketForYears(kind: AverageRateKind, years: number): AverageRateBucketId | null {
  if (!Number.isFinite(years)) return null
  for (const bucket of AVERAGE_RATE_BUCKETS[kind]) {
    const aboveLower = bucket.fromYears === null || years > bucket.fromYears
    const upToUpper = bucket.toYears === null || years <= bucket.toYears
    if (aboveLower && upToUpper) return bucket.id
  }
  return null
}

export interface AverageRateRow {
  /** Date the rate takes effect, date-only 'YYYY-MM-DD'. */
  validFrom: string
  /** The reporting month, when the workbook publishes one. */
  periodToDueDate: string | null
  /** Effective annual rate for this publication, in percent. */
  average: number
  /** Bucket id -> effective annual rate in percent. Missing = not published. */
  buckets: Partial<Record<AverageRateBucketId, number>>
}

export interface AverageRateTable {
  kind: AverageRateKind
  /** Newest first. The service slices this to the history window. */
  rows: AverageRateRow[]
}

export type AverageRateTableStatus = 'ok' | 'stale' | 'unavailable'

export interface AverageRateTablePayload {
  kind: AverageRateKind
  status: AverageRateTableStatus
  /** Newest first, capped at the response's `historyRows`. */
  rows: AverageRateRow[]
  /** Ordered bucket ids the table's columns follow. */
  buckets: AverageRateBucketId[]
  /** Newest row's valid-from date, or null when unavailable. */
  asOf: string | null
  /** When this table was fetched, ISO 8601, or null when never fetched. */
  fetchedAt: string | null
}

export interface AverageRatesResponse {
  tables: AverageRateTablePayload[]
  /** Rows returned per table, including the current one. */
  historyRows: number
}

/**
 * The published average rate for a loan with `years` left, or `fallback` when
 * the table, the bucket or the value is missing. Uses the newest row, which is
 * the same row the rates page shows at the top of each table. Shared by the
 * calculator's prepayment panel and the comparison's fee chart so both price
 * from one reading of the official table.
 */
export function averageRateForTerm(
  tables: readonly AverageRateTablePayload[] | undefined,
  kind: AverageRateKind,
  years: number,
  fallback: number,
): number {
  const table = tables?.find((entry) => entry.kind === kind)
  const bucket = bucketForYears(kind, years)
  const value = table?.rows[0] && bucket ? table.rows[0].buckets[bucket] : undefined
  return typeof value === 'number' ? value : fallback
}

/** Grouped percent display for a rate cell; null/non-finite becomes a dash. */
export function formatAverageRate(value: number | null, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)
}

/**
 * The latest `count` rows, newest first. Kept pure so the service and its
 * tests share one definition of the history window.
 */
export function recentRateRows(rows: readonly AverageRateRow[], count: number): AverageRateRow[] {
  const limit = Math.max(1, Math.floor(count))
  return rows.slice(0, limit)
}
