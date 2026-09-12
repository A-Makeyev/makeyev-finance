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
  currency: 'USD' | 'ILS'
  timestamp: string
  marketStatus?: 'open' | 'closed'
  stale?: boolean
}

const ASSETS_META = [
  { id: 'sp500', name: 'SPY', symbol: 'SPY', type: 'etf', decimals: 2 },
  { id: 'nasdaq', name: 'QQQ', symbol: 'QQQ', type: 'etf', decimals: 2 },
  { id: 'ta35', name: 'TA-35', symbol: 'TA35.TA', type: 'index', decimals: 2 },
  { id: 'gold', name: 'GOLD', symbol: 'GC=F', type: 'commodity', decimals: 2, futures: true },
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
  // TA-35 is the real TASE index level, quoted in ILS: no $ prefix.
  quoteOf({ assetId: 'ta35', price: 125.32, changePercent: -0.781, currency: 'ILS' }),
  // Gold is the COMEX front-month contract: dollars per ounce of the metal,
  // not the ~$400 GLD share price it used to show.
  quoteOf({ assetId: 'gold', price: 4408.9, changePercent: 0.9081 }),
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

/**
 * Records every movement-flash pill the strip renders, with the paint data
 * captured at insertion time (the pill is removed ~1200ms later, so reading
 * the DOM afterwards would race). Installed AFTER navigation: the strip is
 * mounted by then, and the first fill is deliberately silent, so nothing is
 * missed. A tick renders ONE pill spanning the whole value pair. Same
 * evaluate-string pattern as qa-visual.spec.ts (the e2e tsconfig has no DOM
 * lib; the page context provides document).
 */
async function recordFlashes(page: Page): Promise<void> {
  await page.evaluate(
    `(() => {
      window.__marketFlashes = []
      const strip = document.querySelector('[data-testid="market-tracker"]')
      if (!strip) return
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType !== 1 || !node.hasAttribute('data-tick')) continue
            const style = getComputedStyle(node)
            const box = node.getBoundingClientRect()
            // The pill's span must cover both value cells it sits behind:
            // left edge at/before the price cell's left, right edge at/after
            // the change cell's right (inset -5px gives ~5px of bleed each
            // side). 1px slack for subpixel rounding.
            const wrapper = node.parentElement
            const price = wrapper && wrapper.querySelector('.markets-price')
            const change = wrapper && wrapper.querySelector('.markets-change')
            const priceBox = price ? price.getBoundingClientRect() : null
            const changeBox = change ? change.getBoundingClientRect() : null
            window.__marketFlashes.push({
              tick: node.getAttribute('data-tick'),
              className: node.className,
              background: style.backgroundColor,
              display: style.display,
              width: Math.round(box.width),
              height: Math.round(box.height),
              spansPrice:
                priceBox !== null &&
                box.left <= priceBox.left + 1 &&
                box.right >= priceBox.right - 1,
              spansChange:
                changeBox !== null &&
                box.left <= changeBox.left + 1 &&
                box.right >= changeBox.right - 1,
            })
          }
        }
      }).observe(strip, { childList: true, subtree: true })
    })()`,
  )
}

/** The two movement tints, mirrored from the .markets-tick-* rules in globals.css. */
const FLASH_GREEN = 'rgba(35, 210, 65, 0.14)'
const FLASH_RED = 'rgba(210, 60, 60, 0.14)'

interface RecordedFlash {
  tick: 'up' | 'down'
  className: string
  background: string
  display: string
  width: number
  height: number
  /** True when the pill's box covers the price cell's full width. */
  spansPrice: boolean
  /** True when the pill's box covers the change cell's full width. */
  spansChange: boolean
}

function flashes(page: Page): Promise<RecordedFlash[]> {
  return page.evaluate(`window.__marketFlashes`) as Promise<RecordedFlash[]>
}

/**
 * Price schedule for the flash tests: a baseline held long enough for the
 * page to settle, then the move under test. The strip polls on the interval
 * the body advertises (300ms here).
 */
function priceSchedule(steps: Array<[number, number]>) {
  return (call: number) => {
    let price = steps[0][1]
    for (const [fromCall, value] of steps) if (call >= fromCall) price = value
    return price
  }
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
    // USD-quoted instruments carry the $ prefix, the FX pair the shekel sign
    // of its quote leg, and the ILS-quoted index stays bare (points, and the
    // row names that unit in its tooltip instead).
    await expect(page.getByTestId('market-row-sp500')).toHaveText(/SPY\s*\$765\.96\s*0\.00%/)
    await expect(page.getByTestId('market-row-nasdaq')).toHaveText(/QQQ\s*\$521\.40\s*-0\.33%\s*⭣/)
    await expect(page.getByTestId('market-row-ta35')).toHaveText(/TA-35\s*125\.32\s*-0\.78%\s*⭣/)
    await expect(page.getByTestId('market-row-gold')).toHaveText(
      /GOLD\s*\$4,408\.90\s*\+0\.91%\s*⭡/,
    )
    // Crypto keeps its $ prefix.
    await expect(page.getByTestId('market-row-bitcoin')).toHaveText(/BTC\s*\$79,551\s*\+1\.24%\s*⭡/)
    // FX uses the server-declared 4-decimals precision and its own unit.
    await expect(page.getByTestId('market-row-usdils')).toHaveText(
      /USD\/ILS\s*₪3\.0192\s*\+0\.39%\s*⭡/,
    )
  })

  test('no row discloses an ETF proxy any more, and gold names its contract', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // No "Tracks ..." suffix on the TA-35 row: the server now serves the real
    // TASE index level, so there is nothing to disclose. ILS-quoted: no $, and
    // the unit (index points, never shekels) is named in the tooltip only.
    await expect(page.getByTestId('market-row-ta35')).toHaveAttribute(
      'title',
      'TA-35: 125.32 (-0.78%) ~ Index level in points',
    )
    await expect(page.getByTestId('market-row-ta35')).toHaveText(/TA-35\s*125\.32/)
    // Gold is the metal itself now (GC=F, dollars per ounce), but it is the
    // front-month CONTRACT, so the row must say which price this is instead of
    // letting $4,408.90 read as a bullion quote.
    await expect(page.getByTestId('market-row-gold')).toHaveAttribute(
      'title',
      'GOLD: $4,408.90 (+0.91%) ~ COMEX front-month futures, above the spot price',
    )
    await expect(page.getByTestId('market-row-gold')).not.toContainText('Tracks')
  })

  test('wraps into balanced lines that never leave one ticker alone', async ({ page }) => {
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))

    // 360 is the narrowest target, 650 and 1000 sit inside the three-across
    // tier, 1200 inside it too and 1300 above it (all six on one line).
    for (const width of [360, 420, 650, 1000, 1200, 1300]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')

      const counts = (await page.evaluate(
        `(() => {
          const strip = document.querySelector('[data-testid="market-tracker"]')
          const tops = [...strip.querySelectorAll('.markets-row')]
            .map((row) => row.getBoundingClientRect().top)
            .sort((a, b) => a - b)
          // Cluster within 10px: baseline alignment leaves ~1px offsets on the
          // same visual line, real wrapped lines are ~20px apart.
          const lines = []
          for (const top of tops) {
            const last = lines[lines.length - 1]
            if (last && top - last.top < 10) last.count++
            else lines.push({ top, count: 1 })
          }
          return lines.map((line) => line.count)
        })()`,
      )) as number[]

      expect(
        counts.reduce((sum, count) => sum + count, 0),
        `six rows at ${width}px`,
      ).toBe(6)
      expect(
        counts.every((count) => count >= 2),
        `no lone ticker at ${width}px`,
      ).toBe(true)
    }
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

  test('shows skeleton bars while loading and never blocks the nav', async ({ page }) => {
    // Hold the response open: the strip must hold its layout with skeletons
    // immediately, so the height the navbar offset reads is settled before
    // any quote lands (nothing pops in and pushes the nav down).
    await page.route('**/api/market/quotes**', () => new Promise<void>(() => {}))
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toBeVisible()
    await expect(tracker).toHaveAttribute('data-state', 'loading')
    await expect(tracker).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('navbar')).toBeVisible()

    // Every ticker keeps its slot with two value bars, and no row shows a
    // hyphen placeholder or any digit it does not have yet.
    await expect(tracker.locator('.markets-skeleton')).toHaveCount(12)
    for (const id of ['sp500', 'nasdaq', 'ta35', 'gold', 'bitcoin', 'usdils']) {
      const row = page.getByTestId(`market-row-${id}`)
      await expect(row).toBeVisible()
      await expect(row).toHaveAttribute('data-skeleton', 'true')
      await expect(row.locator('.markets-price, .markets-change')).toHaveCount(0)
    }
  })

  test('drops rows after an API failure and self-heals without a retry control', async ({
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
    await expect(tracker).not.toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('navbar')).toBeVisible()
    // A row with no price is dropped, not left standing as a hyphen. The
    // strip itself stays (and keeps its height) so the navbar offset holds.
    await expect(tracker.locator('.markets-row')).toHaveCount(0)
    expect((await tracker.boundingBox())!.height).toBeGreaterThan(30)
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

  test('drops only the row whose instrument has no price', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    // One provider failed: that instrument has no price, its neighbours do.
    const partial = MIXED_QUOTES.map((quote) =>
      quote.assetId === 'ta35'
        ? { ...quote, price: null, change: null, changePercent: null }
        : quote,
    )
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(partial) }))
    await page.goto('/')

    const tracker = page.getByTestId('market-tracker')
    await expect(tracker).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('market-row-ta35')).toHaveCount(0)
    await expect(tracker.locator('.markets-row')).toHaveCount(5)
    const spy = page.getByTestId('market-row-sp500')
    await expect(spy).toHaveText(/SPY\s*\$765\.96/)
    await expect(spy).not.toHaveAttribute('data-skeleton', 'true')

    // A row with numbers carries the entry fade; the shimmer is gone.
    const rowAnimation = (await page.evaluate(
      `(() => {
        const row = document.querySelector('.markets-row-ready')
        return row ? getComputedStyle(row).animationName : null
      })()`,
    )) as string | null
    expect(rowAnimation).toBe('market-row-in')
    await expect(tracker.locator('.markets-skeleton')).toHaveCount(0)
  })

  test('holds the same rows and the same wrap from skeleton to numbers', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))

    // 360/420 (pairs, three lines), 650/1000/1200 (rows pinned to a third, two
    // lines) and 1300/1440 (all six on one line) are the widths the strip
    // changes shape at. A skeleton whose bars are the wrong width would reflow
    // the wrap, and one that does not reserve the trend arrow's line box would
    // grow when the numbers arrive - either way the whole navbar gets shoved
    // down. So the row count, the line count and the height all have to match
    // exactly.
    const measure = () =>
      page.evaluate(
        `(() => {
          const strip = document.querySelector('[data-testid="market-tracker"]')
          const tops = [...strip.querySelectorAll('.markets-row')]
            .map((row) => row.getBoundingClientRect().top)
            .sort((a, b) => a - b)
          // Same 10px clustering as the wrap test above: baseline alignment
          // leaves ~1px offsets on a line, real wrapped lines are ~20px apart.
          const lines = []
          for (const top of tops) {
            const last = lines[lines.length - 1]
            if (last && top - last.top < 10) last.count++
            else lines.push({ top, count: 1 })
          }
          return {
            rows: tops.length,
            lines: lines.map((line) => line.count),
            height: Math.round(strip.getBoundingClientRect().height),
          }
        })()`,
      ) as Promise<{ rows: number; lines: number[]; height: number }>

    for (const width of [360, 420, 650, 1000, 1200, 1300, 1440]) {
      await page.setViewportSize({ width, height: 900 })

      // Skeleton: the response is held open, so this is the settled shape.
      await page.route('**/api/market/quotes**', () => new Promise<void>(() => {}))
      await page.goto('/')
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'loading')
      // The strip's font metrics decide the line box, so wait for the swap to
      // settle before measuring - otherwise this compares two different fonts.
      await page.evaluate(`document.fonts.ready`)
      const skeleton = await measure()

      await page.unroute('**/api/market/quotes**')
      await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.reload()
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')
      await page.evaluate(`document.fonts.ready`)
      const ready = await measure()

      expect(ready.rows, `rows at ${width}px`).toBe(skeleton.rows)
      expect(ready.lines, `wrap lines at ${width}px`).toEqual(skeleton.lines)
      // The skeleton reserves the trend arrow's line box, so the numbers land
      // in the space already set aside: the strip never changes height, and
      // the navbar offset (--markets-height) never moves.
      expect(ready.height, `strip height at ${width}px`).toBe(skeleton.height)
    }
  })

  test('reduced motion keeps the skeleton bars and the rows still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // While loading: the bars render, without the shimmer.
    await page.route('**/api/market/quotes**', () => new Promise<void>(() => {}))
    await page.goto('/')
    const barAnimation = (await page.evaluate(
      `(() => {
        const bar = document.querySelector('[data-testid="market-tracker"] .markets-skeleton')
        return bar ? getComputedStyle(bar).animationName : null
      })()`,
    )) as string | null
    expect(barAnimation).toBe('none')

    // With data: rows appear in place, without the entry fade.
    await page.unroute('**/api/market/quotes**')
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.reload()
    await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')
    const rowAnimation = (await page.evaluate(
      `(() => {
        const row = document.querySelector('.markets-row-ready')
        return row ? getComputedStyle(row).animationName : null
      })()`,
    )) as string | null
    expect(rowAnimation).toBe('none')
    await expect(page.getByTestId('market-row-sp500')).toHaveText(/SPY\s*\$765\.96/)
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
    // the test asserts the client honors it (the production default is 10s,
    // shortened here so the assertion does not wait ten seconds).
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

  test('flashes green on an up tick and red on a down tick, never when the price is unchanged', async ({
    page,
  }) => {
    let call = 0
    // Baseline for the first three polls (the initial fill must stay silent),
    // then up, an unchanged reading that must NOT re-flash, then a drop.
    const priceAt = priceSchedule([
      [1, 765.96],
      [4, 770.0],
      [6, 760.5],
    ])
    await page.route('**/api/market/quotes**', (route) => {
      call += 1
      const body = {
        ...snapshotBody([
          quoteOf({ assetId: 'sp500', price: priceAt(call), changePercent: 0.5 }),
          ...MIXED_QUOTES.slice(1),
        ]),
        refreshIntervalMs: 300,
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })

    await page.goto('/')
    const spy = page.getByTestId('market-row-sp500')
    await expect(spy).toHaveText(/765\.96/)
    await recordFlashes(page)

    await expect(spy).toHaveText(/770\.00/)
    await expect(spy).toHaveText(/760\.50/)
    // 1200ms animation + margin: the cleanup timer must have fired before
    // the gone-again assertions below.
    await page.waitForTimeout(1600)

    // Two ticks for three render changes: the equal reading in between
    // (call 5) repaints the row but must not animate. Each tick paints ONE
    // pill behind the whole value pair, not two half-pills.
    const recorded = await flashes(page)
    expect(recorded).toHaveLength(2)
    expect(recorded.map((flash) => flash.tick)).toEqual(['up', 'down'])
    for (const flash of recorded) {
      expect(flash).toEqual({
        tick: flash.tick,
        className: `markets-tick markets-tick-${flash.tick}`,
        background: flash.tick === 'up' ? FLASH_GREEN : FLASH_RED,
        display: 'block',
        width: expect.any(Number),
        height: expect.any(Number),
        spansPrice: true,
        spansChange: true,
      })
      // The pill must have real geometry: a zero-size pill would be
      // invisible decoration that still passes a presence check.
      expect(flash.width).toBeGreaterThan(0)
      expect(flash.height).toBeGreaterThan(0)
    }

    // The pill is a brief overlay: it must be gone again, and the row must
    // still line up on the strip's single text line.
    await expect(page.getByTestId('market-tick-sp500')).toHaveCount(0)
    const boxes = (await page.evaluate(
      `(() => {
        const row = document.querySelector('[data-testid="market-row-sp500"]')
        const strip = document.querySelector('[data-testid="market-tracker"]')
        return {
          row: Math.round(row.getBoundingClientRect().top),
          strip: Math.round(strip.getBoundingClientRect().top),
        }
      })()`,
    )) as { row: number; strip: number }
    expect(boxes.row).toBeGreaterThan(boxes.strip)
  })

  test('a sub-precision move repaints the row but never flashes', async ({ page }) => {
    let call = 0
    // 765.964 renders "765.96", exactly like the baseline: a flash next to an
    // unchanged number would read as a bug.
    const priceAt = priceSchedule([
      [1, 765.96],
      [4, 765.964],
    ])
    await page.route('**/api/market/quotes**', (route) => {
      call += 1
      const body = {
        ...snapshotBody([
          quoteOf({ assetId: 'sp500', price: priceAt(call), changePercent: 0.5 }),
          ...MIXED_QUOTES.slice(1),
        ]),
        refreshIntervalMs: 300,
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })

    await page.goto('/')
    const spy = page.getByTestId('market-row-sp500')
    await expect(spy).toHaveText(/765\.96/)
    await recordFlashes(page)

    await expect.poll(() => call).toBeGreaterThan(6)
    await page.waitForTimeout(1000)

    await expect(spy).toHaveText(/765\.96/)
    expect(await flashes(page)).toEqual([])
  })

  test('reduced motion renders the flash out of sight', async ({ page }) => {
    // The static green/red already carries the direction; the fade is
    // decoration, so the accessibility preference turns it off.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let call = 0
    const priceAt = priceSchedule([
      [1, 765.96],
      [4, 770.0],
    ])
    await page.route('**/api/market/quotes**', (route) => {
      call += 1
      const body = {
        ...snapshotBody([
          quoteOf({ assetId: 'sp500', price: priceAt(call), changePercent: 0.5 }),
          ...MIXED_QUOTES.slice(1),
        ]),
        refreshIntervalMs: 300,
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })

    await page.goto('/')
    const spy = page.getByTestId('market-row-sp500')
    await expect(spy).toHaveText(/765\.96/)
    await recordFlashes(page)

    await expect(spy).toHaveText(/770\.00/)
    await expect
      .poll(async () => (await flashes(page)).length, { timeout: 5000 })
      .toBeGreaterThan(0)

    const [first] = await flashes(page)
    expect(first.tick).toBe('up')
    expect(first.display).toBe('none')
    expect(first.width).toBe(0)
    expect(first.height).toBe(0)
    // display:none reports empty boxes, so the spanning checks fail open
    // here; the motion-allowed test above is what pins the geometry.
    expect(first.spansPrice).toBe(false)
    expect(first.spansChange).toBe(false)
  })

  test('renders the BTC label in both locales (user-requested)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'hebrew'))
    await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // BTC label is the user-requested name in every locale; the direction
    // and the other rows still follow the Hebrew locale.
    await expect(page.getByTestId('market-row-bitcoin')).toContainText('BTC')
  })

  for (const language of ['hebrew', 'english'] as const) {
    test(`FX shows the shekel sign and the index names its points instead (${language})`, async ({
      page,
    }) => {
      // Two rows carry no dollar sign. The FX pair states its quote leg with
      // the shekel sign, which must sit LEFT of the digits in both directions
      // (currency symbols are bidi-neutral terminators, so they stay glued to
      // the number rather than drifting to the other end of the row), and the
      // index level stays bare while its tooltip spells out index points. A
      // visible "pts" suffix was rejected: the strip has no room for it at
      // 360px, where six rows already wrap onto two lines.
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await mockQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')

      const usdils = page.getByTestId('market-row-usdils')
      await expect(usdils).toContainText('₪3.0192')

      // Same evaluate-string pattern as the sign tests below (the e2e
      // tsconfig has no DOM lib; the page context provides document).
      const measured = (await page.evaluate(
        `(() => {
          const price = document.querySelector('[data-testid="market-row-usdils"] .markets-price')
          const node = price && price.firstChild
          if (!node) return null
          const text = node.textContent || ''
          const signIndex = text.indexOf('₪')
          const digitIndex = text.search(/[0-9]/)
          if (signIndex < 0 || digitIndex < 0) return null
          const leftAt = (i) => {
            const r = document.createRange()
            r.setStart(node, i)
            r.setEnd(node, i + 1)
            return r.getBoundingClientRect().left
          }
          return { signX: leftAt(signIndex), digitX: leftAt(digitIndex) }
        })()`,
      )) as { signX: number; digitX: number } | null

      expect(measured, 'FX price rendered').not.toBeNull()
      expect(measured!.signX).toBeLessThan(measured!.digitX)

      const ta35 = page.getByTestId('market-row-ta35')
      await expect(ta35).toHaveText(/TA-35\s*125\.32\s*-0\.78%\s*⭣/)
      await expect(ta35).not.toContainText('₪')
      const pointsNote = language === 'hebrew' ? 'רמת המדד בנקודות' : 'Index level in points'
      await expect(ta35).toHaveAttribute('title', new RegExp(`${pointsNote}$`))
    })
  }

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
