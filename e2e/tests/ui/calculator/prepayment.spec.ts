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
    const market = calc.page.getByTestId('prepayment-market-rate')
    await market.fill('2')
    // What was typed stays in the field. Binding the input to the suggestion
    // used to blank it on the first keystroke while the figures still moved.
    await expect(market).toHaveValue('2')
    const fixedAtTwo = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixedAtTwo).toBeGreaterThan(0)

    await market.fill('1')
    await expect(market).toHaveValue('1')
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

  test('prices the reader\'s own split, cheapest track first', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    // Two tracks, two amounts: the bank repays the tracks the reader names.
    await calc.page.getByTestId('prepayment-allocate-prime').fill('50000')
    await calc.page.getByTestId('prepayment-allocate-fixed').fill('100000')

    const order = calc.page.getByTestId('prepayment-order')
    await expect(order).toBeVisible()
    // Cheapest shekels first: the exempt prime track, then a priced one.
    await expect(order.locator('li').first()).toContainText('פריים')
    await expect(order.locator('li')).toHaveCount(3)

    // Each row is priced on its own amount, so the exempt track stays free
    // and the fixed track carries its own pro-rata fee.
    expect(await amountOf(calc.page.getByTestId('prepayment-allocate-fee-prime'))).toBe(0)
    expect(await amountOf(calc.page.getByTestId('prepayment-allocate-fee-fixed'))).toBeGreaterThan(0)

    // The total is the reader's two amounts added up, fee included.
    expect(await amountOf(calc.page.getByTestId('prepayment-order-total-amount'))).toBe(150_000)
    expect(await amountOf(order.getByTestId('prepayment-order-fee'))).toBeGreaterThan(0)
  })

  test('spreads a total across the mixes, then moves money inside it', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const total = calc.page.getByTestId('prepayment-partial')
    await total.fill('20000')

    // Prime is the cheapest shekel (exempt), so the total starts there.
    const prime = calc.page.getByTestId('prepayment-allocate-prime')
    const fixed = calc.page.getByTestId('prepayment-allocate-fixed')
    await expect(prime).toHaveValue('20,000')
    expect(await amountOf(calc.page.getByTestId('prepayment-allocate-fee-prime'))).toBe(0)
    expect(await amountOf(calc.page.getByTestId('prepayment-order-total-amount'))).toBe(20_000)

    // Moving 15k to the fixed track takes it out of prime, so the total holds
    // and the fixed share now carries the fee that prime does not.
    await fixed.fill('15000')
    await expect(prime).toHaveValue('5,000')
    await expect(total).toHaveValue('20,000')
    expect(await amountOf(calc.page.getByTestId('prepayment-allocate-fee-fixed'))).toBeGreaterThan(0)
    expect(await amountOf(calc.page.getByTestId('prepayment-order-total-amount'))).toBe(20_000)

    // Taking prime to zero leaves 5k of the total unallocated. The panel names
    // the gap and the fill button puts it back on the cheapest track.
    await prime.fill('0')
    await expect(calc.page.getByTestId('prepayment-order-remaining')).toContainText('5,000')
    await calc.page.getByTestId('prepayment-order-fill').click()
    await expect(prime).toHaveValue('5,000')
    await expect(calc.page.getByTestId('prepayment-order-remaining')).toHaveCount(0)
  })

  test('caps each track amount at that track balance', async ({ calc }) => {
    const field = calc.page.getByTestId('prepayment-allocate-fixed')
    await field.fill('99999999')
    const typed = Number.parseFloat((await field.inputValue()).replace(/[^\d.]/g, ''))
    const balance = await amountOf(
      calc.page.getByTestId('prepayment-row-fixed').locator('td').nth(1),
    )

    // The field shows the balance it will actually repay, not the typed number.
    expect(typed).toBeCloseTo(balance, 0)
    expect(await amountOf(calc.page.getByTestId('prepayment-order-total-amount'))).toBeCloseTo(
      balance,
      0,
    )
  })

  test('models the partial amount as a shorter term or a lower payment', async ({ calc }) => {
    // The outcomes need an amount to act on; the fields alone show nothing.
    await expect(calc.page.getByTestId('prepayment-outcomes')).toHaveCount(0)
    await calc.page.getByTestId('prepayment-allocate-fixed').fill('100000')
    await calc.page.getByTestId('prepayment-allocate-variableIndexed5y').fill('100000')

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

    // The amount is spread over two tracks, so the remaining term falls:
    // the shortened term is genuinely shorter than the unchanged one.
    const shortenedTerm = await calc.page.getByTestId('prepayment-shorten-term').innerText()
    const unchangedTerm = await calc.page.getByTestId('prepayment-lower-term').innerText()
    expect(shortenedTerm).not.toBe(unchangedTerm)
  })

  test('fits the two outcome cards on a 360px phone', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await calc.page.getByTestId('prepayment-allocate-fixed').fill('100000')
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

    // The year cells are row headers, so they must not inherit the table
    // header's teal 2px accent: they carry the same hairline as the row.
    const borderOf = (selector: string) =>
      table
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).borderBottomColor)
    expect(await borderOf('tbody th')).toBe(await borderOf('tbody td'))
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

  test('shows the loyalty discount as a step in the fee', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    // The section opens on year 5, where the 30% reduction applies.
    const discount = calc.page.getByTestId('prepayment-discount')
    await expect(discount).toBeVisible()
    await expect(discount).toContainText('30')

    const gross = await amountOf(calc.page.getByTestId('prepayment-discount-gross'))
    const off = await amountOf(calc.page.getByTestId('prepayment-discount-amount'))
    const after = await amountOf(calc.page.getByTestId('prepayment-discount-after'))
    const total = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(gross).toBeGreaterThan(0)
    // The ladder adds up exactly, and its last line is the table's own total.
    expect(gross - off).toBe(after)
    expect(after).toBe(total)
    expect(off / gross).toBeCloseTo(0.3, 1)

    // Before year 3 the law applies no reduction, so there is no step to show.
    await calc.page.getByTestId('prepayment-years').fill('2')
    await expect(discount).toHaveCount(0)
  })

  test('names the exemption behind each zeroed track', async ({ calc }) => {
    // Each exempt row says which rule excused it, not just that it is exempt.
    await expect(calc.page.getByTestId('prepayment-fee-prime')).toHaveText('פטור (פריים)')
    await calc.page.getByTestId('prepayment-exit-station').check()
    await expect(calc.page.getByTestId('prepayment-fee-variableIndexed5y')).toHaveText(
      'פטור (תחנת יציאה)',
    )
  })

  test('adds the fees charged on top, with their own controls', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const extras = calc.page.getByTestId('prepayment-extras')
    await extras.locator('summary').click()

    // The handling fee is per track and the default mix has three.
    await expect(calc.page.getByTestId('prepayment-extras-operational')).toContainText('180')
    await expect(calc.page.getByTestId('prepayment-extras-no-notice-amount')).toContainText('0')
    await expect(calc.page.getByTestId('prepayment-extras-cpi-amount')).toContainText('0')

    const fee = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(await amountOf(calc.page.getByTestId('prepayment-extras-total'))).toBe(fee + 180)

    // Both request-level charges are off until asked for, then they add up.
    await calc.page.getByTestId('prepayment-extras-no-notice').check()
    await calc.page.getByTestId('prepayment-extras-cpi').check()
    const noNotice = await amountOf(calc.page.getByTestId('prepayment-extras-no-notice-amount'))
    const cpi = await amountOf(calc.page.getByTestId('prepayment-extras-cpi-amount'))
    // The default mix carries an indexed track, so both are real numbers.
    expect(noNotice).toBeGreaterThan(0)
    expect(cpi).toBeGreaterThan(0)
    const withExtras = await amountOf(calc.page.getByTestId('prepayment-extras-total'))
    expect(withExtras).toBe(fee + 180 + noNotice + cpi)

    // The block fits a phone with both switches on: no sideways scroll.
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await extras.scrollIntoViewIfNeeded()
    const overflow = (await calc.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('ranks the tracks before any amount is entered', async ({ calc }) => {
    // The list answers "which track first" on its own; it used to be hidden
    // until the reader typed a partial amount.
    const order = calc.page.getByTestId('prepayment-order')
    await expect(order).toBeVisible()
    await expect(order.locator('li').first()).toContainText('פריים')
    await expect(calc.page.getByTestId('prepayment-order-first')).toBeVisible()
    // Every row carries its own amount field and its cost per ₪1,000.
    await expect(order.locator('li').first().locator('.input-wrap')).toHaveCount(1)
    await expect(order.locator('li').first()).toContainText('עמלה לכל 1,000')
    // With nothing entered there is no partial prepayment to total up.
    await expect(order.getByTestId('prepayment-order-fee')).toHaveCount(0)

    // The section names the mix it prices: one mix, this many tracks.
    await expect(calc.page.getByTestId('prepayment-mix-line')).toContainText('התמהיל הנוכחי')

    // One amount is enough to start: the totals appear beside the rows.
    await calc.page.getByTestId('prepayment-allocate-prime').fill('100000')
    await expect(order.getByTestId('prepayment-order-fee')).toBeVisible()
    await expect(order.getByTestId('prepayment-order-total-amount')).toContainText('סכום לפירעון')
  })

  test('puts the split under the controls and the outcomes above the cap', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-allocate-fixed').fill('100000')

    // The requested reading order: amount first, then the split that spends
    // it, then the summary. The outcomes explain the split, so they sit above
    // the optional section 3(4) cap rather than after it.
    const tops = (await calc.page.evaluate(`(() => {
      const top = (id) => {
        const el = document.querySelector('[data-testid="' + id + '"]')
        return el ? el.getBoundingClientRect().top + window.scrollY : null
      }
      return {
        amount: top('prepayment-partial'),
        order: top('prepayment-order'),
        stats: top('prepayment-kpi-total'),
        outcomes: top('prepayment-outcomes'),
        cap: top('prepayment-cap'),
      }
    })()`)) as Record<string, number | null>

    expect(tops.amount, 'partial amount field rendered').not.toBeNull()
    expect(tops.order, 'order panel rendered').not.toBeNull()
    expect(tops.stats, 'summary rendered').not.toBeNull()
    expect(tops.outcomes, 'outcomes rendered').not.toBeNull()
    expect(tops.cap, 'cap disclosure rendered').not.toBeNull()

    expect(tops.order!).toBeGreaterThan(tops.amount!)
    expect(tops.stats!).toBeGreaterThan(tops.order!)
    expect(tops.outcomes!).toBeGreaterThan(tops.stats!)
    expect(tops.cap!).toBeGreaterThan(tops.outcomes!)
  })

  test('totals several track amounts and keeps each fee separate', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const order = calc.page.getByTestId('prepayment-order')

    // Two amounts on two different tracks, one of them the free prime track.
    await calc.page.getByTestId('prepayment-allocate-prime').fill('40000')
    await calc.page.getByTestId('prepayment-allocate-fixed').fill('60000')

    const primeFee = await amountOf(calc.page.getByTestId('prepayment-allocate-fee-prime'))
    const fixedFee = await amountOf(calc.page.getByTestId('prepayment-allocate-fee-fixed'))
    expect(primeFee).toBe(0)
    expect(fixedFee).toBeGreaterThan(0)

    // The block's total is exactly the two rows, fee included.
    expect(await amountOf(order.getByTestId('prepayment-order-fee'))).toBeCloseTo(fixedFee, 0)
    expect(await amountOf(order.getByTestId('prepayment-order-total-amount'))).toBe(100_000)
    expect(await amountOf(calc.page.getByTestId('prepayment-total'))).toBeGreaterThanOrEqual(
      fixedFee,
    )
  })

  test('fills the rate-addition column, including an explicit zero', async ({ calc }) => {
    // A comparison rate below the contractual one puts a real figure in.
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    await expect(calc.page.getByTestId('prepayment-rate-addition-fixed')).toHaveText(/^[\d.]+%$/)

    // Above every track rate there is no fee: the column says 0% instead of
    // looking broken, and the panel says why. The exempt track keeps '-'.
    await calc.page.getByTestId('prepayment-market-rate').fill('20')
    await expect(calc.page.getByTestId('prepayment-rate-addition-fixed')).toHaveText('0%')
    await expect(calc.page.getByTestId('prepayment-rate-addition-variableIndexed5y')).toHaveText(
      '0%',
    )
    await expect(calc.page.getByTestId('prepayment-rate-addition-prime')).toHaveText('-')
    await expect(calc.page.getByTestId('prepayment-calculator')).toContainText(
      'אין עמלת היוון לאף מסלול',
    )
  })

  test('keeps the four penalty facts next to the fee they explain', async ({ calc }) => {
    const note = calc.page.getByTestId('prepayment-calculator').getByTestId('prepayment-note')
    await expect(note).toBeVisible()
    // It is no longer in the input column, where it used to sit under the
    // warning before the fee panel could price anything.
    await expect(calc.page.locator('form [data-testid="prepayment-note"]')).toHaveCount(0)

    await note.locator('summary').click()
    await expect(calc.page.getByTestId('prepayment-penalty-facts').locator('li')).toHaveCount(4)
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
    await localizedCalc.page.getByTestId('prepayment-allocate-fixed').fill('100000')
    const outcomes = localizedCalc.page.getByTestId('prepayment-outcomes')
    await expect(outcomes).toContainText('Finish earlier')
    await expect(outcomes).toContainText('Lower the payment')
    await expect(outcomes).toContainText('Term stays')
  })
})
