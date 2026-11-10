import { test } from '../../fixtures'
import { seedLanguage, seedTheme } from '../../fixtures/seed'
import { ComparePage } from '../../pages/ComparePage'
import { TrackTermsPage } from '../../pages/TrackTermsPage'

for (const language of ['hebrew', 'english'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [360, 800, 1440]) {
      test(`track term overrides: ${language}, ${theme}, ${width}`, async ({ calc }) => {
        await seedLanguage(calc.page, language)
        await seedTheme(calc.page, theme)
        await calc.page.setViewportSize({ width, height: 1000 })
        await calc.goto()
        const terms = new TrackTermsPage(calc.page)
        await terms.verifyOverrides()
        await terms.expectNoOverflow()
      })

      test(`Compare track term overrides: ${language}, ${theme}, ${width}`, async ({ mockedPage }) => {
        await seedLanguage(mockedPage, language)
        await seedTheme(mockedPage, theme)
        await mockedPage.setViewportSize({ width, height: 1000 })
        await new ComparePage(mockedPage).goto()
        const terms = new TrackTermsPage(mockedPage, 1)
        await terms.verifyOverrides()
        await terms.expectNoOverflow()
      })
    }
  }
}
