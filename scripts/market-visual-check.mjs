import { chromium } from '@playwright/test'
import fs from 'node:fs'

/**
 * One-off visual check for the Markets strip: desktop + phone widths in
 * Hebrew and English. Screenshot-only; not part of the CI matrix.
 */
const BASE = process.env.CHECK_URL ?? 'http://localhost:3999'
const outDir = 'test-results/market-visual'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const cases = [
  { name: 'desktop-he', width: 1440, height: 900, language: 'hebrew' },
  { name: 'desktop-en', width: 1440, height: 900, language: 'english' },
  // Mid widths are where six rows wrap onto two lines: the strip grows and
  // the navbar must clear the real height (overlap regression watch).
  { name: 'mid-he', width: 1100, height: 900, language: 'hebrew' },
  { name: 'mid-en', width: 800, height: 900, language: 'english' },
  { name: 'phone-he', width: 390, height: 844, language: 'hebrew' },
  { name: 'phone-en', width: 390, height: 844, language: 'english' },
]

for (const { name, width, height, language } of cases) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
  // Serve deterministic quotes so the strip renders real rows.
  await page.route('**/api/market/quotes**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        quotes: [
          {
            assetId: 'sp500',
            name: 'SPY',
            price: 765.96,
            change: -4.23,
            changePercent: -0.5492,
            currency: 'USD',
            timestamp: '2026-09-08T00:00:00.000Z',
            marketStatus: 'closed',
          },
          {
            assetId: 'nasdaq',
            name: 'QQQ',
            price: 521.4,
            change: -1.7,
            changePercent: -0.3255,
            currency: 'USD',
            timestamp: '2026-09-08T00:00:00.000Z',
            marketStatus: 'closed',
          },
          {
            assetId: 'ta35',
            name: 'TA-35',
            price: 2345.67,
            change: -18.46,
            changePercent: -0.781,
            // ILS, matching the registry: an index level is points, so the
            // row must render bare (no $ prefix) in the visual check too.
            currency: 'ILS',
            timestamp: '2026-09-08T00:00:00.000Z',
            marketStatus: 'closed',
          },
          {
            assetId: 'gold',
            name: 'GOLD',
            // COMEX front-month futures (GC=F), matching the registry: the
            // row must show the metal's own price, not a GLD share price.
            price: 4408.9,
            change: 39.7,
            changePercent: 0.9081,
            currency: 'USD',
            timestamp: '2026-09-08T00:00:00.000Z',
            marketStatus: 'closed',
          },
          {
            assetId: 'bitcoin',
            name: 'BTC',
            price: 79551.34,
            change: -411.95,
            changePercent: -0.5214,
            currency: 'USD',
            timestamp: '2026-09-09T13:29:06.000Z',
            marketStatus: 'open',
          },
          {
            assetId: 'usdils',
            name: 'USD/ILS',
            price: 3.0192,
            change: 0.0074,
            changePercent: 0.2458,
            currency: 'USD',
            timestamp: '2026-09-08T00:00:00.000Z',
            marketStatus: 'closed',
          },
        ],
        refreshIntervalMs: 10000,
        assets: [
          { id: 'sp500', name: 'SPY', symbol: 'SPY', type: 'etf', decimals: 2 },
          { id: 'nasdaq', name: 'QQQ', symbol: 'QQQ', type: 'etf', decimals: 2 },
          {
            id: 'ta35',
            name: 'TA-35',
            symbol: 'TA35.TA',
            type: 'index',
            decimals: 2,
          },
          {
            id: 'gold',
            name: 'GOLD',
            symbol: 'GC=F',
            type: 'commodity',
            decimals: 2,
            futures: true,
          },
          {
            id: 'bitcoin',
            name: 'BTC',
            symbol: 'BINANCE:BTCUSDT',
            type: 'crypto',
            decimals: 0,
          },
          { id: 'usdils', name: 'USD/ILS', symbol: 'USDILS', type: 'currency', decimals: 4 },
        ],
      }),
    }),
  )
  await page.goto(`${BASE}/`)
  await page.waitForTimeout(1200)
  const tracker = page.getByTestId('market-tracker')
  const visible = await tracker.isVisible().catch(() => false)
  // Overlap guard: the navbar's bottom edge must sit at or below the
  // strip's bottom edge (strip is z-index 98, navbar 99 and frosted, so an
  // under-clear navbar slab visibly covers the wrapped second line).
  const geometry = visible
    ? await page.evaluate(
        `(() => {
          const strip = document.querySelector('[data-testid="market-tracker"]').getBoundingClientRect()
          const nav = document.getElementById('navbar').getBoundingClientRect()
          return { stripBottom: strip.bottom, navTop: nav.top, overlap: nav.top < strip.bottom }
        })()`,
      )
    : null
  console.log(
    `${name}: strip visible = ${visible}` +
      (geometry
        ? ` navTop=${geometry.navTop.toFixed(1)} stripBottom=${geometry.stripBottom.toFixed(1)} OVERLAP=${geometry.overlap}`
        : ''),
  )
  if (visible) {
    for (const id of ['sp500', 'nasdaq', 'ta35', 'gold', 'bitcoin', 'usdils']) {
      const row = page.getByTestId(`market-row-${id}`)
      console.log(`  ${id}: ${(await row.textContent())?.trim()}`)
    }
  }
  await page.screenshot({
    path: `${outDir}/${name}.png`,
    clip: { x: 0, y: 0, width, height: Math.min(height, 260) },
  })
  await context.close()
}

await browser.close()
console.log(`screenshots in ${outDir}`)
