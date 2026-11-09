import { test } from '../../../fixtures'
import { CalculatorLayoutPage } from '../../../pages/CalculatorLayoutPage'
import { seedLanguage, seedTheme } from '../../../fixtures/seed'

test('accepts a negative market-margin discount', async ({ calc }) => {
  await calc.goto()
  await new CalculatorLayoutPage(calc.page).expectNegativeMarginAccepted()
})

for (const language of ['hebrew', 'english'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`sample cards and track layout: ${language}, ${theme}`, async ({ calc }, testInfo) => {
      await seedLanguage(calc.page, language)
      await seedTheme(calc.page, theme)
      await calc.goto()
      const layout = new CalculatorLayoutPage(calc.page)
      await layout.expectMarginDirection()
      await layout.openSamples()
      for (const width of [1440, 800, 360]) {
        await calc.page.setViewportSize({ width, height: 1000 })
        await layout.expectAlignedSamples()
        await layout.expectNoPageOverflow()
        if (width === 1440) await layout.expectMethodLastInFirstRow()
        const path = testInfo.outputPath(`layout-${width}.png`)
        await layout.screenshot(path)
        await testInfo.attach(`layout-${width}`, { path, contentType: 'image/png' })
      }
    })
  }
}
