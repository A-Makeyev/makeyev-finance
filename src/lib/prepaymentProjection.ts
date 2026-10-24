/**
 * Early-repayment fee over the life of a mix, shared by the calculator's
 * prepayment panel and the comparison page.
 *
 * The fee itself stays in `prepayment.ts`. This module only feeds it the same
 * remaining schedule the calculator shows: for one month it prices every
 * track that still carries a balance, and for a chart it repeats that at the
 * end of every loan year. The calculator and the comparison therefore draw
 * the same curve from the same arithmetic, and neither re-derives a balance,
 * a reset or a rate addition in a component.
 *
 * A five-year track is priced only to its next rate reset (section 4(1)), as
 * the panel's table already does. The projection uses the schedule's current
 * rate and the caller's comparison-rate function; it does not model future
 * resets.
 */
import type { AmortizationMethod, MonthlyRow, TrackType } from './amortization'
import {
  EXIT_STATION_TYPES,
  feeAsAnnualRateAddition,
  prepaymentFee,
  streamToRateReset,
  type PrepaymentFeeBreakdown,
} from './prepayment'

/** Five-year variable tracks reset on this cycle, counted from origination. */
const RESET_EVERY_MONTHS = 60

/** One track as its remaining schedule presents it to the fee model. */
export interface PrepaymentProjectionTrack {
  /** Stable id within the mix: the track type plus its entry index. */
  id: string
  type: TrackType
  monthlyRows: readonly MonthlyRow[]
  annualRatePercent: number
  isIndexed: boolean
  method: AmortizationMethod
}

/** One track's fee at one repayment month. */
export interface PrepaymentFeeRow {
  id: string
  type: TrackType
  /** Outstanding principal at the repayment date, after that month's payment. */
  balance: number
  /** Comparison rate used for this track, in percent. */
  marketRate: number
  isIndexed: boolean
  method: AmortizationMethod
  annualRatePercent: number
  /** First payment after the repayment date, and its principal component. */
  nextPayment: number
  nextPrincipal: number
  /** Months left on the track from the repayment date. */
  remainingMonths: number
  breakdown: PrepaymentFeeBreakdown
  /** The fee re-expressed as an annual rate addition (0 when exempt). */
  rateAddition: number
}

export interface PrepaymentProjectionOptions {
  /** The BOI average (or a manual override) for a track's remaining term. */
  marketRateFor: (track: PrepaymentProjectionTrack, remainingYears: number) => number
  /** Assumed annual CPI change, decimal. */
  annualInflation: number
  /** True when the repayment date is a rate reset (exit station). */
  onExitStation?: boolean
  /** Optional section 3(4) origination average per track id. */
  capRateFor?: (id: string) => number | undefined
}

/**
 * Price every track with a balance at `months` (1-based months from
 * origination). Tracks that have not started or have already ended are
 * omitted, which is what makes the chart's last points stop at each track's
 * own term.
 */
export function prepaymentFeeRows(
  tracks: readonly PrepaymentProjectionTrack[],
  months: number,
  options: PrepaymentProjectionOptions,
): PrepaymentFeeRow[] {
  const { marketRateFor, annualInflation, onExitStation = false, capRateFor } = options
  const result: PrepaymentFeeRow[] = []

  for (const track of tracks) {
    const trackMonths = track.monthlyRows.length
    if (months < 1 || months >= trackMonths) continue
    const balance = track.monthlyRows[months - 1].closing
    if (!(balance > 0)) continue
    const nextRow = track.monthlyRows[months]
    if (!nextRow) continue

    let remainingMonths = trackMonths - months
    let payments = track.monthlyRows.slice(months).map((row) => row.paid)
    // A five-year track's current rate is only fixed until its next reset.
    // Section 4(1) prices it to that date, with the reset balance as the last
    // future payment, rather than pretending the rate runs to the end.
    if (EXIT_STATION_TYPES.includes(track.type)) {
      const monthsIntoBlock = months % RESET_EVERY_MONTHS
      const untilReset =
        monthsIntoBlock === 0 ? RESET_EVERY_MONTHS : RESET_EVERY_MONTHS - monthsIntoBlock
      if (untilReset < remainingMonths) {
        const balanceAtReset = track.monthlyRows[months + untilReset - 1].closing
        payments = streamToRateReset(payments, balanceAtReset, untilReset)
        remainingMonths = untilReset
      }
    }

    // Opening principal of each month the fee covers, for the rate addition.
    const openingBalances = [
      balance,
      ...track.monthlyRows
        .slice(months, months + remainingMonths - 1)
        .map((row) => row.closing),
    ]
    const marketRate = marketRateFor(track, remainingMonths / 12)
    const breakdown = prepaymentFee({
      payments,
      balance,
      annualRatePercent: track.annualRatePercent,
      marketRatePercent: marketRate,
      originationAverageRatePercent: capRateFor?.(track.id),
      type: track.type,
      indexed: track.isIndexed,
      annualInflation,
      monthsSinceOrigination: months,
      onExitStation,
    })

    result.push({
      id: track.id,
      type: track.type,
      balance,
      marketRate,
      isIndexed: track.isIndexed,
      method: track.method,
      annualRatePercent: track.annualRatePercent,
      nextPayment: nextRow.paid,
      nextPrincipal: nextRow.principal,
      remainingMonths: trackMonths - months,
      breakdown,
      rateAddition: feeAsAnnualRateAddition({
        openingBalances,
        fee: breakdown.fee,
        indexed: track.isIndexed,
        annualInflation,
      }),
    })
  }

  return result
}

export interface PrepaymentFeeSeriesPoint {
  year: number
  value: number
}

/** One track's fee at the end of every loan year, for a chart. */
export interface PrepaymentFeeSeries {
  id: string
  type: TrackType
  points: PrepaymentFeeSeriesPoint[]
}

/**
 * The per-track fee series a chart plots: `lastYear` points per track, taken
 * from `prepaymentFeeRows` so the curve is the table's own arithmetic rather
 * than a second model of it. Exempt or already-repaid tracks simply drop out
 * after their term.
 */
export function prepaymentFeeByYear(
  tracks: readonly PrepaymentProjectionTrack[],
  lastYear: number,
  options: PrepaymentProjectionOptions,
): PrepaymentFeeSeries[] {
  const byTrack = new Map<string, PrepaymentFeeSeries>()
  for (let year = 1; year <= lastYear; year++) {
    for (const row of prepaymentFeeRows(tracks, year * 12, options)) {
      const entry = byTrack.get(row.id) ?? { id: row.id, type: row.type, points: [] }
      entry.points.push({ year, value: row.breakdown.fee })
      byTrack.set(row.id, entry)
    }
  }
  return [...byTrack.values()]
}
