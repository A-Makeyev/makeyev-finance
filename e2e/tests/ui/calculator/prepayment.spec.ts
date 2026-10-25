import { test, expect } from '../../../fixtures'
import type { Locator } from '@playwright/test'

/** Reads a money cell as a number (formatted with ₪, commas and RTL marks). */
async function amountOf(locator: Locator): Promise<number> {
  const text = (await locator.innerText()).replace(/[^\d.]/g, '')
  return Number.parseFloat(text) || 0
}

test.describe('mortgage calculator - early-repayment fee', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
    await calc.page.getByTestId('prepayment-calculator').scrollIntoViewIfNeeded()
  })

  test('prices every track off the schedule, with the prime track exempt', async ({ calc }) => {
    const section = calc.page.getByTestId('prepayment-calculator')
    await expect(section).toBeVisible()
    // The prime track carries the statutory exemption instead of a figure.
    await expect(calc.page.getByTestId('prepayment-row-prime')).toBeVisible()
    await expect(calc.page.getByTestId('prepayment-fee-prime')).toContainText('פטור')

    // A comparison rate BELOW the contractual one has to produce a fee, and a
    // lower one still has to produce a bigger fee - the formula's whole point.
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const fixedAtTwo = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixedAtTwo).toBeGreaterThan(0)

    await calc.page.getByTestId('prepayment-market-rate').fill('1')
    const fixedAtOne = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixedAtOne).toBeGreaterThan(fixedAtTwo)

    // The total is the sum of the priced tracks (the exempt one adds nothing).
    const total = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(total).toBeGreaterThanOrEqual(fixedAtOne)
  })

  test('caps the fee at the origination average rate when one is entered', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const before = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(before).toBeGreaterThan(0)

    // Section 3(4): discount at the lower of the contractual rate and the
    // average rate at origination, so a lower C shrinks the fee.
    await calc.page.getByTestId('prepayment-cap').locator('summary').click()
    await calc.page.getByTestId('prepayment-cap-fixed').fill('3')
    const capped = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(capped).toBeGreaterThan(0)
    expect(capped).toBeLessThan(before)

    // An average above the contractual rate is not a cap; the fee comes back.
    await calc.page.getByTestId('prepayment-cap-fixed').fill('9')
    expect(await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))).toBeCloseTo(before, 0)
  })

  test('waives only the five-year reset track at an exit station', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const before = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(before).toBeGreaterThan(0)

    await calc.page.getByTestId('prepayment-exit-station').check()
    // The five-year indexed track is on its reset date, so it is waived.
    await expect(calc.page.getByTestId('prepayment-fee-variableIndexed5y')).toContainText('פטור')
    // The fixed track has no exit station, so it keeps its fee.
    const fixed = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixed).toBeGreaterThan(0)
    const after = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })

  test('puts the fee-free prime track first in the cheapest payoff order', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    await calc.page.getByTestId('prepayment-partial').fill('700000')

    const order = calc.page.getByTestId('prepayment-order')
    await expect(order).toBeVisible()
    // Cheapest shekels first: the exempt prime track, then a priced one.
    await expect(order.locator('li').first()).toContainText('פריים')
    await expect(order.locator('li').nth(1)).toBeVisible()

    // Each row carries its own amount and fee (the figures are cells of a
    // grid now, not one sentence), and the total repeats the allocated amount.
    const firstRow = order.locator('li').first()
    await expect(firstRow.locator('.prepayment-order-figure')).toHaveCount(2)
    await expect(firstRow).toContainText('סכום לפירעון')
    await expect(firstRow).toContainText('עמלת היוון')
    const allocated = await amountOf(firstRow.locator('.prepayment-order-value').first())
    expect(allocated).toBeGreaterThan(0)
    await expect(order.getByTestId('prepayment-order-fee')).toBeVisible()
  })

  test('models the partial amount as a shorter term or a lower payment', async ({ calc }) => {
    // The outcomes need an amount to act on; the field alone shows nothing.
    await expect(calc.page.getByTestId('prepayment-outcomes')).toHaveCount(0)
    await calc.page.getByTestId('prepayment-partial').fill('300000')

    const shortenPayment = await amountOf(calc.page.getByTestId('prepayment-shorten-payment'))
    const lowerPayment = await amountOf(calc.page.getByTestId('prepayment-lower-payment'))
    expect(shortenPayment).toBeGreaterThan(0)
    expect(lowerPayment).toBeGreaterThan(0)
    // Lowering the payment always costs less per month than keeping it.
    expect(lowerPayment).toBeLessThan(shortenPayment)

    // One card keeps the payment and cuts the term, the other keeps the term
    // and states the payment it replaces.
    await expect(calc.page.getByTestId('prepayment-shorten-term')).toContainText('מ-')
    await expect(calc.page.getByTestId('prepayment-shorten-term')).toContainText('ל-')
    await expect(calc.page.getByTestId('prepayment-lower-term')).toContainText('התקופה נשארת')
    await expect(calc.page.getByTestId('prepayment-outcome-lower')).toContainText('במקום')
    await expect(calc.page.getByTestId('prepayment-outcome-shorten')).toContainText(
      'ריבית שנותרה',
    )

    // The amount is 30% of the mix, so every track's remaining term falls:
    // the shortened term is genuinely shorter than the unchanged one.
    const shortenedTerm = await calc.page.getByTestId('prepayment-shorten-term').innerText()
    const unchangedTerm = await calc.page.getByTestId('prepayment-lower-term').innerText()
    expect(shortenedTerm).not.toBe(unchangedTerm)
  })

  test('fits the two outcome cards on a 360px phone', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await calc.page.getByTestId('prepayment-partial').fill('300000')
    const outcomes = calc.page.getByTestId('prepayment-outcomes')
    await outcomes.scrollIntoViewIfNeeded()
    await expect(outcomes).toBeVisible()

    const overflow = (await calc.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
    // The card stays inside the viewport at phone widths.
    const rect = (await calc.page.evaluate(`(() => {
      const el = document.querySelector('[data-testid="prepayment-outcomes"]')
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, viewport: window.innerWidth }
    })()`)) as { left: number; right: number; viewport: number }
    expect(rect.left).toBeGreaterThanOrEqual(-1)
    expect(rect.right).toBeLessThanOrEqual(rect.viewport + 1)
  })

  test('charts the fee against the repayment date and lets a click move the date', async ({
    calc,
  }) => {
    const chart = calc.page.getByTestId('prepayment-chart')
    await expect(chart).toBeVisible()
    // One line per track; the exempt ones sit flat on zero, so the count is
    // the assertion rather than the visibility of any single path.
    expect(await chart.locator('path.chart-line-track').count()).toBeGreaterThan(0)
    // The chosen date is marked on the plot, without hovering (a vertical
    // line has no area, so it is counted rather than "visible").
    await expect(chart.locator('line.forecast-selected-line')).toHaveCount(1)

    // The card spans the panel like the fee table and the stat cards, rather
    // than sitting as a half-row strip in the middle of it.
    const span = await chart.evaluate((node) => {
      const card = node.closest('.prepayment-chart-card')
      const parent = card?.parentElement
      if (!card || !parent) return null
      const style = getComputedStyle(parent)
      return {
        card: card.getBoundingClientRect().width,
        content:
          parent.getBoundingClientRect().width -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
      }
    })
    expect(span).not.toBeNull()
    // A border and rounding can shave a pixel or two; half a row would be ~50%.
    expect(span!.card).toBeGreaterThan(span!.content * 0.95)

    // Clicking the middle of the plot selects the year under the cursor
    // (year 7 of the default term) and the date field follows.
    await chart.scrollIntoViewIfNeeded()
    const box = await chart.locator('svg').boundingBox()
    expect(box).not.toBeNull()
    await calc.page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(calc.page.getByTestId('prepayment-years')).toHaveValue('7')

    // The same figures are readable as a table, one row per loan year, with no
    // toggle in front of them.
    const table = calc.page.getByTestId('prepayment-chart-table')
    await expect(table.locator('summary')).toHaveCount(0)
    await expect(table.locator('tbody tr')).toHaveCount(14)
    await expect(table.locator('tbody tr').first()).toContainText('₪')
  })

  test('places the fee chart and its scrolling table on one row, chart on the right', async ({
    calc,
  }) => {
    const chartColumn = calc.page.locator('.prepayment-chart')
    const tableColumn = calc.page.getByTestId('prepayment-chart-table')
    await chartColumn.scrollIntoViewIfNeeded()
    const chartBox = await chartColumn.boundingBox()
    const tableBox = await tableColumn.boundingBox()
    expect(chartBox).not.toBeNull()
    expect(tableBox).not.toBeNull()
    // Same grid row, graph on the right in Hebrew.
    expect(Math.abs(chartBox!.y - tableBox!.y)).toBeLessThan(3)
    expect(chartBox!.x).toBeGreaterThan(tableBox!.x)
    // The table column takes the chart column's height, and its own scroller
    // holds the rows instead of growing the card.
    expect(Math.abs(chartBox!.height - tableBox!.height)).toBeLessThan(3)
    const scroller = tableColumn.locator('.prepayment-chart-table')
    const measure = await scroller.evaluate((node) => ({
      overflowY: getComputedStyle(node).overflowY,
      scrollbarWidth: getComputedStyle(node).scrollbarWidth,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }))
    expect(measure.overflowY).toBe('auto')
    expect(measure.scrollHeight).toBeGreaterThan(measure.clientHeight)
    // The fee table scrolls without a visible thumb, like every inner scroller;
    // only the document itself keeps a bar.
    expect(measure.scrollbarWidth).toBe('none')
    const bars = await calc.page.evaluate(() => ({
      table: getComputedStyle(document.querySelector('.prepayment-chart-table')!).scrollbarWidth,
      schedule: getComputedStyle(document.querySelector('.schedule-content .table-wrap')!)
        .scrollbarWidth,
      html: getComputedStyle(document.documentElement).scrollbarWidth,
    }))
    expect(bars.table, 'prepayment table bar hidden').toBe('none')
    expect(bars.schedule, 'schedule table bar hidden').toBe('none')
    expect(bars.html, 'document scrollbar stays visible').toBe('auto')

    // With no bar to drag, the scroller is a focusable region instead: it takes
    // Tab focus and the keyboard scrolls it.
    await expect(scroller).toHaveAttribute('tabindex', '0')
    await expect(scroller).toHaveAttribute('role', 'region')
    await scroller.focus()
    await expect(scroller).toBeFocused()
    await calc.page.keyboard.press('PageDown')
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0)

    // The "click the chart" hint is the plot's own instruction: it sits under
    // the graph column (not centered across the card, under the table), and
    // the plot shows a pointer because a click picks that year.
    const column = await chartColumn.boundingBox()
    const caption = await calc.page.locator('.prepayment-chart-caption').boundingBox()
    expect(column).not.toBeNull()
    expect(caption).not.toBeNull()
    expect(caption!.y).toBeGreaterThanOrEqual(column!.y + column!.height - 1)
    expect(caption!.x + caption!.width / 2).toBeCloseTo(column!.x + column!.width / 2, 0)
    expect(await calc.page.locator('.prepayment-chart svg').evaluate((node) => getComputedStyle(node).cursor)).toBe(
      'pointer',
    )
  })

  test('stops the date at the last year that still has a balance', async ({ calc }) => {
    // The default term is 15 years, so the last year with something to price is
    // 14. A year past that is pulled back to it rather than left dangling over
    // an empty result: the field, its max and the hint all agree on 14.
    const years = calc.page.getByTestId('prepayment-years')
    await expect(years).toHaveAttribute('max', '14')
    await expect(calc.page.locator('#prepayment-years-hint')).toContainText('14')

    await years.fill('30')
    await expect(years).toHaveValue('14')
    await expect(calc.page.getByTestId('prepayment-total')).toBeVisible()
    await expect(calc.page.getByTestId('prepayment-empty')).toHaveCount(0)

    // The field still takes a year inside the range, so the clamp is not a lock.
    await years.fill('3')
    await expect(years).toHaveValue('3')
    await expect(calc.page.getByTestId('prepayment-total')).toBeVisible()
  })

  test('marks an entered cap as applied or not, per priced track', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    await calc.page.getByTestId('prepayment-cap').locator('summary').click()

    // The default mix has three tracks but only two cap fields: the exempt
    // prime track has no fee, and the block names it so the count is clear.
    await expect(calc.page.getByTestId('prepayment-cap-exempt')).toContainText('פריים')

    const status = calc.page.getByTestId('prepayment-cap-status-fixed')
    await expect(status).toHaveAttribute('data-active', 'false')
    await calc.page.getByTestId('prepayment-cap-fixed').fill('3')
    await expect(status).toHaveAttribute('data-active', 'true')
    await calc.page.getByTestId('prepayment-cap-fixed').fill('9')
    await expect(status).toHaveAttribute('data-active', 'false')

    // An exempt track has no fee to cap, so it has no field at all.
    await expect(calc.page.getByTestId('prepayment-cap-prime')).toHaveCount(0)
  })

  test('keeps the fee chart when every fee is zero', async ({ calc }) => {
    // A comparison rate above every track rate floors all fees at zero. The
    // chart has to show its baseline; it used to disappear with the card's
    // whole plot when the maximum value was zero.
    await calc.page.getByTestId('prepayment-market-rate').fill('20')
    const chart = calc.page.getByTestId('prepayment-chart')
    await expect(chart).toBeVisible()
    await expect(chart.locator('path.chart-line-track')).toHaveCount(3)
  })
})

