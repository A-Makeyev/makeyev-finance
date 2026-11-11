import { describe, expect, it } from 'vitest'
import { computeTrackResult } from '@/lib/amortization'
import {
  annualCostsFor,
  buildForecast,
  FORECAST_STEP_PERCENT,
  resetMonthsFor,
  resetYearsFor,
  type ForecastTrackInput,
} from '@/lib/forecast'

const fixed: ForecastTrackInput = {
  principal: 100_000,
  years: 10,
  annualRatePercent: 5,
  type: 'fixed',
  method: 'spitzer',
  resetMonths: 0,
}

const fiveYearVariable: ForecastTrackInput = {
  principal: 100_000,
  years: 10,
  annualRatePercent: 4,
  type: 'variable5y',
  method: 'spitzer',
  resetMonths: 60,
}

describe('resetMonthsFor / resetYearsFor', () => {
  it('steps the month AFTER each cadence block', () => {
    expect(resetMonthsFor(60, 15)).toEqual([61, 121])
    expect(resetYearsFor(60, 15)).toEqual([6, 11])
    expect(resetMonthsFor(24, 10)).toEqual([25, 49, 73, 97])
    expect(resetYearsFor(24, 10)).toEqual([3, 5, 7, 9])
    expect(resetMonthsFor(18, 10)).toEqual([19, 37, 55, 73, 91, 109])
    expect(resetMonthsFor(12, 3)).toEqual([13, 25])
  })

  it('has no reset when the loan ends on or before the first cycle', () => {
    expect(resetMonthsFor(60, 5)).toEqual([])
    expect(resetMonthsFor(24, 2)).toEqual([])
    expect(resetMonthsFor(60, 1)).toEqual([])
  })

  it('treats a zero cadence as no contractual reset', () => {
    expect(resetMonthsFor(0, 30)).toEqual([])
    expect(resetMonthsFor(-12, 30)).toEqual([])
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

  it('keeps prime flat but steps an annual cadence', () => {
    const prime: ForecastTrackInput = { ...fiveYearVariable, type: 'prime', resetMonths: 0 }
    const annual: ForecastTrackInput = { ...fiveYearVariable, type: 'variable', resetMonths: 12 }
    const forecast = buildForecast([prime, annual], 0.02)
    const [base, up] = forecast.scenarios
    expect(forecast.resetYears).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10])
    // Year 1 is before the first annual reset at month 13.
    expect(up.points[0].payment).toBeCloseTo(base.points[0].payment, 6)
    // Year 2 runs one point higher after that reset.
    expect(up.points[1].payment).toBeGreaterThan(base.points[1].payment)
  })

  it('steps a 2+2 cadence from year 3', () => {
    const twoPlusTwo: ForecastTrackInput = {
      ...fiveYearVariable,
      type: 'variable',
      resetMonths: 24,
    }
    const forecast = buildForecast([twoPlusTwo], 0.02)
    const [base, up] = forecast.scenarios
    expect(forecast.resetYears).toEqual([3, 5, 7, 9])
    for (let year = 0; year < 2; year++) {
      expect(up.points[year].payment).toBeCloseTo(base.points[year].payment, 6)
    }
    expect(up.points[2].payment).toBeGreaterThan(base.points[2].payment)
  })

  it('carries the flat CPI path into cumulative indexation', () => {
    const indexed: ForecastTrackInput = {
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      resetMonths: 0,
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

describe('annualCostsFor', () => {
  it('turns cumulative points into yearly amounts that add back up', () => {
    const costs = annualCostsFor([
      { year: 1, payment: 0, cumulativeInterest: 1_000, cumulativeIndexation: 200 },
      { year: 2, payment: 0, cumulativeInterest: 1_900, cumulativeIndexation: 450 },
      { year: 3, payment: 0, cumulativeInterest: 2_700, cumulativeIndexation: 750 },
    ])

    expect(costs.map((cost) => cost.interest)).toEqual([1_000, 900, 800])
    expect(costs.map((cost) => cost.indexation)).toEqual([200, 250, 300])
    expect(costs.map((cost) => cost.cumulativeTotal)).toEqual([1_200, 2_350, 3_450])
    // The running total is the one the line plots: interest + indexation.
    expect(costs[2].cumulativeTotal).toBe(
      costs[2].cumulativeInterest + costs[2].cumulativeIndexation,
    )
  })

  it('telescopes to the same totals as the real forecast', () => {
    const indexed: ForecastTrackInput = {
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      resetMonths: 0,
    }
    const base = buildForecast([indexed], 0.02).scenarios[0]
    const costs = annualCostsFor(base.points)
    const last = costs[costs.length - 1]

    const yearlyInterest = costs.reduce((sum, cost) => sum + cost.interest, 0)
    const yearlyIndexation = costs.reduce((sum, cost) => sum + cost.indexation, 0)
    expect(yearlyInterest).toBeCloseTo(last.cumulativeInterest, 6)
    expect(yearlyIndexation).toBeCloseTo(last.cumulativeIndexation, 6)
    expect(last.cumulativeTotal).toBeCloseTo(
      last.cumulativeInterest + last.cumulativeIndexation,
      6,
    )
  })

  it('returns nothing for an empty forecast', () => {
    expect(annualCostsFor([])).toEqual([])
  })
})
