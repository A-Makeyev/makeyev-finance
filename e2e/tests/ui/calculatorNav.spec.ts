import { test, expect } from '../../fixtures'
import { WebAppPage } from '../../pages/WebAppPage'

for (const locale of ['he', 'en']) {
  test(`calculator menu supports hover and keyboard without shifting links (${locale})`, async ({ mockedPage }) => {
    await mockedPage.setViewportSize({ width: 1440, height: 900 })
    const app = new WebAppPage(mockedPage)
    await app.goto(locale === 'he' ? '/' : '/en')
    const before = await app.calculatorsLink.boundingBox()
    await app.calculatorsLink.hover()
    await expect(app.calculatorsMenu).toBeVisible()
    await expect(app.toolLink('compare')).toHaveAttribute('href', locale === 'he' ? '/compare' : '/en/compare')
    await expect(app.toolLink('refinance')).toHaveAttribute('href', locale === 'he' ? '/refinance' : '/en/refinance')
    await mockedPage.keyboard.press('Escape')
    await expect(app.calculatorsMenu).toBeHidden()
    await expect(app.calculatorsToggle).toBeFocused()
    await app.calculatorsToggle.press('ArrowDown')
    await expect(app.toolLink('calculator')).toBeFocused()
    await mockedPage.keyboard.press('Tab')
    await expect(app.toolLink('compare')).toBeFocused()
    const after = await app.calculatorsLink.boundingBox()
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
    test(`opens on tap at ${width}px`, async ({ mockedPage }) => {
      await mockedPage.setViewportSize({ width, height: 900 })
      const app = new WebAppPage(mockedPage)
      await app.goto('/')
      await app.openMobileNavigation()
      await app.calculatorsToggle.tap()
      await expect(app.calculatorsMenu).toBeVisible()
      await app.expectNoHorizontalOverflow()
      await app.toolLink('compare').tap()
      await expect(mockedPage).toHaveURL(/\/compare$/)
      await expect(app.calculatorsMenu).toBeHidden()
    })
  }
})
