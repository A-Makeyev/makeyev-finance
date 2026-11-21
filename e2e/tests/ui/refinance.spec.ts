import { test, expect } from '../../fixtures'
import { RefinancePage } from '../../pages/RefinancePage'
import { ils } from '../../support/ils'

/**
 * Keep-versus-refinance smoke coverage: the page never fills a missing value,
 * and the same verified fee is either paid once in cash or added once to the
 * principal.
 */
test.describe('mortgage refinance - /refinance', () => {
  test('projects both sides and reports the cash-fee break-even', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()

    await expect(refinance.heading).toBeVisible()
    await expect(refinance.incomplete).toHaveCount(0)

    await refinance.fillExisting('100,000', '6', '120')
    await refinance.fillProposal('10', '4', '2,000')
    await refinance.expectReady()

    await expect(page.getByTestId('refinance-results')).toContainText(ils(1_110))
    await expect(page.getByTestId('refinance-results')).toContainText(ils(1_012))
    await expect(page.getByTestId('refinance-cashflow-fees')).toContainText('-')
    await expect(refinance.breakEven).toContainText('חודש 21')
  })

  test('capitalizes the fee into the principal instead of charging cash', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()
    await refinance.fillExisting('100,000', '6', '120')
    await refinance.fillProposal('10', '4', '2,000')
    await refinance.expectReady()

    await page.getByRole('radio', { name: 'מגולגלת לקרן' }).check()

    await expect(page.getByTestId('refinance-proposed-principal')).toHaveText(ils(102_000))
    await expect(page.getByTestId('refinance-cashflow-fees')).toHaveText(ils(0))
  })

  test('renders in English LTR at 360px without overflowing', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/en/refinance')
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr')
    await expect(page.getByRole('heading', { name: 'Mortgage refinancing', level: 1 })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('is reachable from the calculator header, not only from compare', async ({ calc }) => {
    await calc.goto()
    const link = calc.page.getByTestId('open-refinance')
    await expect(link).toBeVisible()
    await link.click()
    await expect(calc.page).toHaveURL(/\/refinance$/)
  })

  test('starts below the fixed chrome and keeps the footer below the page', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()

    const nav = (await page.getByTestId('navbar').boundingBox())!
    const heading = (await refinance.heading.boundingBox())!
    expect(heading.y).toBeGreaterThanOrEqual(nav.y + nav.height)

    const viewport = page.viewportSize()!
    const footer = (await page.locator('footer').boundingBox())!
    expect(footer.y).toBeGreaterThanOrEqual(viewport.height - 1)
  })

  test('uses the same rotating select chevron as the calculator', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()

    // FlipSelect marks its wrapper open on mousedown; the chevron rotation is
    // the calculator's own CSS, not a native select arrow.
    await page.getByTestId('refinance-type-1').dispatchEvent('mousedown')
    await expect(page.locator('.select-wrap.open .select-chevron')).toHaveCount(1)
    const transform = await page
      .locator('.select-wrap.open .select-chevron')
      .evaluate((element) => getComputedStyle(element).transform)
    expect(transform).not.toBe('none')
  })

  test('only a resetting track asks for a reset date, and the assumption moves its payment', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()
    await refinance.fillExisting('100,000', '5', '120')
    await refinance.fillProposal('10', '5', '0')
    await refinance.expectReady()

    // A fixed track has no next reset date to record.
    await expect(refinance.nextReset).toHaveCount(0)
    const flatInterest = await refinance.existingInterest.textContent()

    await refinance.existingType.selectOption('variable')
    await expect(refinance.nextReset).toBeVisible()
    // With the assumption still at 0 the variable track prices flat.
    await expect(refinance.existingInterest).toHaveText(flatInterest ?? '')

    // A resetting variable track over 10 years resets before maturity, so a
    // +1pp assumption raises the remaining interest.
    await refinance.resetStep.fill('1')
    await expect(refinance.existingInterest).not.toHaveText(flatInterest ?? '')
  })

  test('keeps a missing balance unknown and hides the projection', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()
    await refinance.fillExisting('100,000', '6', '120')
    await refinance.fillProposal('10', '4', '2,000')
    await refinance.expectReady()

    await refinance.balance.fill('')

    await expect(refinance.results).toHaveCount(0)
    await expect(refinance.incomplete).toHaveCount(0)
  })
})
