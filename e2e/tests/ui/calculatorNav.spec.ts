import { test, expect } from '../../fixtures'
import { WebAppPage } from '../../pages/WebAppPage'

for (const locale of ['he', 'en']) {
  test(`calculator menu opens from the whole label, not a redirect (${locale})`, async ({ mockedPage }) => {
    await mockedPage.setViewportSize({ width: 1440, height: 900 })
    const app = new WebAppPage(mockedPage)
    await app.goto(locale === 'he' ? '/' : '/en')
    const before = await app.calculatorsToggle.boundingBox()

    // Hover is the desktop shortcut.
    await app.calculatorsToggle.hover()
    await expect(app.calculatorsMenu).toBeVisible()
    await expect(app.toolLink('compare')).toHaveAttribute('href', locale === 'he' ? '/compare' : '/en/compare')
    await expect(app.toolLink('refinance')).toHaveAttribute('href', locale === 'he' ? '/refinance' : '/en/refinance')

    await mockedPage.keyboard.press('Escape')
    await expect(app.calculatorsMenu).toBeHidden()
    await expect(app.calculatorsToggle).toBeFocused()

    // Clicking the label is a disclosure, not a navigation to /calculators.
    await app.calculatorsToggle.click()
    await expect(app.calculatorsMenu).toBeVisible()
    await expect(mockedPage).toHaveURL(locale === 'he' ? /\/$/ : /\/en$/)

    await mockedPage.keyboard.press('Escape')
    await app.calculatorsToggle.press('ArrowDown')
    await expect(app.toolLink('calculator')).toBeFocused()
    await mockedPage.keyboard.press('Tab')
    await expect(app.toolLink('compare')).toBeFocused()

    const after = await app.calculatorsToggle.boundingBox()
    expect(after?.width).toBeCloseTo(before!.width, 0)
    expect(after?.x).toBeCloseTo(before!.x, 0)
    await app.toolLink('refinance').click()
    await expect(mockedPage).toHaveURL(/\/refinance$/)
    await expect(app.calculatorsMenu).toBeHidden()
  })
}

test.describe('touch calculator navigation', () => {
  test.use({ hasTouch: true })
  for (const width of [360, 768]) {
    test(`opens on tapping the label at ${width}px`, async ({ mockedPage }) => {
      await mockedPage.setViewportSize({ width, height: 900 })
      const app = new WebAppPage(mockedPage)
      await app.goto('/')
      await app.openMobileNavigation()
      await app.calculatorsToggle.tap()
      await expect(app.calculatorsMenu).toBeVisible()
      await app.expectNoHorizontalOverflow()
      // The landing page is the first row, so it stays reachable in one tap.
      await app.toolLink('calculator').tap()
      await expect(mockedPage).toHaveURL(/\/calculators$/)
      await expect(app.calculatorsMenu).toBeHidden()
    })
  }
})
