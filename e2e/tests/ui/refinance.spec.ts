import { test, expect } from '../../fixtures'
import { RefinancePage } from '../../pages/RefinancePage'
import { WebAppPage } from '../../pages/WebAppPage'
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

  test('prices a balloon on both sides and shows what is due at maturity', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()
    await refinance.fillExisting('100,000', '6', '120')
    await refinance.fillProposal('10', '4', '0')
    await refinance.expectReady()

    // A full balloon leaves the existing side interest-only: 100,000 at 6%.
    await refinance.existingBalloon.fill('100')
    await refinance.proposedBalloon.fill('40')
    await refinance.expectReady()

    await expect(refinance.existingPayment).toHaveText(ils(500))
    await expect(refinance.existingBalloonDue).toHaveText(ils(100_000))
    await expect(refinance.proposedBalloonDue).toHaveText(ils(40_000))
    await expect(refinance.balloonNote).toBeVisible()
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

  test('four identical offers share one row without a best-value badge', async ({ page }) => {
    const refinance = new RefinancePage(page)
    await refinance.goto()
    await refinance.fillExisting('100,000', '6', '120')
    await refinance.fillProposal('10', '4', '')
    for (let count = 0; count < 3; count++) {
      await refinance.addProposalPlan.click()
      await refinance.fillProposal('10', '4', '')
    }

    await expect(refinance.proposalResults).toHaveCount(4)
    await refinance.waitForResultMotion()
    const boxes = await refinance.proposalResultBoxes()
    // Four across one desktop row, all the same width.
    expect(new Set(boxes.map((box) => box.y)).size).toBe(1)
    expect(new Set(boxes.map((box) => box.x)).size).toBe(4)
    expect(new Set(boxes.map((box) => box.width)).size).toBe(1)

    // Every offer is identical, so none is recommended: no badge, no ring.
    await expect(refinance.proposalBestBadges).toHaveCount(0)
    await expect(refinance.proposalResults.first()).not.toContainText(
      'ההצעה המשתלמת ביותר',
    )

    // The payoff total and the new principal are results, not editor fields.
    await expect(refinance.proposedPanel).not.toContainText('סך היתרות')
    await expect(refinance.proposedPanel).not.toContainText('קרן ההלוואה החדשה')
    await expect(refinance.existingTotalBalance).toBeVisible()
    await expect(refinance.activeProposalResult).toContainText('קרן ההלוואה החדשה')

    // One clearly cheaper offer wins alone and earns the badge.
    await refinance.proposalTab(2).click()
    await refinance.newRate.fill('3.5')
    await expect(refinance.proposalBestBadges).toHaveCount(1)
    await expect(refinance.proposalBestBadges).toHaveAttribute(
      'data-testid',
      'refinance-proposal-result-2',
    )
  })

  test('hydrates without a server/client mismatch', async ({ page }) => {
    const messages: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        messages.push(message.text())
      }
    })
    await page.goto('/refinance')
    await expect(new RefinancePage(page).heading).toBeVisible()
    await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    const mismatches = messages.filter((text) => /hydrat|did not match|server rendered/i.test(text))
    expect(mismatches, `console:\n${messages.join('\n')}`).toEqual([])
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

  test('the way back leads with an arrow that points back', async ({ page }) => {
    for (const [path, direction] of [
      ['/refinance', 'rtl'],
      ['/en/refinance', 'ltr'],
    ] as const) {
      await page.goto(path)
      await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

      const geometry = (await page.evaluate(`(() => {
        const link = document.querySelector('[data-testid="refinance-back"]')
        const icon = link.querySelector('.compare-back-icon')
        const label = link.getBoundingClientRect()
        const arrow = icon.getBoundingClientRect()
        return {
          leads: link.firstElementChild === icon,
          mirrored: getComputedStyle(icon).transform !== 'none',
          onRight: arrow.x + arrow.width / 2 > label.x + label.width / 2,
        }
      })()`)) as { leads: boolean; mirrored: boolean; onRight: boolean }

      // The arrow precedes the label in reading order; in RTL that puts it on
      // the right and mirrors it to point back (right), unlike the trailing
      // arrow of the compare page's own way back.
      expect(geometry.leads).toBe(true)
      expect(geometry.mirrored).toBe(direction === 'rtl')
      expect(geometry.onRight).toBe(direction === 'rtl')
    }
  })

  test('the calculator action seeds the existing mortgage with the current mix', async ({
    calc,
  }) => {
    await calc.goto()
    const amount = await calc.track(1).amount().inputValue()
    const years = await calc.track(1).years().inputValue()
    const rate = await calc.track(1).rate().inputValue()

    await calc.page.getByTestId('open-refinance').click()
    // A live prime arriving makes the mix unsaved; leaving from the dialog must
    // still land on the seeded page.
    if (await calc.unsavedDialog.isVisible()) await calc.unsavedLeave.click()
    await expect(calc.page).toHaveURL(/\/refinance$/)

    const refinance = new RefinancePage(calc.page)
    await expect(refinance.balance).toHaveValue(amount)
    await expect(refinance.rate).toHaveValue(rate)
    await expect(refinance.remaining).toHaveValue(String(Number(years) * 12))
  })

  test('the calculator nav item seeds the same existing mortgage', async ({ calc }) => {
    await calc.page.setViewportSize({ width: 1440, height: 900 })
    await calc.goto()
    const amount = await calc.track(1).amount().inputValue()

    const app = new WebAppPage(calc.page)
    await app.calculatorsToggle.hover()
    await app.toolLink('refinance').click()
    if (await calc.unsavedDialog.isVisible()) await calc.unsavedLeave.click()
    await expect(calc.page).toHaveURL(/\/refinance$/)

    const refinance = new RefinancePage(calc.page)
    await expect(refinance.balance).toHaveValue(amount)
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
