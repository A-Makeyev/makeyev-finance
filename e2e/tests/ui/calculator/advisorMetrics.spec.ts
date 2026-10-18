import { expect, test } from '../../../fixtures'
import { ils } from '../../../support/ils'

/**
 * Advisor-metric rows: the debt the payments clear (סך ירידת הקרן) and the year
 * the combined payment peaks, which rides the highest-payment card's caption.
 * Both are derived from the schedule, so the arithmetic is hand-checked in
 * tests/unit/advisorMetrics.test.ts and this drives the real UI.
 */

test.describe('mortgage calculator - advisor metric rows', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
    await calc.showAllResults()
  })

  test('an indexed mix reports more than the loan, and the year the payment peaks', async ({
    calc,
  }) => {
    // The default basket (basket4) holds a CPI-indexed track, so the principal
    // column telescopes past the nominal ₪1,000,000 by the indexation.
    await expect(calc.principalDecline).toBeVisible()
    await expect(calc.principalDecline).not.toHaveText(ils(1_000_000))
    // Indexation raises the payment every month, so it peaks in the final year
    // (the default term is 15).
    await expect(calc.highestCaption).toContainText('בשנה ה-15')
  })

  test('the new card opens its own explanation dialog', async ({ calc }) => {
    await calc.principalDecline.click()
    const dialog = calc.page.getByTestId('results-card-modal')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('סך ירידת הקרן')
    await expect(dialog).toContainText('ההצמדה מייקרת את החוב')
  })

  test('a flat, non-indexed mix reports exactly the loan and names no peak year', async ({
    calc,
  }) => {
    await calc.selectPreset('basket1')

    await expect(calc.principalDecline).toHaveText(ils(1_000_000))
    // A constant payment peaks in year 1, which the caption leaves unsaid.
    await expect(calc.highestCaption).not.toContainText('בשנה')
  })

  test('fits a 360px phone without a sideways scroll', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await expect(calc.principalDecline).toBeVisible()

    const overflow = await calc.page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )
    expect(overflow as number).toBeLessThanOrEqual(1)
  })
})

test.describe('advisor metric rows in English (LTR)', () => {
  test.use({ language: 'english' })

  test('the card and the peak-year caption read in the active language', async ({
    localizedCalc,
  }) => {
    await localizedCalc.goto()
    await localizedCalc.showAllResults()

    await expect(localizedCalc.principalDecline).toBeVisible()
    await expect(localizedCalc.highestCaption).toContainText('peak in year 15')
    // The card is only worth showing its indexation caption when a track is
    // indexed, which the default mix is.
    await expect(
      localizedCalc.page.locator('[data-card-key="principalDecline"]'),
    ).toContainText('plus')
  })

  test('a non-indexed mix drops the peak-year wording', async ({ localizedCalc }) => {
    await localizedCalc.goto()
    await localizedCalc.selectPreset('basket1')
    await localizedCalc.showAllResults()

    await expect(localizedCalc.principalDecline).toHaveText(ils(1_000_000))
    await expect(localizedCalc.highestCaption).not.toContainText('peak in year')
  })
})
