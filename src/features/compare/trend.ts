/**
 * Trend series for the comparison's combined chart.
 *
 * The chart overlays one line per mix, and the line's shape depends only on
 * which metric the user picked. Keeping that mapping here (a pure function)
 * means the numbers are unit-testable without a browser, and the chart
 * component stays a rendering concern.
 */

export type TrendMetric = 'payment' | 'balance' | 'interest' | 'total'

/** The subset of a scenario's yearly schedule the trend reads. */
export interface TrendSourceRow {
  year: number
  paid: number
  principal: number
  interest: number
  closing: number
}

export interface TrendPoint {
  year: number
  value: number
}

/**
 * One schedule's values for a metric:
 * - payment: the year's average monthly payment (the yearly total over 12)
 * - balance: the remaining principal at the end of the year
 * - interest: cumulative interest paid through the end of the year
 * - total: cumulative amount paid through the end of the year
 * The cumulative series start at 0 before the first year (no prefix row here,
 * the chart's x axis starts at year 1).
 */
export function trendValues(rows: TrendSourceRow[], metric: TrendMetric): TrendPoint[] {
  let cumulative = 0
  return rows.map((row) => {
    if (metric === 'interest') cumulative += row.interest
    if (metric === 'total') cumulative += row.paid
    const value =
      metric === 'payment'
        ? row.paid / 12
        : metric === 'balance'
          ? row.closing
          : cumulative
    return { year: row.year, value }
  })
}

