import { expect } from '../../../fixtures'
import { test } from '../../../fixtures'
import { formatGroupedNumber, ils } from '../../../support/ils'

test.describe('mortgage calculator - core UI flows', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('renders the recommended mix (תמהיל מומלץ) by default', async ({ calc }) => {
    // ₪1,000,000 split prime 400k / fixed 340k / variableIndexed5y 260k,
    // 15y Spitzer → ₪7,772/month (default term is 15)
    await expect(calc.monthlyPayment).toHaveText(ils(7_772))
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.track(1).type()).toHaveValue('prime')
    await expect(calc.track(1).amount()).toHaveValue('400,000')
    await expect(calc.track(2).type()).toHaveValue('fixed')
    await expect(calc.track(2).amount()).toHaveValue('340,000')
    await expect(calc.track(3).type()).toHaveValue('variableIndexed5y')
    await expect(calc.track(3).amount()).toHaveValue('260,000')
    await expect(calc.track(1).years()).toHaveValue('15')
    await expect(calc.termSlider).toHaveValue('15')
    await expect(calc.startingAmount).toHaveValue('1,000,000')
    await expect(calc.formError).toBeHidden()
  })

  test('preset baskets populate tracks and highlight selection', async ({ calc }) => {
    // תמהיל 2 = two tracks (fixed + prime, half each).
    await calc.selectPreset('basket2')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.page.getByTestId('track-1')).toBeVisible()
    await expect(calc.page.getByTestId('track-2')).toBeVisible()
    await expect(calc.page.getByTestId('track-3')).toHaveCount(0)
    await expect(calc.track(1).type()).toHaveValue('fixed')
    // Prime track adopts live BOI key rate (4.5) + margin (1.5) = 6.
    await expect(calc.track(2).type()).toHaveValue('prime')
    await expect(calc.track(2).rate()).toHaveValue('6')

    // תמהיל 3 = three equal tracks, including the 5-year variable.
    await calc.selectPreset('basket3')
    await expect(calc.preset('basket3')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'false')
    await expect(calc.page.getByTestId('track-3')).toBeVisible()
    await expect(calc.track(1).type()).toHaveValue('fixed')
    await expect(calc.track(3).type()).toHaveValue('variableIndexed5y')

    await calc.selectPreset('basket4')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.preset('basket3')).toHaveAttribute('aria-pressed', 'false')
  })

  test('home-price input caps at ₪100M', async ({ calc }) => {
    // Typing 150M clamps to 100,000,000 (grouped); every derived figure (the
    // summary tax line among them) then derives from the capped value.
    await calc.setPropertyValue('150,000,000')
    await expect(calc.propertyValue).toHaveValue('100,000,000')

    // Under-cap values pass through untouched.
    await calc.setPropertyValue('2,500,000')
    await expect(calc.propertyValue).toHaveValue('2,500,000')
  })

  test('track years field edits as a number input clamped to 30', async ({ calc }) => {
    const years = calc.track(1).years()
    await expect(years).toHaveAttribute('type', 'number')
    await expect(years).toHaveValue('15')

    // Appending clamps to the 30-year max (15 + "0" = 150 → 30).
    await years.focus()
    await calc.page.keyboard.press('End')
    await calc.page.keyboard.type('0')
    await expect(years).toHaveValue('30')

    // Select-all and overwrite works and persists.
    await years.focus()
    await calc.page.keyboard.press('Control+a')
    await calc.page.keyboard.type('20')
    await expect(years).toHaveValue('20')
    await years.blur()
    await expect(years).toHaveValue('20')

    // Clearing is allowed; blur restores a minimum of 1.
    await years.focus()
    await calc.page.keyboard.press('Control+a')
    await calc.page.keyboard.press('Backspace')
    await expect(years).toHaveValue('')
    await years.blur()
    await expect(years).toHaveValue('1')
  })

  test('term slider drives track years both ways', async ({ calc }) => {
    // NOTE: RTL range inputs invert arrow-key direction differently per engine
    // (Chromium/Firefox invert, WebKit does not) - drive the value directly,
    // which exercises the same onChange wiring as native keyboard input.
    await calc.termSlider.fill('29')
    await expect(calc.termSlider).toHaveValue('29')
    await expect(calc.track(1).years()).toHaveValue('29')
    await expect(calc.page.getByTestId('total-payment-label')).toContainText('ל-29 שנים')

    // The years figure is part of that phrase, so it takes the label's ink
    // rather than a second highlight colour inside one sentence (user request).
    const labelColors = (await calc.page.evaluate(
      `(() => {
        const label = document.querySelector('[data-testid="total-payment-label"]')
        const years = label.querySelector('.term-years-value')
        return {
          label: getComputedStyle(label).color,
          years: years ? getComputedStyle(years).color : null,
        }
      })()`,
    )) as { label: string; years: string | null }
    expect(labelColors.years, 'years figure rendered').not.toBeNull()
    expect(labelColors.years, 'years figure matches the label ink').toBe(labelColors.label)
  })

  test('reset asks for confirmation then restores the default mix', async ({ calc }) => {
    await calc.selectPreset('basket4')
    await calc.setPropertyValue('3,000,000')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')

    // Clicking reset opens the confirmation modal without clearing anything yet.
    await calc.resetButton.click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeVisible()
    await expect(calc.propertyValue).toHaveValue('3,000,000')

    // Cancelling keeps all data untouched.
    await calc.page.getByTestId('reset-confirm-no').click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeHidden()
    await expect(calc.propertyValue).toHaveValue('3,000,000')

    // Confirming zeros the sum and returns to תמהיל מומלץ (still selected, blank).
    await calc.resetButton.click()
    await calc.page.getByTestId('reset-confirm-yes').click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeHidden()
    await expect(calc.propertyValue).toHaveValue('')
    await expect(calc.startingAmount).toBeEnabled()
    await expect(calc.startingAmount).toHaveValue('')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.track(1).type()).toHaveValue('prime')
    // Track amounts come back blank (not "0") so nothing counts as entered
    // and no "positive amount" error appears.
    await expect(calc.track(1).amount()).toHaveValue('')
    await expect(calc.track(2).amount()).toHaveValue('')
    await expect(calc.track(3).amount()).toHaveValue('')
    await expect(calc.formError).toBeHidden()
    await expect(calc.termSlider).toHaveValue('15')
  })

  test('income below the required payment flags the allowance and suggests a minimum', async ({
    calc,
  }) => {
    await calc.setIncome('1,000')
    await expect(calc.summaryNotes).toBeVisible()
    // The required payment is a neutral 💡 fact line: term and figure.
    await expect(calc.summaryNotes).toContainText('לתקופה של 15 שנים')
    await expect(calc.summaryNotes).toContainText('7,772')
    // Affordability line (bad ❌, short): at the 33% ceiling the 1,000 income
    // allows ceil(1,000 × 0.33) = 330, far below the required payment, and
    // the line names the expected payment and the minimum income that fits.
    await expect(calc.summaryNotes).toContainText('ההכנסה לא מספיקה להחזר החודשי הצפוי')
    await expect(calc.summaryNotes).toContainText(ils(7_772))
    await expect(calc.summaryNotes).toContainText('33%')
    await expect(calc.summaryNotes).toContainText(ils(1_000))
    await expect(calc.summaryNotes).toContainText('24,000')
    // Income hint: ceil((7772 / 0.33 + 0)/500)·500 = 24,000 - typing it makes
    // the ceiling allowance cover the payment.
    await expect(calc.monthlyIncome).toHaveAttribute('placeholder', formatGroupedNumber(24_000))
  })
})
