import { test, expect } from '../../fixtures'
import { RatesPage } from '../../pages/RatesPage'
import { ratesFixture, ratesFixtureWithUnavailable } from '../../data/rates'
import { mockAverageRates, serveAverageRates } from '../../support/ratesMocks'

/**
 * The average-rate page: both official tables, current + 12 monthly rows,
 * honest stale/unavailable states, and a working path from the calculator's
 * average-rate card. Both languages and a 360px phone are covered because the
 * table is the widest surface on the site.
 */

const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

const HEADERS = {
  hebrew: {
    indexed: [
      'תוקף החל מ-',
      'ממוצע',
      'מעל 25 שנים',
      '20-25 שנים',
      '15-20 שנים',
      '10-15 שנים',
      '5-10 שנים',
      'עד 5 שנים',
    ],
    nonIndexed: [
      'תוקף החל מ-',
      'ממוצע',
      'מעל 25 שנים',
      '20-25 שנים',
      '15-20 שנים',
      '10-15 שנים',
      '5-10 שנים',
      '1-5 שנים',
      'עד שנה',
    ],
    upTo1Footnote: 'עד שנה',
  },
  english: {
    indexed: [
      'Valid from',
      'Average',
      'More than 25 years',
      '20-25 years',
      '15-20 years',
      '10-15 years',
      '5-10 years',
      'Up to 5 years',
    ],
    nonIndexed: [
      'Valid from',
      'Average',
      'More than 25 years',
      '20-25 years',
      '15-20 years',
      '10-15 years',
      '5-10 years',
      '1-5 years',
      'Up to 1 year',
    ],
    upTo1Footnote: 'up to 1 year',
  },
} as const

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`average rates - ${language} @ ${viewport.tag}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await serveAverageRates(page, ratesFixture())
      const rates = new RatesPage(page)
      await rates.goto(language)

      expect(await rates.documentDir()).toBe(language === 'hebrew' ? 'rtl' : 'ltr')
      expect(await rates.documentLang()).toBe(language === 'hebrew' ? 'he' : 'en')

      // Both tables, the current rate, and all 12 publications.
      await expect(rates.section('indexed')).toBeVisible()
      await expect(rates.section('nonIndexed')).toBeVisible()
      await expect(rates.current('indexed')).toContainText('3.49%')
      await expect(rates.current('indexed')).toContainText('2026')
      await expect(rates.current('nonIndexed')).toContainText('4.55%')
      expect(await rates.headers('indexed')).toEqual([...HEADERS[language].indexed])
      expect(await rates.headers('nonIndexed')).toEqual([...HEADERS[language].nonIndexed])
      expect(await rates.rowCount('indexed')).toBe(12)
      expect(await rates.rowCount('nonIndexed')).toBe(12)
      await expect(rates.currentRow('indexed')).toContainText('3.49%')
      await expect(rates.currentRow('nonIndexed')).toContainText('4.55%')

      // Official source is disclosed and leaves the site in a new tab.
      await expect(rates.sourceLink).toHaveAttribute('href', /boi\.org\.il\/.*interestrates\/mortgage/)
      await expect(rates.sourceLink).toHaveAttribute('target', '_blank')
      await expect(rates.footnotes).toContainText(HEADERS[language].upTo1Footnote)
      await expect(rates.footnotes).toContainText(
        language === 'hebrew' ? 'בנק ישראל' : 'Bank of Israel',
      )

      // A wide table scrolls inside its own wrapper, never the page.
      expect(await rates.pageOverflow(), `page overflow at ${viewport.width}px`).toBeLessThanOrEqual(1)
      await expect(rates.tableWrap('indexed')).toHaveAttribute('tabindex', '0')
      if (viewport.width === 360) {
        expect(await rates.wrapperOverflow('indexed')).toBeGreaterThan(0)
      }
    })
  }
}

test.describe('degraded data', () => {
  test('a stale table still renders, with a disclosure', async ({ page }) => {
    const body = ratesFixture()
    body.tables[0] = { ...body.tables[0], status: 'stale' }
    await serveAverageRates(page, body)
    const rates = new RatesPage(page)
    await rates.goto('hebrew')

    await expect(rates.stale('indexed')).toBeVisible()
    await expect(rates.stale('nonIndexed')).toHaveCount(0)
    await expect(rates.table('indexed')).toBeVisible()
    expect(await rates.rowCount('indexed')).toBe(12)
  })

  test('one unavailable table does not hide the other, and retry recovers it', async ({ page }) => {
    let online = false
    await mockAverageRates(page, () => ({
      status: 200,
      body: online ? ratesFixture() : ratesFixtureWithUnavailable('indexed'),
    }))
    const rates = new RatesPage(page)
    await rates.goto('hebrew')

    await expect(rates.unavailable('indexed')).toBeVisible()
    await expect(rates.table('indexed')).toHaveCount(0)
    await expect(rates.table('nonIndexed')).toBeVisible()
    await expect(rates.current('nonIndexed')).toContainText('4.55%')

    online = true
    await rates.retryTable('indexed').click()
    await expect(rates.table('indexed')).toBeVisible()
    await expect(rates.unavailable('indexed')).toHaveCount(0)
  })

  test('a failed API request shows the error card and retry recovers', async ({ page }) => {
    let online = false
    await mockAverageRates(page, () =>
      online
        ? { status: 200, body: ratesFixture() }
        : { status: 500, body: { error: 'rates unavailable' } },
    )
    const rates = new RatesPage(page)
    await rates.goto('hebrew')

    await expect(rates.pageError).toBeVisible()
    await expect(rates.root).not.toContainText('3.49%')

    online = true
    await rates.retryPage.click()
    await expect(rates.table('indexed')).toBeVisible()
    await expect(rates.pageError).toHaveCount(0)
  })
})

test.describe('calculator entry point', () => {
  test('the average-rate result card links to our rates page', async ({ calc }) => {
    await calc.goto()
    await calc.showAllResults()
    await calc.openResultCard('avg-rate')

    await expect(calc.resultsCardModalLink).toHaveAttribute('href', '/rates')
    await expect(calc.resultsCardModalLink).not.toHaveAttribute('target', '_blank')
  })
})

test.describe('dark theme', () => {
  test.use({ theme: 'dark' })

  test('the rate cards use the dark surface tokens', async ({ themedPage }) => {
    await serveAverageRates(themedPage, ratesFixture())
    const rates = new RatesPage(themedPage)
    await rates.goto('hebrew')

    expect(await rates.pageTheme()).toBe('dark')
    await expect(rates.section('indexed')).toBeVisible()
    expect(await rates.sectionBackground('indexed')).not.toBe('rgb(255, 255, 255)')
  })
})
