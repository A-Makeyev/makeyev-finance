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
    await expect(page.getByTestId('compare-shell')).toBeVisible()

    await expect(page.getByTestId('compare-approval-date-1')).toHaveValue('2026-01-01')
    await expect(page.getByTestId('compare-approval-date-2')).toHaveValue('')
    // Two mixes, each its own offer: only the first carries a date, so only it
    // shows a chip. 2026-01-01 is long past, so the chip is the expired one.
    await expect(page.getByTestId('compare-approval-chip-1')).toHaveAttribute(
      'data-status',
      'expired',
    )
    await expect(page.getByTestId('compare-approval-chip-2')).toHaveCount(0)
  })

  test('each mix carries its own date and status', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()

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

  test('fits a 360px phone without a sideways scroll', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
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
})
