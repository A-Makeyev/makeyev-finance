/**
 * Forward-looking scenarios for the calculator's forecast panel.
 *
 * Two assumptions drive this module, and both are shown in the UI:
 * - every five-year variable track's rate moves by `FORECAST_STEP_PERCENT`
 *   percentage points at EACH reset (cumulatively), with the base path left
 *   flat;
 * - the CPI path is flat at the same annual change the schedule already uses
 *   (`CalculatorSnapshot.annualInflation`).
 *
 * Only tracks whose reset dates are contractual (`variable5y`,
 * `variableIndexed5y`) take the step. Prime and annual-or-more-frequent
 * variable tracks reset on dates the contract does not fix, so a cumulative
 * step on them would invent a path; they stay flat.
 *
 * Pure math - no React, no store; see tests/unit/forecast.test.ts.
 */

import {
  combineMonthlySchedules,
  computeTrackResult,
  isIndexedType,
  type AmortizationMethod,
  type TrackResult,
  type TrackType,
} from './amortization'

/** Five-year variable tracks reset on this cycle, counted from origination. */
export const RESET_CYCLE_MONTHS = 60

/** The forecast's per-reset rate move, in percentage points. */
export const FORECAST_STEP_PERCENT = 1

/** Track types whose reset dates the contract fixes. */
export const CONTRACTUAL_RESET_TYPES: readonly TrackType[] = [
  'variable5y',
  'variableIndexed5y',
]

export interface ForecastTrackInput {
  principal: number
  years: number
  annualRatePercent: number
  type: TrackType
  method: AmortizationMethod
}

/** One plotted year: the payment at its start plus the running cost totals. */
export interface ForecastYearPoint {
  year: number
  /**
   * Combined monthly payment in the first month of the year. A reset that
   * takes effect on month 61 therefore shows as a step in year 6.
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
 * 1-based months at which `type` resets over `years` of payments. A reset
 * after `RESET_CYCLE_MONTHS` months applies from the following month, so a
 * 15-year five-year track resets at months 61 and 121. Types without a
 * contractual reset cycle, and loans that end on or before the first reset,
 * return an empty list.
 */
export function resetMonthsFor(type: TrackType, years: number): number[] {
  if (!CONTRACTUAL_RESET_TYPES.includes(type)) return []
  const months = Math.round(years * 12)
  const resets: number[] = []
  for (let month = RESET_CYCLE_MONTHS; month < months; month += RESET_CYCLE_MONTHS) {
    resets.push(month + 1)
  }
  return resets
}

/** The 1-based years those reset months fall in (61 -> year 6, 121 -> 11). */
export function resetYearsFor(type: TrackType, years: number): number[] {
  return resetMonthsFor(type, years).map((month) => Math.ceil(month / 12))
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
          rateResetMonths: resetMonthsFor(track.type, track.years),
          rateStepPercent: stepPercent,
        }),
      ),
    ),
  })

  const resetYears = Array.from(
    new Set(
      validTracks.flatMap((track) => resetYearsFor(track.type, track.years)),
    ),
  ).sort((a, b) => a - b)

  return {
    scenarios: [run(0), run(FORECAST_STEP_PERCENT), run(-FORECAST_STEP_PERCENT)],
    resetYears,
    hasIndexation: validTracks.some((track) => isIndexedType(track.type)),
    hasResetTracks: resetYears.length > 0,
  }
}
