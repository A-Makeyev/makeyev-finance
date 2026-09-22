import { test, expect } from '../../../fixtures'

test.describe('mortgage calculator - amortization schedule', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('schedule always shows the full horizon, with no expand button', async ({ calc }) => {
    // Default term is 15y - the full 15 rows render, no expand control.
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)

    await calc.termSlider.fill('30')
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(30)
  })

  test('monthly schedule tab relabels the payment axis and matches yearly label density', async ({
    calc,
  }) => {
    // The chart is fed from the same rows the table renders, so the two tabs
    // plot one curve at two granularities. What must NOT be the same is the
    // payments axis: a yearly row carries 12 payments, a monthly row one, so
    // the same label over both scales would misstate every figure by 12x.
    const probe = `(() => {
      const chart = document.querySelector('[data-testid="amortization-chart"]')
      if (!chart) return null
      const svg = chart.querySelector('svg')
      return {
        bars: svg.querySelectorAll('rect.chart-bar').length,
        areas: svg.querySelectorAll('path.chart-area').length,
        titles: [...svg.querySelectorAll('text.chart-axis-title')].map((n) => n.textContent),
        xLabels: [...svg.querySelectorAll('text.chart-tick')]
          .filter((n) => n.getAttribute('y') === '296')
          .map((n) => n.textContent)
      }
    })()`

    const yearly = (await calc.page.evaluate(probe)) as {
      bars: number
      areas: number
      titles: string[]
      xLabels: string[]
    } | null
    expect(yearly, 'chart rendered').not.toBeNull()
    // 15 yearly rows: 15 stacked bars (principal + interest rects), no area.
    expect(yearly!.bars).toBe(30)
    expect(yearly!.areas).toBe(0)
    expect(yearly!.titles).toContain('תשלום שנתי')
    expect(yearly!.xLabels).toHaveLength(15)

    await calc.page.getByTestId('schedule-granularity-monthly').click()
    const monthly = (await calc.page.evaluate(probe)) as typeof yearly
    // 180 monthly rows cannot be bars: the same curve becomes two areas.
    expect(monthly!.bars).toBe(0)
    expect(monthly!.areas).toBe(2)
    // The payments axis is scaled to ONE payment now, so it has to say so.
    expect(monthly!.titles).toContain('תשלום חודשי')
    expect(monthly!.titles).not.toContain('תשלום שנתי')
    // Year-boundary labels stay exactly as dense as the yearly tab's.
    expect(monthly!.xLabels).toEqual(yearly!.xLabels)

    // The tooltip's payment line follows the same mode (and names months).
    await calc.page.locator('[data-testid="amortization-chart"] svg').hover()
    const tooltip = calc.page.locator('.chart-tooltip')
    await expect(tooltip).toContainText('תשלום חודשי')
    await expect(tooltip).not.toContainText('תשלום שנתי')
  })

  test('per-track chart follows the monthly tab like the total view does', async ({ calc }) => {
    await calc.page.getByTestId('schedule-view-separate').click()

    // Per-track plot: one balance line per track. Labeled x ticks sit at
    // y = HEIGHT - 36 in this chart's 560-unit viewBox.
    const probe = `(() => {
      const chart = document.querySelector('[data-testid="per-track-chart"]')
      if (!chart) return null
      const svg = chart.querySelector('svg')
      const lines = [...svg.querySelectorAll('path.chart-line-track')]
      return {
        lines: lines.length,
        points: lines.map((line) => (line.getAttribute('d') || '').split('L').length),
        xLabels: [...svg.querySelectorAll('text.chart-tick')]
          .filter((n) => n.getAttribute('y') === '524')
          .map((n) => n.textContent)
      }
    })()`

    const yearly = (await calc.page.evaluate(probe)) as {
      lines: number
      points: number[]
      xLabels: string[]
    } | null
    expect(yearly, 'per-track chart rendered').not.toBeNull()
    // Three tracks over 15 years: three polylines of 15 points each.
    expect(yearly!.lines).toBe(3)
    expect(yearly!.points).toEqual([15, 15, 15])
    expect(yearly!.xLabels).toHaveLength(15)

    await calc.page.getByTestId('schedule-granularity-monthly').click()
    const monthly = (await calc.page.evaluate(probe)) as typeof yearly
    // Monthly: the same lines, one point per month (180), so the chart and the
    // tables under it can never disagree about the schedule's granularity.
    expect(monthly!.points).toEqual([180, 180, 180])
    // Year-boundary labels keep the yearly density.
    expect(monthly!.xLabels).toEqual(yearly!.xLabels)

    // And the tooltip names months, not years, in this mode.
    await calc.page.locator('[data-testid="per-track-chart"] svg').hover()
    const tooltip = calc.page.locator('[data-testid="per-track-chart"] .chart-tooltip')
    await expect(tooltip).toContainText('חודש')
    await expect(tooltip).not.toContainText('שנה')
  })

  test('no schedule table is shown while no loan is entered', async ({ calc }) => {
    // The default preset (basket4) fills the tables - clear every track so
    // nothing is left to calculate, then check the header-only table is gone.
    for (let index = 1; index <= 3; index++) {
      await calc.track(index).setAmount('')
    }
    await expect(calc.page.getByTestId('schedule-body')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(0)
    await expect(calc.page.locator('.schedule-empty')).toBeVisible()

    // A real amount brings the full 15-year table back (fixed-rate track,
    // so the variable-share cap doesn't block the calculation).
    await calc.track(1).setType('fixed')
    await calc.track(1).setAmount('500,000')
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)
  })
})
