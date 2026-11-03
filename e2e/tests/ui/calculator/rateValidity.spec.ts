import { test, expect } from '../../../fixtures'
import type { CalculatorPage } from '../../../pages/CalculatorPage'

/**
 * אישור עקרוני rate validity: the rate quoted in a mortgage pre-approval holds
 * for a fixed window (24 days, Bank of Israel), so both the calculator and the
 * comparison report how long the quoted rates are still good for. The window
 * itself is hand-checked against concrete dates in
 * tests/unit/rateValidity.test.ts; this drives the real UI, including that the
 * date travels from the calculator into the comparison.
 */

/** A date-only 'YYYY-MM-DD' `offsetDays` from today, in local calendar terms. */
function dateOnly(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Today + 24 days: the last day a quote entered today still holds. */
function lastValidDay(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 24)
  return date
}

test.describe('mortgage calculator - אישור עקרוני rate validity', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('shows no chip until a date is entered, and drops it when cleared', async ({ calc }) => {
    await expect(calc.rateValidityChip).toHaveCount(0)
    await calc.setApprovalDate(dateOnly(0))
    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'valid')
    await calc.setApprovalDate('')
    await expect(calc.rateValidityChip).toHaveCount(0)
  })

  test('typing a date keeps the day and month segments', async ({ calc }) => {
    // Typed one digit at a time: the mask inserts the separators and the date
    // is never rewritten behind the caret.
    await calc.typeApprovalDate('10102020')
    await expect(calc.approvalDateIcon).toBeVisible()
    await expect(calc.approvalDate).toHaveValue('10/10/2020')
    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expired')
  })

  test('a day above 31 or a month above 12 moves to the next part', async ({ calc }) => {
    await calc.approvalDate.fill('')
    await calc.typeApprovalDate('32')
    // 32 is not a day, so the 2 starts the month instead of being dropped.
    await expect(calc.approvalDate).toHaveValue('3/2')
    // 20 is not a month either, so the 0 starts the year.
    await calc.typeApprovalDate('0')
    await expect(calc.approvalDate).toHaveValue('3/2/0')
    // No segment ever holds an out-of-range day or month.
    await expect(calc.approvalDate).toHaveValue(/^(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d*$/)
  })

  test('a one-digit month keeps formatting and reaches the year', async ({ calc }) => {
    await calc.approvalDate.fill('')
    // Typed as day 30, month 3, year 2025 without pressing "/".
    await calc.typeApprovalDate('3032025')
    await expect(calc.approvalDate).toHaveValue('30/3/2025')
    await calc.approvalDate.press('Tab')
    await expect(calc.approvalDate).toHaveValue('30/03/2025')
    // The typed date is a real one, so the validity chip reports it.
    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expired')
  })

  test('a one-digit 4-9 shows the next slash immediately', async ({ calc }) => {
    await calc.approvalDate.fill('')
    await calc.typeApprovalDate('4')
    await expect(calc.approvalDate).toHaveValue('4/')
    await calc.typeApprovalDate('5')
    await expect(calc.approvalDate).toHaveValue('4/5/')
    await calc.typeApprovalDate('2025')
    await expect(calc.approvalDate).toHaveValue('4/5/2025')
  })

  test('deleting from the end continues through the year into the month', async ({ calc }) => {
    await calc.setApprovalDate('2026-12-17')
    await expect(calc.approvalDate).toHaveValue('17/12/2026')
    await calc.approvalDate.press('End')

    for (const value of ['17/12/202', '17/12/20', '17/12/2', '17/12', '17/1']) {
      await calc.approvalDate.press('Backspace')
      await expect(calc.approvalDate).toHaveValue(value)
    }
  })

  test('editing inside the month keeps the year and the caret', async ({ calc }) => {
    await calc.setApprovalDate('2026-12-17')
    await calc.approvalDate.evaluate((element) => {
      const input = element as HTMLInputElement
      input.focus()
      input.setSelectionRange(4, 4)
    })

    // Typing a digit between the month's two digits replaces the second one;
    // it must not spill into the year or jump the caret to the end.
    await calc.approvalDate.press('1')
    await expect(calc.approvalDate).toHaveValue('17/11/2026')
    expect(
      await calc.approvalDate.evaluate((element) => (element as HTMLInputElement).selectionStart),
    ).toBe(5)

    // Deleting the month's last digit, then typing one, edits only the month.
    await calc.approvalDate.evaluate((element) => {
      const input = element as HTMLInputElement
      input.setSelectionRange(5, 5)
    })
    await calc.approvalDate.press('Backspace')
    await expect(calc.approvalDate).toHaveValue('17/1/2026')
    await calc.approvalDate.press('1')
    await expect(calc.approvalDate).toHaveValue('17/11/2026')
    expect(
      await calc.approvalDate.evaluate((element) => (element as HTMLInputElement).selectionStart),
    ).toBe(5)
  })

  test('the full date fits the field and its column hugs the control', async ({ calc }) => {
    await calc.setApprovalDate(dateOnly(0))

    const geometry = await calc.page.evaluate(() => {
      const input = document.querySelector('#approval-date') as HTMLInputElement
      const wrap = input.parentElement as HTMLElement
      const label = wrap.closest('.rate-validity-field') as HTMLElement
      const amount = document.querySelector('.starting-amount') as HTMLElement
      const chip = document.querySelector('[data-testid="rate-validity-chip"]') as HTMLElement
      const limits = document.querySelector('.limits-row') as HTMLElement
      const wrapBox = wrap.getBoundingClientRect()
      const labelBox = label.getBoundingClientRect()
      const amountBox = amount.getBoundingClientRect()
      const chipBox = chip.getBoundingClientRect()
      const purposeBox = limits.children[0].getBoundingClientRect()
      const propertyBox = limits.children[1].getBoundingClientRect()
      const rtl = document.documentElement.dir === 'rtl'
      return {
        clientWidth: input.clientWidth,
        scrollWidth: input.scrollWidth,
        wrapWidth: wrapBox.width,
        labelWidth: labelBox.width,
        rowGap: Math.max(
          0,
          labelBox.left - amountBox.right,
          amountBox.left - labelBox.right,
        ),
        limitGap: Math.max(
          0,
          purposeBox.left - propertyBox.right,
          propertyBox.left - purposeBox.right,
        ),
        chipTop: chipBox.top,
        chipBottom: chipBox.bottom,
        dateBottom: wrapBox.bottom,
        chipStart: rtl ? chipBox.right : chipBox.left,
        fieldStart: rtl ? wrapBox.right : wrapBox.left,
        limitsTop: limits.getBoundingClientRect().top,
      }
    })

    // dd/mm/yyyy is fully inside the box, not clipped at the reading edge.
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    // The label column is exactly the control's width, so it leaves no empty
    // space before the loan amount.
    expect(Math.abs(geometry.labelWidth - geometry.wrapWidth)).toBeLessThanOrEqual(1)
    // The date-to-loan gap matches the purpose-to-property gap in the limits row.
    expect(Math.abs(geometry.rowGap - geometry.limitGap)).toBeLessThanOrEqual(1)
    // The validity message hangs directly under the date input: same inline
    // start edge, just below it, not on a separate full-width row.
    expect(Math.abs(geometry.chipStart - geometry.fieldStart)).toBeLessThanOrEqual(1)
    expect(geometry.chipTop).toBeGreaterThanOrEqual(geometry.dateBottom)
    expect(geometry.chipTop - geometry.dateBottom).toBeLessThanOrEqual(12)
    // And it stays inside the starting row, above the limits row below it.
    expect(geometry.chipBottom).toBeLessThanOrEqual(geometry.limitsTop)
  })

  test('the date and amount keep the column gap at every narrow tier', async ({ calc }) => {
    await calc.setApprovalDate(dateOnly(0))
    await expect(calc.rateValidityChip).toBeVisible()

    // The validity message under the date is wider than the 160px control on
    // the small-tablet tier. In flow it stretched the date's cell and pushed
    // the amount ~35px further away; at phone widths the date field did not
    // fill its half, leaving ~70px of empty space beside the amount. Both
    // tiers should measure the row's own 14px column gap.
    for (const width of [750, 500, 430]) {
      await calc.page.setViewportSize({ width, height: 900 })
      const geometry = (await calc.page.evaluate(`(() => {
        const field = document.querySelector('#approval-date').parentElement.getBoundingClientRect()
        const amount = document.querySelector('[data-testid="starting-amount"]').parentElement.getBoundingClientRect()
        const row = document.querySelector('.starting-point')
        return {
          gap: Math.max(0, field.left - amount.right, amount.left - field.right),
          columnGap: parseFloat(getComputedStyle(row).columnGap),
        }
      })()`)) as { gap: number; columnGap: number }

      expect(geometry.columnGap).toBeGreaterThan(0)
      expect(
        Math.abs(geometry.gap - geometry.columnGap),
        `date-to-amount gap at ${width}px`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('the year value bubble keeps clear of the row divider', async ({ calc }) => {
    // 481-650px: the slider shares its line with the action buttons, so the
    // value bubble hanging under the track is what sets the row's bottom
    // clearance. It used to end 2px above the divider.
    for (const width of [600, 500]) {
      await calc.page.setViewportSize({ width, height: 900 })
      const clearance = (await calc.page.evaluate(`(() => {
        const bubble = document.querySelector('.term-slider .slider-current').getBoundingClientRect()
        const row = document.querySelector('.starting-point').getBoundingClientRect()
        return Math.round(row.bottom - bubble.bottom)
      })()`)) as number

      expect(clearance, `bubble clearance at ${width}px`).toBeGreaterThanOrEqual(8)
    }
  })

  test('the status never covers the fields or buttons of a wrapped row', async ({ calc }) => {
    await calc.setApprovalDate(dateOnly(0))
    await expect(calc.rateValidityChip).toBeVisible()

    // Walk the tiers where the starting row wraps: a hanging chip can only
    // land on something when its own flex line is followed by another one.
    const readings: Array<{ overlaps: boolean; wrapped: boolean }> = []
    for (let width = 481; width <= 1200; width += 50) {
      await calc.page.setViewportSize({ width, height: 900 })
      readings.push(
        (await calc.page.evaluate(`(() => {
          const chip = document.querySelector('[data-testid="rate-validity-chip"]').getBoundingClientRect()
          const date = document.querySelector('#approval-date').getBoundingClientRect()
          const actions = document.querySelector('[data-testid="starting-actions"]')
            .getBoundingClientRect()
          const others = Array.from(
            document.querySelectorAll(
              '.starting-point .starting-amount, .starting-point .term-slider, .starting-point .starting-actions',
            ),
          ).map((element) => element.getBoundingClientRect())
          const overlaps = others.some(
            (box) =>
              chip.left < box.right &&
              box.left < chip.right &&
              chip.top < box.bottom &&
              box.top < chip.bottom,
          )
          return { overlaps, wrapped: actions.top >= date.bottom }
        })()`)) as { overlaps: boolean; wrapped: boolean },
      )
    }

    // The guard is only meaningful if at least one of these widths wrapped.
    expect(readings.some((reading) => reading.wrapped)).toBe(true)
    expect(readings.filter((reading) => reading.overlaps)).toEqual([])
  })

  test('completing the day and month advances to the next segment', async ({ calc }) => {
    await calc.approvalDate.fill('')
    await calc.typeApprovalDate('10')
    await expect(calc.approvalDate).toHaveValue('10/')
    await calc.approvalDate.pressSequentially('10')
    await expect(calc.approvalDate).toHaveValue('10/10/')
  })

  test('a two-digit year is completed on blur, not mangled while typing', async ({ calc }) => {
    await calc.typeApprovalDate('030320')
    // While typing, the field keeps exactly what was entered.
    await expect(calc.approvalDate).toHaveValue('03/03/20')
    await calc.approvalDate.press('Tab')
    await expect(calc.approvalDate).toHaveValue('03/03/2020')
    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expired')
  })

  test('a fresh approval is valid and names the last day the quote holds', async ({ calc }) => {
    await calc.setApprovalDate(dateOnly(0))

    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'valid')
    await expect(calc.rateValidityChip).toContainText('הריבית בתוקף')
    // 24 days out, on the same calendar day (never shifted by a timezone).
    const expiry = lastValidDay()
    await expect(calc.rateValidityChip).toContainText(String(expiry.getDate()))
    await expect(calc.rateValidityChip).toContainText(String(expiry.getFullYear()))
    // A valid rate needs no results warning.
    await expect(calc.summaryNotes).not.toContainText('תוקף הריבית')
  })

  test('inside the last days the chip warns, and the results add an info line', async ({ calc }) => {
    // 23 days old: one day left, inside the "expiring soon" window.
    await calc.setApprovalDate(dateOnly(-23))

    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expiring')
    await expect(calc.rateValidityChip).toContainText('הריבית תפוג בקרוב')
    await expect(
      calc.summaryNotes.locator('.note-line.info').filter({ hasText: 'עומד לפוג' }),
    ).toBeVisible()
  })

  test('past the window the chip is expired and the results carry a red line', async ({ calc }) => {
    // 30 days old: six days past the 24-day window.
    await calc.setApprovalDate(dateOnly(-30))

    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expired')
    await expect(calc.rateValidityChip).toContainText('תוקף הריבית פג')
    await expect(
      calc.summaryNotes
        .locator('.note-line.negative')
        .filter({ hasText: 'תוקף הריבית באישור העקרוני פג' }),
    ).toBeVisible()
  })

  test('the last valid day still counts as valid, not expired', async ({ calc }) => {
    // Exactly 24 days old: daysRemaining is 0, the window's final day.
    await calc.setApprovalDate(dateOnly(-24))

    await expect(calc.rateValidityChip).toHaveAttribute('data-status', 'expiring')
    // The warning is the "about to lapse" one, never the "has lapsed" one.
    await expect(
      calc.summaryNotes.locator('.note-line.info').filter({ hasText: 'עומד לפוג' }),
    ).toBeVisible()
    await expect(calc.summaryNotes).not.toContainText('תוקף הריבית באישור העקרוני פג')
  })

  test('fits a 360px phone without a sideways scroll', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await calc.setApprovalDate(dateOnly(-30))

    await expect(calc.rateValidityChip).toBeVisible()
    const overflow = (await calc.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
    // The chip stays inside the viewport at phone widths.
    const rect = (await calc.page.evaluate(`(() => {
      const el = document.querySelector('[data-testid="rate-validity-chip"]')
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, viewport: window.innerWidth }
    })()`)) as { left: number; right: number; viewport: number }
    expect(rect.left).toBeGreaterThanOrEqual(-1)
    expect(rect.right).toBeLessThanOrEqual(rect.viewport + 1)
  })
})

test.describe('mortgage comparison - אישור עקרוני rate validity', () => {
  /** Navigate via the calculator CTA so the comparison is seeded from it. */
  async function gotoSeeded(calc: CalculatorPage): Promise<void> {
    await calc.goto()
    await calc.page.getByTestId('open-comparison').click()
    await expect(calc.page.getByTestId('compare-shell')).toBeVisible()
  }

  test('the calculator date travels into the first mix, and only it', async ({ calc, page }) => {
    await calc.goto()
    await calc.setApprovalDate('2026-01-01')
    await calc.page.getByTestId('open-comparison').click()
    // The date is part of the saved offer now, so entering it alone counts as
    // unsaved work and the leave guard asks first.
    await expect(calc.unsavedDialog).toBeVisible()
    await calc.unsavedLeave.click()
    await expect(page.getByTestId('compare-shell')).toBeVisible()

    await expect(page.getByTestId('compare-approval-date-1')).toHaveValue('01/01/2026')
    await expect(page.getByTestId('compare-approval-date-2')).toHaveValue('')
    // Two mixes, each its own offer: only the first carries a date, so only it
    // shows a chip. 2026-01-01 is long past, so the chip is the expired one.
    await expect(page.getByTestId('compare-approval-chip-1')).toHaveAttribute(
      'data-status',
      'expired',
    )
    await expect(page.getByTestId('compare-approval-chip-2')).toHaveCount(0)
  })

  test('the compare date field formats one-digit parts while typing', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const field = page.getByTestId('compare-approval-date-1')
    await field.fill('')
    // Same shared control as the calculator: 30/3/2025 can be typed as
    // 3032025, and a one-digit 4-9 gets its slash immediately.
    await field.pressSequentially('3032025')
    await expect(field).toHaveValue('30/3/2025')
    await field.fill('')
    await field.pressSequentially('452025')
    await expect(field).toHaveValue('4/5/2025')
  })

  test('each mix carries its own date and status', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    // The shell renders before hydration; filling earlier leaves the controlled
    // date inputs on their server defaults.
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    await page.getByTestId('compare-approval-date-1').fill(dateOnly(-30))
    await page.getByTestId('compare-approval-date-2').fill(dateOnly(0))

    await expect(page.getByTestId('compare-approval-chip-1')).toHaveAttribute(
      'data-status',
      'expired',
    )
    await expect(page.getByTestId('compare-approval-chip-2')).toHaveAttribute(
      'data-status',
      'valid',
    )
    // The result card reports the lapsed rate for mix 1 only: mix 1 has a
    // priced mix (seeded by default), mix 2 is blank.
    await expect(page.getByTestId('compare-result-card-1')).toContainText(
      'תוקף הריבית באישור העקרוני פג',
    )
    await expect(page.getByTestId('compare-result-card-2')).not.toContainText('תוקף הריבית')
  })

  test('a seeded comparison keeps the calculator date', async ({ calc, page }) => {
    await gotoSeeded(calc)
    // The seeded date comes from the calculator's field, so it is empty here
    // (none was entered) and no chip renders in either column.
    await expect(page.getByTestId('compare-approval-date-1')).toHaveValue('')
    await expect(page.getByTestId('compare-approval-chip-1')).toHaveCount(0)
  })

  test('the date hugs its value and the status leaves the mixes in place', async ({
    page,
  }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const presetBoxes = () =>
      page.evaluate(() =>
        ['basket1', 'basket2', 'basket3', 'basket4'].map((id) => {
          const box = document
            .querySelector(`[data-testid="compare-preset-1-${id}"]`)!
            .getBoundingClientRect()
          return {
            left: Math.round(box.left),
            top: Math.round(box.top + window.scrollY),
            width: Math.round(box.width),
          }
        }),
      )

    // No date yet: this is the layout the presets must keep.
    const before = await presetBoxes()

    await page.getByTestId('compare-approval-date-1').fill(dateOnly(0))
    await expect(page.getByTestId('compare-approval-chip-1')).toBeVisible()
    // The calendar mark survives the narrow two-column date field.
    await expect(
      page.getByTestId('compare-approval-date-1').locator('..').getByTestId('date-field-icon'),
    ).toBeVisible()
    // Value at the reading start, icon at the opposite end.
    await expect(page.getByTestId('compare-approval-date-1')).toHaveCSS('text-align', 'right')

    // The message must not size the preset columns or move the buttons.
    expect(await presetBoxes()).toEqual(before)

    const geometry = await page.evaluate(() => {
      const field = document.querySelector('#compare-approval-date-1')!.parentElement!
      const chip = document.querySelector('[data-testid="compare-approval-chip-1"]')!
      const fieldBox = field.getBoundingClientRect()
      const chipBox = chip.getBoundingClientRect()
      const first = document
        .querySelector('[data-testid="compare-preset-1-basket1"]')!
        .getBoundingClientRect()
      const second = document
        .querySelector('[data-testid="compare-preset-1-basket2"]')!
        .getBoundingClientRect()
      const input = document.querySelector('#compare-approval-date-1') as HTMLInputElement
      return {
        fieldLeft: fieldBox.left,
        fieldRight: fieldBox.right,
        fieldWidth: fieldBox.width,
        fieldHeight: fieldBox.height,
        fieldCenterY: fieldBox.top + fieldBox.height / 2,
        chipLeft: chipBox.left,
        chipRight: chipBox.right,
        chipHeight: chipBox.height,
        chipCenterY: chipBox.top + chipBox.height / 2,
        gap:
          Math.max(0, chipBox.left - fieldBox.right, fieldBox.left - chipBox.right),
        inputClientWidth: input.clientWidth,
        inputScrollWidth: input.scrollWidth,
        pairLeft: Math.min(first.left, second.left),
        pairRight: Math.max(first.right, second.right),
        pairWidth: Math.max(first.right, second.right) - Math.min(first.left, second.left),
      }
    })

    // The full dd/mm/yyyy value fits, and the field is sized by its own text
    // (about 14ch plus the calendar mark), not stretched across preset columns.
    expect(geometry.inputScrollWidth).toBeLessThanOrEqual(geometry.inputClientWidth + 1)
    expect(geometry.inputClientWidth).toBeLessThanOrEqual(130)
    expect(geometry.fieldWidth).toBeLessThanOrEqual(geometry.inputClientWidth + 40)
    // It still starts at the reading start (right in Hebrew), aligned with the
    // first preset's edge.
    expect(Math.abs(geometry.fieldRight - geometry.pairRight)).toBeLessThanOrEqual(1)

    // The message matches the field's height and is centered on it, rather
    // than hanging at its bottom edge.
    expect(Math.abs(geometry.chipHeight - geometry.fieldHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.chipCenterY - geometry.fieldCenterY)).toBeLessThanOrEqual(1)

    // And it sits beside the date, one grid gap away, never over it. The gap
    // is measured from the control, not the label column, so it must not
    // grow with the label's text width (the CI font made it 17px once).
    const overlap =
      Math.min(geometry.chipRight, geometry.fieldRight) -
      Math.max(geometry.chipLeft, geometry.fieldLeft)
    expect(overlap).toBeLessThanOrEqual(1)
    expect(geometry.gap).toBeLessThanOrEqual(9)
  })

  test('typing 03 03 20 keeps the date and completes the year', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const input = page.getByTestId('compare-approval-date-1')
    await input.focus()
    await input.pressSequentially('03 03 20')
    // The spaces land in the mask's separator positions, so they render as
    // slashes while the two-digit year is kept until blur.
    await expect(input).toHaveValue('03/03/20')
    await input.blur()
    await expect(input).toHaveValue('03/03/2020')
    await expect(page.getByTestId('compare-approval-chip-1')).toHaveAttribute(
      'data-status',
      'expired',
    )
  })

  test('an impossible date is marked invalid and produces no status', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const input = page.getByTestId('compare-approval-date-1')
    await input.focus()
    await input.pressSequentially('31022020')
    await input.blur()
    await expect(input).toHaveValue('31/02/2020')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('compare-approval-chip-1')).toHaveCount(0)
  })

  test('fits a 360px phone without a sideways scroll', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
    await page.setViewportSize({ width: 360, height: 900 })
    await page.getByTestId('compare-approval-date-1').fill(dateOnly(-30))
    await expect(page.getByTestId('compare-approval-chip-1')).toBeVisible()

    const overflow = (await page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('rate validity in English (LTR)', () => {
  test.use({ language: 'english' })

  test('the chip reads in the active language', async ({ localizedCalc }) => {
    await localizedCalc.goto()
    await localizedCalc.setApprovalDate(dateOnly(-30))
    await expect(localizedCalc.rateValidityChip).toHaveAttribute('data-status', 'expired')
    await expect(localizedCalc.rateValidityChip).toContainText('Rate validity ended')
    await expect(localizedCalc.summaryNotes.locator('.note-line.negative')).toContainText(
      'The pre-approval rate has lapsed',
    )
  })

  test('the compare date, status and mixes keep their layout in LTR', async ({ page }) => {
    await page.goto('/en/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const buttonBoxes = () =>
      page.evaluate(() =>
        ['basket1', 'basket2', 'basket3', 'basket4'].map((id) => {
          const box = document
            .querySelector(`[data-testid="compare-preset-1-${id}"]`)!
            .getBoundingClientRect()
          return {
            left: Math.round(box.left),
            top: Math.round(box.top + window.scrollY),
            width: Math.round(box.width),
          }
        }),
      )
    const before = await buttonBoxes()

    await page.getByTestId('compare-approval-date-1').fill(dateOnly(0))
    await expect(page.getByTestId('compare-approval-chip-1')).toBeVisible()
    expect(await buttonBoxes()).toEqual(before)

    const geometry = await page.evaluate(() => {
      const field = document.querySelector('#compare-approval-date-1')!.parentElement!
      const chip = document.querySelector('[data-testid="compare-approval-chip-1"]')!
      const fieldBox = field.getBoundingClientRect()
      const chipBox = chip.getBoundingClientRect()
      const first = document
        .querySelector('[data-testid="compare-preset-1-basket1"]')!
        .getBoundingClientRect()
      const second = document
        .querySelector('[data-testid="compare-preset-1-basket2"]')!
        .getBoundingClientRect()
      const input = document.querySelector('#compare-approval-date-1') as HTMLInputElement
      return {
        dir: document.documentElement.dir,
        fieldLeft: fieldBox.left,
        fieldWidth: fieldBox.width,
        pairLeft: Math.min(first.left, second.left),
        pairWidth: Math.max(first.right, second.right) - Math.min(first.left, second.left),
        fieldCenterY: fieldBox.top + fieldBox.height / 2,
        chipCenterY: chipBox.top + chipBox.height / 2,
        gap: Math.max(0, chipBox.left - fieldBox.right, fieldBox.left - chipBox.right),
        inputClientWidth: input.clientWidth,
        inputScrollWidth: input.scrollWidth,
      }
    })

    expect(geometry.dir).toBe('ltr')
    await expect(page.getByTestId('compare-approval-date-1')).toHaveCSS('text-align', 'left')
    // Mirrored: at the reading start (left in English), hugging its value and
    // not stretched across the preset columns.
    expect(Math.abs(geometry.fieldLeft - geometry.pairLeft)).toBeLessThanOrEqual(1)
    expect(geometry.inputClientWidth).toBeLessThanOrEqual(130)
    expect(geometry.fieldWidth).toBeLessThanOrEqual(geometry.inputClientWidth + 40)
    expect(geometry.inputScrollWidth).toBeLessThanOrEqual(geometry.inputClientWidth + 1)
    expect(Math.abs(geometry.chipCenterY - geometry.fieldCenterY)).toBeLessThanOrEqual(1)
    expect(geometry.gap).toBeLessThanOrEqual(9)
  })
})
