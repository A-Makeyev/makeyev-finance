import { test, expect } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'
import { CalculatorPage } from '../../pom/CalculatorPage'
import { ils } from '../../support/ils'

/**
 * Comparison feature e2e: the /compare page shows N scenarios side by side
 * against shared buyer inputs, with best-in-row highlighting and regulatory
 * status. Every figure is cross-checked against the main calculator's
 * displayed values (same pure functions, so the numbers must agree).
 */

test.describe('mortgage comparison - /compare', () => {
  let calc: CalculatorPage

  test.beforeEach(async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    calc = new CalculatorPage(page)
  })

  /** Navigate via the calculator CTA so the comparison is seeded from it. */
  async function gotoSeeded(): Promise<void> {
    await calc.goto()
    await calc.page.getByTestId('open-comparison').click()
    await expect(calc.page.getByTestId('compare-shell')).toBeVisible()
  }

  test('seeds from the calculator: same mix, same monthly payment', async ({ page }) => {
    // The calculator's ₪1,000,000 recommended mix at 15y shows ₪7,772 -
    // read the figure BEFORE navigating away, then find it again in the
    // comparison's first data column.
    await calc.goto()
    await expect(calc.monthlyPayment).toHaveText(ils(7_772))
    await calc.page.getByTestId('open-comparison').click()
    await expect(calc.page.getByTestId('compare-shell')).toBeVisible()
    const firstPaymentCell = page.getByTestId('compare-row-firstPayment').locator('td').first()
    await expect(firstPaymentCell).toContainText(ils(7_772))
  })

  test('default (direct) visit starts with two identical scenarios', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toBeVisible()
    // Two scenario columns, identical values, best badge hidden (a tie of
    // all columns highlights nothing).
    const row = page.getByTestId('compare-row-firstPayment')
    await expect(row.locator('td')).toHaveCount(2)
    await expect(row.locator('td.best')).toHaveCount(0)
  })

  test('tweaking one scenario highlights the best value per row', async ({ page }) => {
    await gotoSeeded()
    // Scenario 1: shorten its first track's term to 10 years - cheaper total
    // interest, higher first payment.
    await page.getByTestId('compare-track-years-1-1').fill('10')
    await page.getByTestId('compare-track-years-1-1').blur()

    // The shorter term must win the total-interest row (scenario 1 = first
    // td) while losing the first-payment row (scenario 2 = second td wins).
    const interestRow = page.getByTestId('compare-row-totalInterest')
    await expect(interestRow.locator('td').first()).toHaveClass(/best/)
    const paymentRow = page.getByTestId('compare-row-firstPayment')
    await expect(paymentRow.locator('td').nth(1)).toHaveClass(/best/)
  })

  test('duplicate scenario, edit the copy, then remove it', async ({ page }) => {
    await gotoSeeded()
    await page.getByTestId('compare-duplicate-1').click()
    // Three scenarios now; the copy sits next to the original with equal amounts.
    await expect(page.getByTestId('compare-track-2-1')).toBeVisible()
    const original = page.getByTestId('compare-track-amount-1-1')
    const copy = page.getByTestId('compare-track-amount-2-1')
    await expect(copy).toHaveValue(await original.inputValue())

    // Editing the copy leaves the original untouched.
    await copy.fill('800,000')
    await copy.blur()
    await expect(original).toHaveValue('400,000')

    // Remove the middle scenario (the edited copy) back down to two: what
    // was scenario 3 (an untouched duplicate) becomes scenario 2.
    await page.getByTestId('compare-scenario-remove-2').click()
    await expect(page.getByTestId('compare-track-amount-2-1')).toHaveValue('400,000')
    await expect(page.getByTestId('compare-scenario-remove-2')).toHaveCount(0)
  })

  test('shared inputs reprice every scenario; LTV status flips to a violation', async ({
    page,
  }) => {
    await gotoSeeded()
    // Property 1.2M, capital 200k → loan context 1M = 83.3% > 75% first-home
    // limit: both scenario columns show the LTV violation.
    await page.getByTestId('compare-property-value').fill('1,200,000')
    await page.getByTestId('compare-capital').fill('200,000')

    const statusRow = page.getByTestId('compare-row-status')
    await expect(statusRow).toContainText('חריגה מתקרת המימון')
    // Upfront total row shows the recommended cash figure for the shared deal.
    const upfrontRow = page.getByTestId('compare-row-upfront')
    await expect(upfrontRow).toContainText(ils(335_400))
  })

  test('mobile: stacked card view with a scenario switcher (no table)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/compare')
    await expect(page.getByTestId('compare-card')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toHaveCount(0)
    // Tab 2 shows scenario 2's metrics; the editor switches with it.
    await page.getByTestId('compare-switch-tab-2').click()
    await expect(page.getByTestId('compare-card')).toContainText('תרחיש 2')
    await expect(page.getByTestId('compare-scenario-editor-2')).toBeVisible()
    // No horizontal overflow at 375px.
    const overflow = (await page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('English page renders LTR with translated labels', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toContainText('First monthly payment')
    const dir = (await page.evaluate('document.documentElement.dir')) as string
    expect(dir).toBe('ltr')
  })

  test('Hebrew page renders RTL', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'hebrew'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    const dir = (await page.evaluate('document.documentElement.dir')) as string
    expect(dir).toBe('rtl')
  })

  test('dark theme: compare surfaces flip with the tokens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_theme', 'dark'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    const colors = (await page.evaluate(`(() => {
      const panel = document.querySelector('.compare-shared')
      return {
        background: getComputedStyle(panel).backgroundColor,
        ink: getComputedStyle(panel).color,
      }
    })()`)) as { background: string; ink: string }
    // Dark theme's --calc-paper is #16201f; the panel must not stay light.
    expect(colors.background).not.toBe('rgb(255, 253, 248)')
  })
})
