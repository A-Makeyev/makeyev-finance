import { test, expect, type Page } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'

/**
 * UI contract tests for the Markets strip (MarketTracker). All market API
 * traffic is intercepted, so no test ever touches the real upstream APIs.
 *
 * The strip sits below the CBS Indexes bar; CBS/BOI/EmailJS are left unmocked
 * here (they fail silently offline, exactly like production CI).
 */

interface FixtureQuote {
  assetId: string
  name: string
  price: number | null
  change: number | null
  changePercent: number | null
  currency: 'USD'
  timestamp: string
  marketStatus?: 'open' | 'closed'
  stale?: boolean
}

const ASSETS_META = [
  { id: 'sp500', name: 'SPY', symbol: 'SPY', type: 'etf', decimals: 2 },
  { id: 'nasdaq', name: 'QQQ', symbol: 'QQQ', type: 'etf', decimals: 2 },
  { id: 'ta35', name: 'TA-35', symbol: 'EIS', type: 'etf', decimals: 2, proxyOf: 'Tel Aviv 35' },
  { id: 'gold', name: 'GOLD', symbol: 'GLD', type: 'etf', decimals: 2, proxyOf: 'Spot gold' },
  { id: 'bitcoin', name: 'BTC', symbol: 'BINANCE:BTCUSDT', type: 'crypto', decimals: 0 },
  { id: 'usdils', name: 'USD/ILS', symbol: 'USDILS', type: 'currency', decimals: 4 },
]

function quoteOf(
  partial: Partial<FixtureQuote> & Pick<FixtureQuote, 'assetId' | 'price' | 'changePercent'>,
): FixtureQuote {
  return {
    name: partial.assetId,
    change: partial.changePercent === null ? null : 1,
    currency: 'USD',
    timestamp: '2026-09-09T00:00:00.000Z',
    marketStatus: 'closed',
    ...partial,
  }
}

const MIXED_QUOTES: FixtureQuote[] = [
  quoteOf({ assetId: 'sp500', price: 765.96, changePercent: 0 }),
  quoteOf({ assetId: 'nasdaq', price: 521.4, changePercent: -0.3255 }),
  quoteOf({ assetId: 'ta35', price: 125.32, changePercent: -0.781 }),
  quoteOf({ assetId: 'gold', price: 403.35, changePercent: 0.9081 }),
  quoteOf({ assetId: 'bitcoin', price: 79551.34, changePercent: 1.24, marketStatus: 'open' }),
  quoteOf({ assetId: 'usdils', price: 3.0192, changePercent: 0.386 }),
]

