import { test, expect } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'
import { CalculatorPage } from '../../pom/CalculatorPage'
import { formatGroupedNumber, ils } from '../../support/ils'

test.describe('mortgage calculator - core UI flows', () => {
  let calc: CalculatorPage

  test.beforeEach(async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    calc = new CalculatorPage(page)
    await calc.goto()
  })

  test('renders the recommended mix (תמהיל מומלץ) by default', async () => {
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

  test('default mix has three tracks; removal keeps at least one', () => {
    test.setTimeout(45_000)
    return test.step('remove down to one, then guard the last', async () => {
      await expect(calc.page.getByTestId('track-3')).toBeVisible()
      await expect(calc.addTrackButton).toBeHidden()

      await calc.track(3).removeTrack()
      await expect(calc.page.getByTestId('track-3')).toHaveCount(0)
      await calc.track(2).removeTrack()
      await expect(calc.page.getByTestId('track-2')).toHaveCount(0)
      await expect(calc.page.getByTestId('track-1')).toBeVisible()
      await calc.track(1).removeTrack()
      await expect(calc.page.getByTestId('track-1')).toBeVisible()
    })
  })

  test('preset baskets populate tracks and highlight selection', async () => {
    await calc.selectPreset('basket2')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.page.getByTestId('track-1')).toBeVisible()
    await expect(calc.page.getByTestId('track-2')).toBeVisible()
    await expect(calc.page.getByTestId('track-3')).toBeVisible()
    // Prime track adopts live BOI key rate (4.5) + margin (1.5) = 6.
    await expect(calc.track(2).type()).toHaveValue('prime')
    await expect(calc.track(2).rate()).toHaveValue('6')

    await calc.selectPreset('basket4')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'false')
  })

  test('manual rate override is respected (autoRate cleared)', async () => {
    const track = calc.track(1)
    await track.setType('prime')
    await track.setAmount('300,000')

    await track.rate().fill('9.99')
    await expect(track.rate()).toHaveValue('9.99')

    const before = await calc.monthlyPayment.textContent()
    await track.rate().fill('4.0')
    const after = await calc.monthlyPayment.textContent()
    expect(after).not.toBe(before)
    await expect(track.rate()).toHaveValue(/^4(\.0)?$/)
  })

  test('property/capital bidirectional sync derives and restores the loan', async () => {
    await calc.setPropertyValue('2,000,000')
    await calc.setCapital('500,000')

    await expect(calc.startingAmount).toBeDisabled()
    await expect(calc.startingAmount).toHaveValue('1,500,000')
    // Tracks rescaled to the derived loan (1,500,000 · 40% prime share).
    await expect(calc.track(1).amount()).toHaveValue('600,000')

    // Clearing the property value restores manual entry with remembered gross.
    await calc.setPropertyValue('')
    await expect(calc.startingAmount).toBeEnabled()
    await expect(calc.startingAmount).toHaveValue('2,000,000')
  })

  test('zero loan shows the no-need state', async () => {
    await calc.setPropertyValue('100,000')
    await calc.setCapital('200,000')
    await expect(calc.startingAmount).toBeDisabled()
    await expect(calc.startingAmount).toHaveValue('אין צורך 🥳')
  })

  test('LTV warning triggers above the BoI purpose limit', async () => {
    await calc.selectPurpose('investment')
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('400,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText('60%')
    await expect(calc.summaryNotes).toContainText(ils(500_000))
    // Capital note: 40% ≥ required(50)+15 → good
    await expect(calc.summaryNotes).toContainText('הון עצמי 40% משווי הנכס')
  })

  test('DTI warning triggers above half of income and suggests a minimum', async () => {
    await calc.setIncome('1,000')
    await expect(calc.summaryNotes).toBeVisible()
    // Merged DTI line (bad ❌): shortfall + required minimum income.
    await expect(calc.summaryNotes).toContainText('מהנדרש')
    await expect(calc.summaryNotes).toContainText('הבנק יבקש הכנסה חודשית פנויה של לפחות')
    // Suggested minimum income placeholder: ceil(7772·2/500)·500 = 16,000.
    // Hints are plain grouped numbers - the input renders its own ₪ suffix.
    await expect(calc.monthlyIncome).toHaveAttribute('placeholder', formatGroupedNumber(16_000))
  })

  test('variable-rate cap blocks calculation and auto-fix rebalances', async () => {
    const track1 = calc.track(1)
    await calc.setPropertyValue('1,000,000')
    await track1.setType('prime')
    await track1.setAmount('900,000')

    await expect(calc.formError).toContainText('66.66%')
    await expect(calc.autofixButton).toBeVisible()
    await expect(track1.legend()).toHaveClass(/variable-limit-flag/)

    await calc.autofixButton.click()
    await expect(calc.formError).toBeHidden()
    await expect(calc.autofixButton).toBeHidden()
    // Σtracks === loan exactly, variable share ≤ ⅔
    const amounts = await Promise.all(
      [1, 2, 3].map(async (index) =>
        Number((await calc.track(index).amount().inputValue()).replace(/,/g, '')),
      ),
    )
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(1_000_000)
    expect(amounts[0]).toBeLessThanOrEqual(666_666)
    await expect(calc.monthlyPayment).not.toHaveText('₪0')
  })

  test('schedule always shows the full horizon, with no expand button', async () => {
    // Default term is 15y - the full 15 rows render, no expand control.
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)

    await calc.termSlider.fill('30')
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(30)
  })

  test('term slider drives track years both ways', async () => {
    // NOTE: RTL range inputs invert arrow-key direction differently per engine
    // (Chromium/Firefox invert, WebKit does not) - drive the value directly,
    // which exercises the same onChange wiring as native keyboard input.
    await calc.termSlider.fill('29')
    await expect(calc.termSlider).toHaveValue('29')
    await expect(calc.track(1).years()).toHaveValue('29')
    await expect(calc.page.getByTestId('total-payment-label')).toContainText('ל-29 שנים')
  })

  test('reset asks for confirmation then restores the default mix', async () => {
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
    await expect(calc.termSlider).toHaveValue('15')
  })
})
