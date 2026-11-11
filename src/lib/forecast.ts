/**
 * Forward-looking scenarios for the calculator's forecast panel.
 *
 * Two assumptions drive this module, and both are shown in the UI:
 * - every variable track's rate moves by `FORECAST_STEP_PERCENT` percentage
 *   points at EACH contractual reset (cumulatively), with the base path left
 *   flat;
 * - the CPI path is flat at the same annual change the schedule already uses
 *   (`CalculatorSnapshot.annualInflation`).
 *
 * Only tracks with a positive `resetMonths` take the step. Prime tracks follow
 * the Bank of Israel rate rather than a contractual calendar, and fixed tracks
 * do not reset, so both carry `resetMonths = 0` and stay flat.
 *
 * Pure math - no React, no store; see tests/unit/forecast.test.ts.
 */

import {
  combineMonthlySchedules,
  computeTrackResult,
  defaultResetMonthsFor,
  isIndexedType,
  type AmortizationMethod,
  type TrackResult,
  type TrackType,
} from './amortization'

/** The forecast's per-reset rate move, in percentage points. */
export const FORECAST_STEP_PERCENT = 1

export interface ForecastTrackInput {
  principal: number
  years: number
  annualRatePercent: number
  type: TrackType
  method: AmortizationMethod
  /** Contractual reset cadence in months; 0 means no contractual reset. */
  resetMonths?: number
  /** Grace months at the start of the term; 0 means no grace. */
  graceMonths?: number
  graceMode?: 'interestOnly' | 'fullDeferral'
}

/** One plotted year: the payment at its start plus the running cost totals. */
export interface ForecastYearPoint {
  year: number
  /**
   * Combined monthly payment in the first month of the year. A reset that
   * takes effect on month 25 therefore shows as a step in year 3.
   */
  payment: number
  /** Combined interest paid from month 1 through the end of this year. */
  cumulativeInterest: number
  /** Combined CPI drift added from month 1 through the end of this year. */
  cumulativeIndexation: number
}

export type ForecastScenarioId = 'base' | 'up' | 'down'

export interface ForecastScenario {
  id: ForecastScenarioId
  /** Cumulative percentage points applied at each reset (0 for the base path). */
  stepPercent: number
  points: ForecastYearPoint[]
}

export interface Forecast {
  /** Display order: base, +1pp, -1pp. */
  scenarios: ForecastScenario[]
  /** 1-based years in which a contractual reset actually occurs. */
  resetYears: number[]
  /** Whether the mix holds a CPI-indexed track (indexation is 0 otherwise). */
  hasIndexation: boolean
  /** Whether any track resets within its term (false hides the step chart). */
  hasResetTracks: boolean
}

/**
 * One year of the cost chart: the year's own accrual plus the running totals.
 * The chart draws the yearly interest/indexation as stacked bars and the
 * combined running total as a line, so the reader sees both what a single year
 * costs and how the cost accumulates over the term.
 */
export interface ForecastAnnualCost {
  year: number
  /** Interest accrued in this year alone (not cumulative). */
  interest: number
  /** CPI drift added in this year alone (0 without an indexed track). */
  indexation: number
  cumulativeInterest: number
  cumulativeIndexation: number
  /** Interest + indexation accrued from month 1 through this year. */
  cumulativeTotal: number
}

/**
 * Splits the cumulative points into each year's own accrual and the running
 * total. The yearly figures are the difference between adjacent cumulative
 * totals, so they sum back to the same amounts; no rounding is applied, since
 * the chart only draws them and the table keeps the exact cumulative values.
 */
export function annualCostsFor(
  points: readonly ForecastYearPoint[],
): ForecastAnnualCost[] {
  let previousInterest = 0
  let previousIndexation = 0
  return points.map((point) => {
    const interest = point.cumulativeInterest - previousInterest
    const indexation = point.cumulativeIndexation - previousIndexation
    previousInterest = point.cumulativeInterest
    previousIndexation = point.cumulativeIndexation
    return {
      year: point.year,
      interest,
      indexation,
      cumulativeInterest: point.cumulativeInterest,
      cumulativeIndexation: point.cumulativeIndexation,
      cumulativeTotal: point.cumulativeInterest + point.cumulativeIndexation,
    }
  })
}

