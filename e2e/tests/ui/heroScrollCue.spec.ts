import { test, type Page } from '@playwright/test'
import { HeroScrollCuePage } from '../../pom/HeroScrollCuePage'
import { installExternalMocks } from '../../support/mocks'

/**
 * The hero scroll-down cue: every hero banner (home + inner pages) carries a
 * round chevron button under its text that smooth-scrolls the first content
 * section into view. Asserted as a user would experience it: the button is
 * there, centered under the hero text, and clicking it lands the content
 * right below the fixed chrome - not mid-hero, not under the strips.
 *
 * External fetches are mocked (like the contact spec) so the fixed strips
 * render deterministically: the Indexes bar shows the mocked CPI feed and
 * the Markets strip shows fixed quotes, instead of real data re-wrapping
 * mid-test and changing the chrome height while the scroll runs.
 */
test.describe('hero scroll cue', () => {
  let cue: HeroScrollCuePage

  test.beforeEach(({ page }) => {
    cue = new HeroScrollCuePage(page)
  })

  async function installMocks(page: Page): Promise<void> {
    await installExternalMocks(page, {
      boiKeyRate: 4.5,
      cpi: {
        currentValue: '101.2',
        previousValue: '100.0',
        currentPercent: '1.2',
        currentPercentYear: '3.1',
        previousPercentYear: '2.9',
      },
    })
    // Fixed market quotes: the Markets strip renders one full-width line of
    // six assets (same fixture style as the marketTracker suite).
    await page.route('**/api/market/quotes**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          quotes: [
            { assetId: 'sp500', name: 'SPY', price: 765.96, change: 0, changePercent: 0, currency: 'USD', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
            { assetId: 'nasdaq', name: 'QQQ', price: 521.4, change: 1, changePercent: -0.3255, currency: 'USD', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
            { assetId: 'ta35', name: 'TA-35', price: 125.32, change: 1, changePercent: -0.781, currency: 'ILS', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
            { assetId: 'gold', name: 'GOLD', price: 4408.9, change: 1, changePercent: 0.9081, currency: 'USD', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
            { assetId: 'bitcoin', name: 'BTC', price: 79551.34, change: 1, changePercent: 1.24, currency: 'USD', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
            { assetId: 'usdils', name: 'USD/ILS', price: 3.0192, change: 1, changePercent: 0.386, currency: 'USD', timestamp: '2026-09-09T00:00:00.000Z', marketStatus: 'closed' },
          ],
          refreshIntervalMs: 900000,
          assets: [
            { id: 'sp500', name: 'SPY', symbol: 'SPY', type: 'etf', decimals: 2 },
            { id: 'nasdaq', name: 'QQQ', symbol: 'QQQ', type: 'etf', decimals: 2 },
            { id: 'ta35', name: 'TA-35', symbol: 'TA35.TA', type: 'index', decimals: 2 },
            { id: 'gold', name: 'GOLD', symbol: 'GC=F', type: 'commodity', decimals: 2, futures: true },
            { id: 'bitcoin', name: 'BTC', symbol: 'BINANCE:BTCUSDT', type: 'crypto', decimals: 0 },
            { id: 'usdils', name: 'USD/ILS', symbol: 'USDILS', type: 'currency', decimals: 4 },
          ],
        }),
      }),
    )
  }

  test('home: the cue is centered under the hero text and scrolls past the hero', async ({
    page,
    viewport,
  }) => {
    test.skip(
      (viewport?.width ?? 0) < 700,
      'centered-overlap geometry is pinned on desktop widths',
    )
    await installMocks(page)
    await cue.goto('/')
    await cue.expectCenteredNearHeroBottom()
    await cue.clickAndExpectContentLanded()
  })

  test('articles: the cue is present on inner-page banners and scrolls to the list', async ({
    page,
    viewport,
  }) => {
    test.skip(
      (viewport?.width ?? 0) < 700,
      'centered-overlap geometry is gated to desktop widths',
    )
    await installMocks(page)
    await cue.goto('/articles')
    await cue.expectCenteredNearHeroBottom()
    await cue.clickAndExpectContentLanded()
  })

  test('calculator: ArrowDown scrolls past the hero like the cue', async ({ page, viewport }) => {
    test.skip(
      (viewport?.width ?? 0) < 700,
      'hero-fill gating is asserted on desktop widths',
    )
    await installMocks(page)
    await cue.goto('/calculators')
    await cue.pressArrowDownAndExpectContentLanded()
  })
})
