import { paymentComposition } from '@/lib/amortization'

/**
 * Trend series for the comparison's combined chart.
 *
 * The chart overlays one line per mix, and the line's shape depends only on
 * which metric the user picked. Keeping that mapping here (a pure function)
 * means the numbers are unit-testable without a browser, and the chart
 * component stays a rendering concern.
 */

export type TrendMetric = 'payment' | 'balance' | 'interest' | 'total' | 'indexation' | 'prepayment'

/** The subset of a scenario's yearly schedule the trend reads. */
export interface TrendSourceRow {
  year: number
  paid: number
  principal: number
  /** CPI drift booked that year (0 for a non-indexed mix). */
  indexation: number
  interest: number
  closing: number
  /** Discounting fee if the mix were repaid at the end of the year (0 when none). */
  prepaymentFee?: number
}

export interface TrendPoint {
  year: number
  value: number
}

/** One year's monthly payment split into the composition chart's segments. */
export interface CompositionSegment {
  year: number
  /**
   * Principal repaid after netting out the year's CPI drift, so it can be
   * negative when indexation outgrows the principal payment.
   */
  principalNet: number
  /** The year's CPI drift (the same figure the schedule's הצמדה column shows). */
  indexation: number
  interest: number
  /** The year's average monthly payment, the top of the three segments. */
  payment: number
}

/**
 * The composition chart's per-year monthly amounts, from the shared
 * `paymentComposition` helper (never a second definition of the split).
 * `principalNet + indexation + interest` reconciles to `payment` without
 * counting indexation twice, and a negative `principalNet` is preserved rather
 * than clamped.
 */
export function compositionSegments(rows: TrendSourceRow[]): CompositionSegment[] {
  return rows.map((row) => {
    const { netPrincipal, indexation, interest } = paymentComposition(row)
    return {
      year: row.year,
      principalNet: netPrincipal / 12,
      indexation: indexation / 12,
      interest: interest / 12,
      payment: row.paid / 12,
    }
  })
}

/**
 * One schedule's values for a metric:
 * - payment: the year's average monthly payment (the yearly total over 12)
 * - balance: the remaining principal at the end of the year
 * - interest: cumulative interest paid through the end of the year
 * - total: cumulative amount paid through the end of the year
 * - indexation: cumulative CPI drift added to the debt through the end of the
 *   year (flat 0 across a non-indexed schedule)
 * - prepayment: the היוון fee if the mix were repaid at the end of that year
 *   (a point-in-time amount, not a cumulative one). Only years the caller
 *   actually priced get a point: a schedule's final year has no fee row (the
 *   loan is over), so the curve must end at the last priced year instead of
 *   dropping to zero as if repaying then were free.
 * The cumulative series start at 0 before the first year (no prefix row here,
 * the chart's x axis starts at year 1).
 */
export function trendValues(rows: TrendSourceRow[], metric: TrendMetric): TrendPoint[] {
  let cumulative = 0
  return rows.flatMap((row) => {
    if (metric === 'interest') cumulative += row.interest
    if (metric === 'total') cumulative += row.paid
    if (metric === 'indexation') cumulative += row.indexation
    const value =
      metric === 'payment'
        ? row.paid / 12
        : metric === 'balance'
          ? row.closing
          : metric === 'prepayment'
            ? (row.prepaymentFee ?? 0)
            : cumulative
    // An unpriced year is a gap, not a zero: the fee curve ends where pricing
    // stopped.
    if (metric === 'prepayment' && row.prepaymentFee === undefined) return []
    return [{ year: row.year, value }]
  })
}