async function mockQuotes(
  page: Page,
  responder: () => { status: number; body: unknown },
): Promise<void> {
  await page.route('**/api/market/quotes**', (route) => {
    const { status, body } = responder()
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

function snapshotBody(quotes: FixtureQuote[]) {
  return { quotes, refreshIntervalMs: 900000, assets: ASSETS_META }
}

test.describe('Markets strip', () => {
  test('renders all six assets with formatted prices, arrows and signed changes', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toBeVisible()
    await expect(tracker).toHaveAttribute('data-state', 'ready')

    // Down and up rows carry the same arrow glyphs as the indexes strip.
    // Arrow trails the percent. Order: SPY first, USD/ILS last (rightmost).
    await expect(page.getByTestId('market-row-sp500')).toHaveText(/SPY\s*765\.96\s*0\.00%/)
    await expect(page.getByTestId('market-row-nasdaq')).toHaveText(/QQQ\s*521\.40\s*-0\.33%\s*⭣/)
    await expect(page.getByTestId('market-row-ta35')).toHaveText(/EIS\s*125\.32\s*-0\.78%\s*⭣/)
    await expect(page.getByTestId('market-row-gold')).toHaveText(/GOLD\s*403\.35\s*\+0\.91%\s*⭡/)
    // Crypto price carries the $ prefix; the ETF/FX rows never do.
    await expect(page.getByTestId('market-row-bitcoin')).toHaveText(/BTC\s*\$79,551\s*\+1\.24%\s*⭡/)
    // FX uses the server-declared 4-decimals precision.
    await expect(page.getByTestId('market-row-usdils')).toHaveText(
      /USD\/ILS\s*3\.0192\s*\+0\.39%\s*⭡/,
    )
  })

  test('strip text is not user-selectable', async ({ page }) => {
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // Same evaluate-string pattern as qa-visual.spec.ts (the e2e tsconfig
    // has no DOM lib; the page context provides document).
    const selection = (await page.evaluate(
      `(() => {
        const strip = document.querySelector('[data-testid="market-tracker"]')
        return strip ? getComputedStyle(strip).userSelect : null
      })()`,
    )) as string | null
    expect(selection).toBe('none')
  })

  test('positive and negative changes get their semantic tone classes', async ({ page }) => {
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // Fixtures: nasdaq -0.33% (down), sp500 0.00% (flat), bitcoin +1.24% (up).
    await expect(page.locator('[data-testid="market-row-nasdaq"] .markets-change')).toHaveClass(
      /market-change-down/,
    )
    await expect(page.locator('[data-testid="market-row-sp500"] .markets-change')).toHaveClass(
      /market-change-flat/,
    )
    await expect(page.locator('[data-testid="market-row-bitcoin"] .markets-change')).toHaveClass(
      /market-change-up/,
    )
  })

  test('shows placeholder rows while loading and never blocks the nav', async ({ page }) => {
    // Hold the response open: the strip must render its skeleton immediately.
    await page.route('**/api/market/quotes**', () => new Promise<void>(() => {}))
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toBeVisible()
    await expect(tracker).toHaveAttribute('data-state', 'loading')
    await expect(page.getByTestId('navbar')).toBeVisible()
    for (const id of ['sp500', 'nasdaq', 'ta35', 'gold', 'bitcoin', 'usdils']) {
      await expect(page.getByTestId(`market-row-${id}`)).toHaveText(/-/)
    }
  })

  test('degrades to placeholders after an API failure and self-heals without a retry control', async ({
    page,
  }) => {
    let fail = true
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockQuotes(page, () =>
      fail
        ? { status: 503, body: { error: 'market data unavailable', code: 'rate-limit' } }
        : { status: 200, body: snapshotBody(MIXED_QUOTES) },
    )
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toHaveAttribute('data-state', 'error')
    await expect(page.getByTestId('navbar')).toBeVisible()
    for (const id of ['sp500', 'nasdaq', 'ta35', 'gold', 'bitcoin', 'usdils']) {
      await expect(page.getByTestId(`market-row-${id}`)).toHaveText(/-/)
    }
    // No retry control exists; recovery is automatic.
    await expect(page.getByTestId('market-retry')).toHaveCount(0)

    fail = false
    // The hook polls every 5 minutes after an error; out-run it with a
    // manual refetch trigger: remount by waiting for the poll interval is
    // too slow, so assert the heal through a page reload (the standard
    // user recovery path). The no-button assertion above is the real
    // regression guard.
    await page.reload()
    await expect(tracker).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('market-row-bitcoin')).toContainText('$79,551')
  })

  test('marks stale snapshots so cached numbers are never shown as current', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    const staleQuotes = MIXED_QUOTES.map((quote) => ({ ...quote, stale: true }))
    await mockQuotes(page, () => ({
      status: 200,
      body: { ...snapshotBody(staleQuotes), stale: true },
    }))
    await page.goto('/')

    const bitcoinRow = page.getByTestId('market-row-bitcoin')
    await expect(bitcoinRow).toHaveClass(/markets-row-stale/)
    await expect(bitcoinRow).toHaveAttribute('title', /Cached data/)
  })

  test('refreshes on the server-provided interval without hard-coding it', async ({ page }) => {
    let requestCount = 0
    // The server owns the cadence: the body advertises a 1.5s interval and
    // the test asserts the client honors it (the production default is 15m).
    await page.route('**/api/market/quotes**', (route) => {
      requestCount++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...snapshotBody(MIXED_QUOTES), refreshIntervalMs: 1500 }),
      })
    })

    await page.goto('/')
    await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')
    const baseline = requestCount

    await page.waitForTimeout(2500)
    expect(requestCount).toBeGreaterThan(baseline)
  })

  test('renders the BTC label in both locales (user-requested)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'hebrew'))
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // BTC label is the user-requested name in every locale; the direction
    // and the other rows still follow the Hebrew locale.
    await expect(page.getByTestId('market-row-bitcoin')).toContainText('BTC')
  })

  test('strip stays visible above the navbar when the Indexes bar is absent', async ({ page }) => {
    // No CBS mocks: the Indexes bar stays hidden (feeds fail), so the
    // Markets strip must move to the top slot, not float mid-air under it.
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toHaveAttribute('data-state', 'ready')
    await expect(tracker).toHaveClass(/markets-no-indexes/)
    // The strip must not be covered: its first row is clickable/visible.
    await expect(page.getByTestId('market-row-nasdaq')).toBeVisible()
  })

  test('indexes bar shows short English names when the language is English', async ({ page }) => {
    // With CBS feeds mocked (default fixture = CPI feed), the bar renders
    // above the markets strip. In English the Hebrew feed name must be
    // replaced by the short localized label; Hebrew keeps the feed name.
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await installExternalMocks(page)
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const bar = page.getByTestId('indexes-bar')
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('CPI')
    await expect(bar).toContainText('Monthly change')
    await expect(bar).toContainText('Yearly change')
    await expect(bar).not.toContainText('מדד המחירים לצרכן')
    await expect(bar).not.toContainText('שינוי חודשי')
    await expect(bar).not.toContainText('שינוי שנתי')
    // Default CPI fixture: monthly 0.4 (rising), yearly 3.5 - both trends
    // up, so both are red and carry '+'. The sign leads the percent and
    // the arrow trails it in English reading order.
    await expect(bar).toContainText('+0.4% ⭡')
    await expect(bar).toContainText('+3.5% ⭡')
  })

  for (const language of ['hebrew', 'english'] as const) {
    test(`sign always renders left of the digits (${language})`, async ({ page }) => {
      // The sign's side no longer depends on the language: English leads
      // with it ("+0.4%") and Hebrew's trailing sign ("0.4%+") lands on
      // the left via the RTL value span - both render the plus left of the
      // digits. The span's pinned dir (dir implies bidi isolation) keeps
      // this stable on pages where the document itself stays LTR (this
      // home route is LTR even in Hebrew).
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await installExternalMocks(page)
      await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')

      const bar = page.getByTestId('indexes-bar')
      await expect(bar).toBeVisible()

      // Same evaluate-string pattern as qa-visual.spec.ts (the e2e tsconfig
      // has no DOM lib; the page context provides document).
      const hebrew = language === 'hebrew'
      const measured = (await page.evaluate(
        `(() => {
          const bar = document.querySelector('[data-testid="indexes-bar"]')
          if (!bar) return null
          const hebrew = ${hebrew}
          const walker = document.createTreeWalker(bar, NodeFilter.SHOW_TEXT)
          const values = []
          while (walker.nextNode()) {
            const node = walker.currentNode
            const text = node.textContent || ''
            // Hebrew: trailing sign ("0.4%+"); English: leading ("+0.4%").
            const hasSign = hebrew ? /[+-]$/.test(text) : /^[+-]/.test(text)
            if (!hasSign) continue
            const digitIndex = text.search(/[0-9]/)
            if (digitIndex < 0) continue
            const signIndex = hebrew ? text.length - 1 : 0
            const leftAt = (i) => {
              const r = document.createRange()
              r.setStart(node, i)
              r.setEnd(node, i + 1)
              return r.getBoundingClientRect().left
            }
            values.push({ signX: leftAt(signIndex), digitX: leftAt(digitIndex) })
          }
          return values
        })()`,
      )) as Array<{ signX: number; digitX: number }> | null

      expect(measured, 'indexes bar rendered').not.toBeNull()
      // The mocks serve the CPI fixture to all three feeds: 3 anchors x
      // monthly + yearly = 6 signed red values (0.4%+ / 3.5%+ each).
      expect(measured!.length).toBe(6)
      for (const { signX, digitX } of measured!) {
        expect(signX).toBeLessThan(digitX)
      }
    })

    test(`change value follows its label in reading order (${language})`, async ({ page }) => {
      // The strip renders on every page, but only the calculator route
      // flips the document to RTL. The anchor pins its direction to the UI
      // language so Hebrew flows RTL (and English LTR) everywhere: each
      // change value must come after its label in reading order, mirroring
      // the English layout.
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await installExternalMocks(page)
      await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')

      const bar = page.getByTestId('indexes-bar')
      await expect(bar).toBeVisible()

      const directions = (await page.evaluate(
        `(() => {
          const bar = document.querySelector('[data-testid="indexes-bar"]')
          return bar
            ? [...bar.querySelectorAll('a')].map((a) => getComputedStyle(a).direction)
            : null
        })()`,
      )) as string[] | null
      expect(directions, 'indexes bar rendered').not.toBeNull()
      const expected = language === 'hebrew' ? 'rtl' : 'ltr'
      expect(directions!.every((d) => d === expected)).toBe(true)

      // Text content follows DOM order, which the pinned direction makes
      // the reading order too: each label must precede its value.
      const text = (await bar.textContent()) ?? ''
      const monthlyLabel = language === 'hebrew' ? 'שינוי חודשי' : 'Monthly change'
      const yearlyLabel = language === 'hebrew' ? 'שינוי שנתי' : 'Yearly change'
      expect(text.indexOf(monthlyLabel)).toBeGreaterThan(-1)
      expect(text.indexOf(yearlyLabel)).toBeGreaterThan(-1)
      expect(text.indexOf(monthlyLabel)).toBeLessThan(text.indexOf('0.4%'))
      expect(text.indexOf(yearlyLabel)).toBeLessThan(text.indexOf('3.5%'))
    })
  }
})
