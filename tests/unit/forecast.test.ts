import { describe, expect, it } from 'vitest'
import { computeTrackResult } from '@/lib/amortization'
import {
  buildForecast,
  CONTRACTUAL_RESET_TYPES,
  FORECAST_STEP_PERCENT,
  resetMonthsFor,
  resetYearsFor,
  RESET_CYCLE_MONTHS,
  type ForecastTrackInput,
} from '@/lib/forecast'

const fixed: ForecastTrackInput = {
  principal: 100_000,
  years: 10,
  annualRatePercent: 5,
  type: 'fixed',
  method: 'spitzer',
}

const fiveYearVariable: ForecastTrackInput = {
  principal: 100_000,
  years: 10,
  annualRatePercent: 4,
  type: 'variable5y',
  method: 'spitzer',
}

describe('resetMonthsFor / resetYearsFor', () => {
  it('steps the month AFTER each five-year block', () => {
    expect(resetMonthsFor('variable5y', 15)).toEqual([61, 121])
    expect(resetYearsFor('variable5y', 15)).toEqual([6, 11])
    expect(resetMonthsFor('variableIndexed5y', 10)).toEqual([61])
  })

  it('has no reset when the loan ends on or before the first cycle', () => {
    expect(resetMonthsFor('variable5y', 5)).toEqual([])
    expect(resetMonthsFor('variable5y', 1)).toEqual([])
  })

  it('only prices contractual reset types', () => {
    expect(CONTRACTUAL_RESET_TYPES).toEqual(['variable5y', 'variableIndexed5y'])
    expect(resetMonthsFor('prime', 30)).toEqual([])
    expect(resetMonthsFor('variable', 30)).toEqual([])
    expect(resetMonthsFor('variableIndexed', 30)).toEqual([])
    expect(resetMonthsFor('fixedIndexed', 30)).toEqual([])
    expect(RESET_CYCLE_MONTHS).toBe(60)
    expect(FORECAST_STEP_PERCENT).toBe(1)
  })
})

describe('buildForecast', () => {
  it('reproduces the plain schedule in the base path', () => {
    const forecast = buildForecast([fixed], 0.02)
    const [base, up, down] = forecast.scenarios
    expect(base.id).toBe('base')
    expect(up.id).toBe('up')
    expect(down.id).toBe('down')
    expect(base.points).toHaveLength(10)
    expect(base.points[0].payment).toBeCloseTo(1060.6552, 4)
    // 120 payments of 1060.6552 minus the 100,000 principal.
    expect(base.points[9].cumulativeInterest).toBeCloseTo(27_278.6183, 4)
    // A fixed track has no reset, so all three paths are identical.
    expect(up.points).toEqual(base.points)
    expect(down.points).toEqual(base.points)
    expect(forecast.resetYears).toEqual([])
    expect(forecast.hasResetTracks).toBe(false)
    expect(forecast.hasIndexation).toBe(false)
  })

  it('steps the variable track only from year 6', () => {
    const forecast = buildForecast([fiveYearVariable], 0.02)
    const [base, up, down] = forecast.scenarios
    expect(forecast.resetYears).toEqual([6])
    expect(forecast.hasResetTracks).toBe(true)
    // Years 1-5 run at the entered 4%.
    for (let year = 0; year < 5; year++) {
      expect(up.points[year].payment).toBeCloseTo(base.points[year].payment, 6)
      expect(down.points[year].payment).toBeCloseTo(base.points[year].payment, 6)
    }
    expect(base.points[0].payment).toBeCloseTo(1012.4514, 4)
    // Year 6 reprices the remaining balance at 5% / 4% / 3%.
    expect(up.points[5].payment).toBeCloseTo(1037.4492, 4)
    expect(base.points[5].payment).toBeCloseTo(1012.4514, 4)
    expect(down.points[5].payment).toBeCloseTo(987.8318, 4)
  })

  it('compounds the step at every reset', () => {
    const forecast = buildForecast([{ ...fiveYearVariable, years: 15 }], 0.02)
    const [base, up, down] = forecast.scenarios
    expect(forecast.resetYears).toEqual([6, 11])
    // Base stays at 4% and therefore reprices to the same payment.
    expect(base.points[10].payment).toBeCloseTo(base.points[5].payment, 4)
    // +1pp twice: year 11 runs at 6% and must cost more than year 6 at 5%.
    expect(up.points[10].payment).toBeGreaterThan(up.points[5].payment)
    // -1pp twice: 3% then 2%.
    expect(down.points[10].payment).toBeLessThan(down.points[5].payment)
  })

  it('adds the reset tracks on top of the fixed tracks', () => {
    const forecast = buildForecast([fixed, fiveYearVariable], 0.02)
    const up = forecast.scenarios[1]
    // Fixed 1060.6552 + variable at 5% 1037.4492.
    expect(up.points[5].payment).toBeCloseTo(1060.6552 + 1037.4492, 3)
    expect(forecast.resetYears).toEqual([6])
  })

  it('keeps prime and frequent-reset tracks flat across scenarios', () => {
    const prime: ForecastTrackInput = { ...fiveYearVariable, type: 'prime' }
    const annual: ForecastTrackInput = { ...fiveYearVariable, type: 'variable' }
    const forecast = buildForecast([prime, annual], 0.02)
    const [base, up, down] = forecast.scenarios
    expect(forecast.resetYears).toEqual([])
    expect(up.points).toEqual(base.points)
    expect(down.points).toEqual(base.points)
  })

  it('carries the flat CPI path into cumulative indexation', () => {
    const indexed: ForecastTrackInput = {
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
    }
    const forecast = buildForecast([indexed], 0.02)
    const base = forecast.scenarios[0]
    const result = computeTrackResult({
      principal: indexed.principal,
      years: indexed.years,
      annualRatePercent: indexed.annualRatePercent,
      type: indexed.type,
      method: indexed.method,
      annualInflation: 0.02,
    })!
    expect(forecast.hasIndexation).toBe(true)
    expect(base.points).toHaveLength(30)
    expect(base.points[29].cumulativeIndexation).toBeCloseTo(result.totalIndexation, 6)
    // Interest accumulates to exactly the track's own total.
    expect(base.points[29].cumulativeInterest).toBeCloseTo(result.totalInterest, 6)
  })

  it('skips invalid tracks and returns an empty forecast', () => {
    const forecast = buildForecast([{ ...fixed, principal: 0 }], 0.02)
    expect(forecast.scenarios.every((scenario) => scenario.points.length === 0)).toBe(true)
    expect(forecast.resetYears).toEqual([])
    expect(forecast.hasIndexation).toBe(false)
    expect(forecast.hasResetTracks).toBe(false)
  })
})