test.describe('early-repayment fee in English (LTR)', () => {
  test.use({ language: 'english' })

  test('renders its own heading and table', async ({ localizedCalc }) => {
    await localizedCalc.goto()
    const section = localizedCalc.page.getByTestId('prepayment-calculator')
    await section.scrollIntoViewIfNeeded()
    await expect(section.locator('h2')).toHaveText('Early-repayment fee')
    await expect(localizedCalc.page.getByTestId('prepayment-total')).toBeVisible()
  })

  test('puts the fee chart on the left and the table on the right (LTR)', async ({
    localizedCalc,
  }) => {
    await localizedCalc.goto()
    const chartColumn = localizedCalc.page.locator('.prepayment-chart')
    const tableColumn = localizedCalc.page.getByTestId('prepayment-chart-table')
    await chartColumn.scrollIntoViewIfNeeded()
    const chartBox = await chartColumn.boundingBox()
    const tableBox = await tableColumn.boundingBox()
    expect(chartBox).not.toBeNull()
    expect(tableBox).not.toBeNull()
    expect(Math.abs(chartBox!.y - tableBox!.y)).toBeLessThan(3)
    expect(chartBox!.x).toBeLessThan(tableBox!.x)
    expect(Math.abs(chartBox!.height - tableBox!.height)).toBeLessThan(3)
  })

  test('names both partial-prepayment outcomes in English', async ({ localizedCalc }) => {
    await localizedCalc.goto()
    await localizedCalc.page.getByTestId('prepayment-partial').fill('300000')
    const outcomes = localizedCalc.page.getByTestId('prepayment-outcomes')
    await expect(outcomes).toContainText('Finish earlier')
    await expect(outcomes).toContainText('Lower the payment')
    await expect(outcomes).toContainText('Term stays')
  })
})
