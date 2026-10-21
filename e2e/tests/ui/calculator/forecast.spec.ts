import { test, expect } from '../../../fixtures'

test.describe('mortgage calculator - rate and CPI forecast', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('steps the payment at each five-year reset and keeps the paths ordered', async ({
    calc,
  }) => {
    const forecast = calc.forecast
    await forecast.scrollTo()
    await expect(forecast.root).toBeVisible()
    await expect(forecast.resetChart).toBeVisible()
    await expect(forecast.costChart).toBeVisible()

    // The default mix has a 15-year five-year variable track: years 6 and 11.
    await expect(forecast.resetCaption).toContainText('מועדי עדכון ריבית בשנים 6 ו-11')
    await forecast.openResetTable()

    // Before the first reset every path is the same rate, so the same payment.
    const before = await forecast.resetPayments(5)
    expect(before.up).toBeCloseTo(before.base, 0)
    expect(before.down).toBeCloseTo(before.base, 0)

    // At year 6 the +1pp path pays more than base, which pays more than -1pp.
    const atReset = await forecast.resetPayments(6)
    expect(atReset.up).toBeGreaterThan(atReset.base)
    expect(atReset.base).toBeGreaterThan(atReset.down)
    // A one-point move is not a rounding wobble.
    expect(atReset.up - atReset.base).toBeGreaterThan(50)

    // Both rows the chart marks as resets are the stepped ones, and the step
    // repeats at the year-11 reset.
    await expect(forecast.resetRows).toHaveCount(2)
    await expect(forecast.resetRows.nth(1)).toContainText('11')
    const last = await forecast.resetPayments(11)
    expect(last.up).toBeGreaterThan(last.base)
  })

  test('shows cumulative interest against indexation for the base path', async ({ calc }) => {
    const forecast = calc.forecast
    await forecast.scrollTo()
    await forecast.openCostTable()

    // The default mix holds an indexed track, so both columns are present.
    await expect(forecast.costTable.locator('thead th')).toHaveCount(3)
    await expect(forecast.costTable.locator('thead')).toContainText('הצמדה מצטברת')

    const first = await forecast.costTotals(1)
    const last = await forecast.costTotals(15)

    // Interest accrues every year; indexation accrues on the indexed track.
    expect(last.interest).toBeGreaterThan(first.interest)
    expect(first.indexation).toBeGreaterThan(0)
    expect(last.indexation).toBeGreaterThan(first.indexation)
  })

  test('replaces the reset chart with an explanation when no reset remains', async ({
    calc,
  }) => {
    // A five-year indexed track ends on its first reset date, so the mix has
    // indexation to forecast but no contractual reset inside its term.
    await calc.track(3).years().fill('5')
    await calc.track(3).years().blur()

    const forecast = calc.forecast
    await forecast.scrollTo()
    await expect(forecast.noResetNote).toBeVisible()
    await expect(forecast.resetChart).toHaveCount(0)
    await expect(forecast.resetTable).toHaveCount(0)
    // The cost chart stays: there is still indexation to show.
    await expect(forecast.costChart).toBeVisible()
  })

  test('stays out of a mix with neither a reset nor indexation', async ({ calc }) => {
    await calc.selectPreset('basket1')
    await expect(calc.forecast.root).toHaveCount(0)

    // Two tracks but still fixed + prime: nothing forward-looking to add.
    await calc.selectPreset('basket2')
    await expect(calc.forecast.root).toHaveCount(0)
  })

  test('fits a 360px phone without a sideways scroll', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await calc.forecast.scrollTo()
    await expect(calc.forecast.resetChart).toBeVisible()

    const overflow = await calc.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )
    expect(overflow as number).toBeLessThanOrEqual(1)
  })
})

test.describe('rate and CPI forecast in English (LTR)', () => {
  test.use({ language: 'english' })

  test('renders its heading, assumptions and reset years in English', async ({
    localizedCalc,
  }) => {
    await localizedCalc.goto()
    const forecast = localizedCalc.forecast
    await forecast.scrollTo()

    await expect(forecast.heading).toHaveText('Rate and CPI forecast')
    await expect(forecast.lead).toContainText('1 percentage point')
    await expect(forecast.resetCaption).toHaveText('Rate resets in years 6 and 11.')
    await expect(forecast.disclaimer).toContainText(
      'The forecast is an illustration only, not a forecast of rates or the CPI.',
    )

    await forecast.openResetTable()
    await expect(forecast.resetTable.locator('thead')).toContainText(
      'A 1 pp rise at every reset',
    )
  })
})
