import { test, expect } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'
import { CalculatorPage } from '../../pom/CalculatorPage'
import { ils } from '../../support/ils'

test.describe('mortgage calculator — core UI flows', () => {
  let calc: CalculatorPage

  test.beforeEach(async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    calc = new CalculatorPage(page)
    await calc.goto()
  })

  test('renders basket1 by default with correct Spitzer payment', async () => {
    // ₪1,000,000 · 4.5% · 30y Spitzer → ₪5,067/month
    await expect(calc.monthlyPayment).toHaveText(ils(5_067))
    await expect(calc.track(1).type()).toHaveValue('fixed')
    await expect(calc.track(1).amount()).toHaveValue('1,000,000')
    await expect(calc.startingAmount).toHaveValue('1,000,000')
    await expect(calc.formError).toBeHidden()
  })

  test('adding tracks caps at three and removal keeps at least one', () => {
    test.setTimeout(45_000)
    return test.step('add up to cap, then remove back down', async () => {
      await calc.addTrackButton.click()
      await expect(calc.page.getByTestId('track-2')).toBeVisible()
      await calc.addTrackButton.click()
      await expect(calc.page.getByTestId('track-3')).toBeVisible()
      await expect(calc.addTrackButton).toBeHidden()

      await calc.track(3).removeTrack()
      await expect(calc.page.getByTestId('track-2')).toHaveCount(1)
      await calc.track(2).removeTrack()
      await expect(calc.page.getByTestId('track-1')).toBeVisible()
      // Guarded: cannot remove the last track.
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
    // Compliant two-track mix: prime 30% + fixed 70%.
    const track = calc.track(1)
    await track.setType('prime')
    await track.setAmount('300,000')
    await calc.addTrackButton.click()
    await calc.track(2).setAmount('700,000')

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
    // Tracks rescaled to the derived loan.
    await expect(calc.track(1).amount()).toHaveValue('1,500,000')

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

    await expect(calc.limitsWarning).toBeVisible()
    await expect(calc.limitsWarning).toContainText('60%')
    await expect(calc.limitsWarning).toContainText(ils(500_000))
    // Equity note: 40% ≥ required(50)+15 → good
    await expect(calc.equityNote).toContainText('הון עצמי 40% משווי הנכס')
  })

  test('DTI warning triggers above half of income and suggests a minimum', async () => {
    await calc.setIncome('1,000')
    await expect(calc.limitsWarning).toBeVisible()
    await expect(calc.limitsWarning).toContainText('50%')
    // Suggested minimum income placeholder: ceil(5067·2/500)·500 = ₪10,500
    await expect(calc.monthlyIncome).toHaveAttribute('placeholder', ils(10_500))
  })

  test('variable-rate cap blocks calculation and auto-fix rebalances', async () => {
    const track1 = calc.track(1)
    await track1.setType('prime')
    await track1.setAmount('900,000')
    await calc.addTrackButton.click()
    const track2 = calc.track(2)
    await track2.setAmount('100,000')

    await expect(calc.formError).toContainText('66.66%')
    await expect(calc.autofixButton).toBeVisible()
    await expect(track1.legend()).toHaveClass(/variable-limit-flag/)

    await calc.autofixButton.click()
    await expect(calc.formError).toBeHidden()
    await expect(calc.autofixButton).toBeHidden()
    // Σtracks === loan exactly, variable share ≤ ⅔
    const amounts = [
      Number((await track1.amount().inputValue()).replace(/,/g, '')),
      Number((await track2.amount().inputValue()).replace(/,/g, '')),
    ]
    expect(amounts[0] + amounts[1]).toBe(1_000_000)
    expect(amounts[0]).toBeLessThanOrEqual(666_666)
    await expect(calc.monthlyPayment).not.toHaveText('₪0')
  })

  test('schedule expands to full horizon and collapses back', async () => {
    const expand = calc.page.getByTestId('expand-schedule')
    await expect(expand).toBeVisible()
    await expect(expand).toContainText('30 שנים')
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)

    await expand.click()
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(30)
    await expect(expand).toContainText('הצג 15 שנים ראשונות')

    await expand.click()
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)
    await expect(expand).toContainText('הצג פירוט ל-30 שנים')
  })

  test('term slider drives track years both ways', async () => {
    // NOTE: RTL range inputs invert arrow-key direction differently per engine
    // (Chromium/Firefox invert, WebKit does not) — drive the value directly,
    // which exercises the same onChange wiring as native keyboard input.
    await calc.termSlider.fill('29')
    await expect(calc.termSlider).toHaveValue('29')
    await expect(calc.track(1).years()).toHaveValue('29')
    await expect(calc.page.getByTestId('total-payment-label')).toContainText('ל-29 שנים')
  })

  test('reset restores defaults', async () => {
    await calc.selectPreset('basket4')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await calc.setPropertyValue('3,000,000')
    // Idempotent retry: guards against rare engine-timing misses on click.
    await expect
      .poll(
        async () => {
          if ((await calc.propertyValue.inputValue()) !== '') await calc.resetButton.click()
          return calc.propertyValue.inputValue()
        },
        { timeout: 15_000 },
      )
      .toBe('')

    await expect(calc.startingAmount).toBeEnabled()
    await expect(calc.startingAmount).toHaveValue('1,000,000')
    await expect(calc.preset('basket1')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.track(1).type()).toHaveValue('fixed')
    await expect(calc.termSlider).toHaveValue('30')
  })
})