/**
 * 1-based months at which a track with `resetMonths` resets over `years` of
 * payments. A reset after `resetMonths` months applies from the following
 * month, so a 24-month cadence over 10 years resets at months 25, 49, 73 and
 * 97. A zero/negative cadence, and a loan that ends on or before the first
 * reset, return an empty list.
 */
export function resetMonthsFor(resetMonths: number, years: number): number[] {
  if (!Number.isFinite(resetMonths) || resetMonths <= 0) return []
  const cycle = Math.round(resetMonths)
  const months = Math.round(years * 12)
  const resets: number[] = []
  for (let month = cycle; month < months; month += cycle) {
    resets.push(month + 1)
  }
  return resets
}

/** The 1-based years those reset months fall in (25 -> year 3, 49 -> 5). */
export function resetYearsFor(resetMonths: number, years: number): number[] {
  return resetMonthsFor(resetMonths, years).map((month) => Math.ceil(month / 12))
}

/**
 * Builds the year points for one scenario from the exact per-month rows the
 * schedule uses: the payment is the first month of the year, while the two
 * cumulative totals run through the year's last month.
 */
function scenarioPoints(results: Array<TrackResult | null>): ForecastYearPoint[] {
  const valid = results.filter((result): result is TrackResult => result !== null)
  const combined = combineMonthlySchedules(valid)
  if (combined.length === 0) return []

  const points: ForecastYearPoint[] = []
  let cumulativeInterest = 0
  let cumulativeIndexation = 0
  const yearCount = Math.ceil(combined.length / 12)
  for (let year = 1; year <= yearCount; year++) {
    const firstIndex = (year - 1) * 12
    const first = combined[firstIndex]
    if (!first) break
    const end = Math.min(year * 12, combined.length)
    for (let index = firstIndex; index < end; index++) {
      cumulativeInterest += combined[index].interest
      cumulativeIndexation += combined[index].indexation
    }
    points.push({
      year,
      payment: first.paid,
      cumulativeInterest,
      cumulativeIndexation,
    })
  }
  return points
}

/**
 * Builds the three forecast paths for the mix. Invalid tracks are skipped,
 * exactly as the calculator's own schedule skips them.
 */
export function buildForecast(
  tracks: readonly ForecastTrackInput[],
  annualInflation: number,
): Forecast {
  const validTracks = tracks.filter(
    (track) =>
      Number.isFinite(track.principal) &&
      track.principal > 0 &&
      Number.isFinite(track.years) &&
      track.years > 0 &&
      Number.isFinite(track.annualRatePercent) &&
      track.annualRatePercent >= 0,
  )

  const cadenceOf = (track: ForecastTrackInput): number =>
    track.resetMonths ?? defaultResetMonthsFor(track.type)

  const run = (stepPercent: number): ForecastScenario => ({
    id: stepPercent > 0 ? 'up' : stepPercent < 0 ? 'down' : 'base',
    stepPercent,
    points: scenarioPoints(
      validTracks.map((track) =>
        computeTrackResult({
          principal: track.principal,
          years: track.years,
          annualRatePercent: track.annualRatePercent,
          type: track.type,
          method: track.method,
          annualInflation,
          resetMonths: cadenceOf(track),
          graceMonths: track.graceMonths,
          graceMode: track.graceMode,
          rateResetMonths: resetMonthsFor(cadenceOf(track), track.years),
          rateStepPercent: stepPercent,
        }),
      ),
    ),
  })

  const resetYears = Array.from(
    new Set(
      validTracks.flatMap((track) => resetYearsFor(cadenceOf(track), track.years)),
    ),
  ).sort((a, b) => a - b)

  return {
    scenarios: [run(0), run(FORECAST_STEP_PERCENT), run(-FORECAST_STEP_PERCENT)],
    resetYears,
    hasIndexation: validTracks.some((track) => isIndexedType(track.type)),
    hasResetTracks: resetYears.length > 0,
  }
}
