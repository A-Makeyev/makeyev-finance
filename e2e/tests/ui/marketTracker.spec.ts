import { test, expect, type Page } from '@playwright/test'
import { MARQUEE_COPIES } from '../../../src/lib/marquee'
import { MIXED_QUOTES, quoteOf, snapshotBody } from '../../data/marketQuotes'
import { mockMarketQuotes } from '../../support/marketMocks'
import { installExternalMocks } from '../../support/mocks'

/**
 * UI contract tests for the Markets strip (MarketTracker). All market API
 * traffic is intercepted, so no test ever touches the real upstream APIs.
 *
 * The strip sits below the CBS Indexes bar; CBS/BOI are left unmocked here
 * (they fail silently offline, exactly like production CI).
 */

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

/**
 * The two movement tints, mirrored from the .markets-tick-* rules in
 * globals.css: an UP tick is GREEN and a DOWN tick is RED, the international
 * ticker convention (user-requested) - deliberately unlike the CBS Indexes
 * strip, whose own ticks keep the Israeli reading (up red, down green).
 */
const FLASH_UP = 'rgba(35, 210, 65, 0.14)'
const FLASH_DOWN = 'rgba(210, 60, 60, 0.14)'

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
 * Jumps both marquee tracks to just before their own loop point (the END of
 * each track's cycle - the strips run at different speeds, see globals.css -
 * where the animation wraps from the -50% keyframe back to 0 and the duplicate
 * groups take over) and asserts two things:
 *
 * 1. Both track boxes still cover the viewport horizontally. This is the
 *    no-blank-gap contract: with too few loop copies, a group narrower than
 *    the screen let blank space eat in from the right before the loop snapped
 *    back. The loop point is the worst case, since the track has moved as far
 *    as it ever moves.
 * 2. The loop travel is a WHOLE number of groups. The loop shifts by half the
 *    track, which only lands on a group boundary if the track really is
 *    MARQUEE_COPIES groups wide - a flex-shrunk track (the Indexes anchors'
 *    min-content used to win over the 6-group content) made -50% land ~1.18
 *    groups in, so the strip slid then snapped back mid-group every cycle.
 */
async function expectLoopToCoverViewport(page: Page, width: number): Promise<void> {
  interface TrackShape {
    left: number
    right: number
    trackWidth: number
    groups: number[]
    /** Distance between two adjacent group boxes: one content period. */
    period: number
  }

  // The markup carries the loop copies from the first paint (the CSS animation
  // starts before hydration), so wait for the hydrated track rather than
  // measuring whatever the server rendered.
  await page.waitForFunction(`(() => {
    const tracks = [...document.querySelectorAll('.indexes-track, .markets-track')]
    return tracks.length > 0 && tracks.every((track) => track.children.length === ${MARQUEE_COPIES})
  })()`)

  const tracks = (await page.evaluate(
    `(() => {
      const tracks = [...document.querySelectorAll('.indexes-track, .markets-track')]
      // Freeze each track 10ms short of the end of ITS OWN cycle: the wrap
      // point, without waiting out a full duration. Read from the animation
      // rather than hard-coded, because the Indexes track is twice as slow as
      // the Markets one. Pausing also keeps the measurement stable while the
      // strips re-render.
      for (const track of tracks) {
        const animation = track.getAnimations()[0]
        animation.pause()
        animation.currentTime = Number(animation.effect.getTiming().duration) - 10
      }
      return tracks.map((track) => {
        // getBoundingClientRect forces the paused style to apply synchronously.
        const box = track.getBoundingClientRect()
        const groups = [...track.children].map((child) => child.getBoundingClientRect())
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          trackWidth: box.width,
          groups: groups.map((group) => group.width),
          period: groups.length > 1 ? groups[1].left - groups[0].left : 0,
        }
      })
    })()`,
  )) as TrackShape[]

  expect(tracks, 'both strips have a marquee track').toHaveLength(2)
  tracks.forEach((track, index) => {
    expect(track.left, `track ${index} reaches the left edge at ${width}px`).toBeLessThanOrEqual(0)
    expect(
      track.right,
      `track ${index} reaches the right edge at ${width}px`,
    ).toBeGreaterThanOrEqual(width)
    expect(
      track.trackWidth,
      `track ${index} is not shrunk below its ${track.groups.length} groups at ${width}px`,
    ).toBeGreaterThanOrEqual(track.groups.reduce((sum, group) => sum + group, 0) - 1)
    // Identical groups are what make the half-track loop a true repeat.
    expect(
      Math.max(...track.groups) - Math.min(...track.groups),
      `track ${index} groups are all the same width at ${width}px`,
    ).toBeLessThan(1)
    expect(
      Math.abs(track.trackWidth / 2 - track.period * 3),
      `track ${index} loops on a whole group at ${width}px`,
    ).toBeLessThan(1)
  })
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    // No "Tracks ..." suffix on the TA-35 row: the server now serves the real
    // TASE index level, so there is nothing to disclose. ILS-quoted: no $, and
    // the unit (index points, never shekels) is named in the hover tooltip
    // only - it used to be a native title on the row.
    const ta35 = page.getByTestId('market-row-ta35')
    await expect(ta35).toHaveText(/TA-35\s*125\.32/)
    await ta35.hover()
    await expect(page.getByRole('tooltip')).toHaveText(
      'TA-35: 125.32 (-0.78%) ~ Index level in points',
    )
    // Gold is the metal itself now (GC=F, dollars per ounce), but it is the
    // front-month CONTRACT, so the row must say which price this is instead of
    // letting $4,408.90 read as a bullion quote. Moving straight across from
    // the TA-35 row, only one tooltip may be open at a time.
    const gold = page.getByTestId('market-row-gold')
    await expect(gold).not.toContainText('Tracks')
    await gold.hover()
    await expect(page.getByRole('tooltip')).toHaveText(
      'GOLD: $4,408.90 (+0.91%) ~ COMEX front-month futures, above the spot price',
    )
  })

  test('collapses to one sliding line below 1200px, with a hidden loop copy', async ({ page }) => {
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))

    // 360 / 420 / 650 / 1000 / 1200 are the compact marquee tier (one sliding
    // line plus an aria-hidden duplicate group for the loop); 1300 sits above
    // it, where all six rows still fit on one line but nothing is duplicated.
    for (const width of [360, 420, 650, 1000, 1200, 1300]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const tracker = page.getByTestId('market-tracker')
      await expect(tracker).toHaveAttribute('data-state', 'ready')
      await expect(tracker).toHaveAttribute('data-marquee', width <= 1200 ? 'true' : 'false')

      const shape = (await page.evaluate(
        `(() => {
          const strip = document.querySelector('[data-testid="market-tracker"]')
          // Only the primary group: the clone is the same six rows again.
          const primary = strip.querySelector('.markets-group:not([data-marquee-clone])')
          const clone = strip.querySelector('.markets-group[data-marquee-clone]')
          const tops = [...primary.querySelectorAll('.markets-row')]
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
          return {
            rows: tops.length,
            lines: lines.map((line) => line.count),
            cloneHidden: clone ? clone.getAttribute('aria-hidden') : null,
            groups: strip.querySelectorAll('.markets-group').length,
          }
        })()`,
      )) as { rows: number; lines: number[]; cloneHidden: string | null; groups: number }

      // Every row on the same visual line at every width. That is the point
      // of the compact tier: at these widths the rows used to wrap onto two
      // or three lines and the whole strip (and navbar) grew with them.
      expect(shape.rows, `six rows at ${width}px`).toBe(6)
      expect(shape.lines, `one line at ${width}px`).toEqual([6])
      // Below 1200px the loop is MARQUEE_COPIES identical groups (one visible
      // plus the repeats that keep it seamless and covering the screen at the
      // loop point, see src/lib/marquee.ts), all but the first hidden from
      // assistive tech. Above it there is a single group and no copy.
      expect(shape.groups, `loop copies at ${width}px`).toBe(width <= 1200 ? MARQUEE_COPIES : 1)
      expect(shape.cloneHidden, `loop copy hidden at ${width}px`).toBe(
        width <= 1200 ? 'true' : null,
      )
    }
  })

  test('compact strips slide on one line without shoving the navbar', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await installExternalMocks(page)
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))

    for (const width of [360, 768, 1200]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')
      await expect(page.getByTestId('indexes-bar')).toBeVisible()
      // The navbar transitions its top/margin-top (0.25s) as the strips
      // appear, so let that settle before measuring where it sits.
      await page.waitForTimeout(600)

      const geometry = (await page.evaluate(
        `(() => {
          const box = (selector) => document.querySelector(selector).getBoundingClientRect()
          const indexes = box('[data-testid="indexes-bar"]')
          const markets = box('[data-testid="market-tracker"]')
          const navbar = box('[data-testid="navbar"]')
          return {
            indexesTop: Math.round(indexes.top),
            indexesBottom: Math.round(indexes.bottom),
            marketsTop: Math.round(markets.top),
            marketsBottom: Math.round(markets.bottom),
            navbarTop: Math.round(navbar.top),
          }
        })()`,
      )) as {
        indexesTop: number
        indexesBottom: number
        marketsTop: number
        marketsBottom: number
        navbarTop: number
      }

      // One-line stack, edge to edge: Indexes at the very top, Markets
      // directly under it, navbar below both and never overlapping.
      expect(geometry.indexesTop, `indexes top at ${width}px`).toBe(0)
      expect(geometry.marketsTop, `markets top at ${width}px`).toBe(geometry.indexesBottom)
      expect(geometry.navbarTop, `navbar top at ${width}px`).toBeGreaterThanOrEqual(
        geometry.marketsBottom,
      )

      // The track actually slides, and pointer contact holds it still.
      const transform = () =>
        page.evaluate(`getComputedStyle(document.querySelector('.markets-track')).transform`)
      const before = await transform()
      await page.waitForTimeout(300)
      expect(await transform(), `track slides at ${width}px`).not.toBe(before)

      await page.getByTestId('market-tracker').hover()
      const paused = await page.evaluate(
        `getComputedStyle(document.querySelector('.markets-track')).animationPlayState`,
      )
      expect(paused, `track pauses on hover at ${width}px`).toBe('paused')
    }
  })

  test('the Indexes strip slides slower than the Markets strip', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await installExternalMocks(page)
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('indexes-bar')).toBeVisible()
    await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')

    const durations = (await page.evaluate(
      `(() => {
        const duration = (selector) =>
          getComputedStyle(document.querySelector(selector)).animationDuration
        return { indexes: duration('.indexes-track'), markets: duration('.markets-track') }
      })()`,
    )) as { indexes: string; markets: string }

    const seconds = (value: string) => Number.parseFloat(value.replace('s', ''))
    // The two strips are deliberately paced apart (user-requested): Indexes is
    // the slower reference row, twice the Markets cycle for the same half-track
    // travel, so half the speed. Both still run the same seamless keyframe.
    expect(seconds(durations.markets)).toBe(120)
    expect(seconds(durations.indexes)).toBe(240)
    expect(seconds(durations.indexes)).toBeGreaterThan(seconds(durations.markets))
    expect(
      await page.evaluate(
        `getComputedStyle(document.querySelector('.indexes-track')).animationName`,
      ),
    ).toBe('strip-marquee')
  })

  test('marquee loop point still covers the viewport with no blank gap', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await installExternalMocks(page)

    // With the old two-copy track, any group narrower than the viewport let
    // blank space eat in from the right as the loop ran, until the strip
    // visibly snapped back - it stopped and started over. The fix is enough
    // loop copies (MARQUEE_COPIES) that half the track always spans the
    // screen AND that the track keeps its full content width (no flex shrink),
    // so the wrap point is exactly three whole groups. Both strips, in both
    // content states: the skeletons are the narrowest content the strips ever
    // show.
    for (const width of [360, 900, 1200]) {
      await page.setViewportSize({ width, height: 900 })

      // Ready state: the strips carry their real (mocked) numbers.
      await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')
      await expect(page.getByTestId('indexes-bar')).toBeVisible()
      await expectLoopToCoverViewport(page, width)

      // Skeleton state: hold the quotes response open (registered after the
      // mock, so it wins) and reload.
      await page.route('**/api/market/quotes**', () => new Promise<void>(() => {}))
      await page.goto('/')
      await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'loading')
      await expectLoopToCoverViewport(page, width)

      // Drop both quotes handlers for the next width.
      await page.unroute('**/api/market/quotes**')
    }
  })

  test('compact indexes line keeps the full names and drops the yearly change', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await installExternalMocks(page)
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/')

    const bar = page.getByTestId('indexes-bar')
    await expect(bar).toHaveAttribute('data-marquee', 'true')
    // Full name + the current value + the monthly change only: the yearly
    // change is the first thing that had to go to keep one line. The names
    // are not shortened in the slider tier.
    await expect(bar).toContainText('CPI')
    await expect(bar).toContainText('Monthly change')
    await expect(bar).not.toContainText('Yearly change')
    // The full official feed name is reachable via the link's href (a Google
    // search for the Hebrew feed name). The row's hover tooltip carries what
    // the index measures plus how it reaches a mortgage, like the Markets rows.
    await bar.hover()

    // The loop copies are hidden from assistive tech and kept out of the tab
    // order, so the strip does not read or tab twice.
    const clone = bar.locator('[data-marquee-clone="true"]').first()
    await expect(clone).toHaveAttribute('aria-hidden', 'true')
    await expect(clone.locator('a').first()).toHaveAttribute('tabindex', '-1')
  })

  test('compact strips never animate under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installExternalMocks(page)
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.setViewportSize({ width: 900, height: 900 })
    await page.goto('/')
    await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')

    // The one-line layout is kept, but it is static and scrollable by hand
    // instead of sliding on its own.
    const styles = (await page.evaluate(
      `(() => {
        const track = getComputedStyle(document.querySelector('.markets-track'))
        const strip = getComputedStyle(document.querySelector('[data-testid="market-tracker"]'))
        return { animation: track.animationName, overflowX: strip.overflowX }
      })()`,
    )) as { animation: string; overflowX: string }
    expect(styles.animation).toBe('none')
    expect(styles.overflowX).toBe('auto')
  })

  test('strip text is not user-selectable', async ({ page }) => {
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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

  test('movement colors follow the international ticker convention (up green, down red, flat lightblue)', async ({
    page,
  }) => {
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')
    await expect(page.getByTestId('market-tracker')).toHaveAttribute('data-state', 'ready')

    // The tickers deliberately use the OPPOSITE mapping of the CBS Indexes
    // strip above them (user-requested): a rise is GREEN and a fall is RED
    // here - the international ticker convention - while the indexes keep
    // the Israeli reading (up red, down green) of the very same palette.
    // Asserted on the rendered colour of the whole value pair, which is
    // what a visitor sees.
    // Fixtures: bitcoin +1.24% (up), nasdaq -0.33% (down), sp500 0.00% (flat).
    const colours = (await page.evaluate(`(() => {
      const read = (id) => {
        const row = document.querySelector('[data-testid="market-row-' + id + '"]')
        return [
          getComputedStyle(row.querySelector('.markets-price')).color,
          getComputedStyle(row.querySelector('.markets-change')).color,
        ]
      }
      return { up: read('bitcoin'), down: read('nasdaq'), flat: read('sp500') }
    })()`)) as Record<'up' | 'down' | 'flat', string[]>

    const TICKER_UP_GREEN = 'rgb(35, 210, 65)'
    const TICKER_DOWN_RED = 'rgb(210, 60, 60)'
    const NEUTRAL_FLAT = 'rgb(173, 216, 230)' // computed `lightblue`
    expect(colours.up).toEqual([TICKER_UP_GREEN, TICKER_UP_GREEN])
    expect(colours.down).toEqual([TICKER_DOWN_RED, TICKER_DOWN_RED])
    expect(colours.flat).toEqual([NEUTRAL_FLAT, NEUTRAL_FLAT])
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
    await mockMarketQuotes(page, () =>
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(partial) }))
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

    // 360/420/650/1000/1200 are the compact marquee tier (one sliding line
    // with a duplicated group) and 1300/1440 sit above it. A skeleton whose
    // bars are the wrong width would reflow the strip, and one that does not
    // reserve the trend arrow's line box would grow when the numbers arrive -
    // either way the whole navbar gets shoved down. So the row count, the
    // line count and the height all have to match exactly.
    const measure = () =>
      page.evaluate(
        `(() => {
          const strip = document.querySelector('[data-testid="market-tracker"]')
          // Primary group only: the compact tier repeats the rows once for
          // the seamless marquee loop (see the test above).
          const primary = strip.querySelector('.markets-group:not([data-marquee-clone])')
          const tops = [...primary.querySelectorAll('.markets-row')]
            .map((row) => row.getBoundingClientRect().top)
            .sort((a, b) => a - b)
          // Same 10px clustering as the marquee test above: baseline alignment
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
      await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
    await mockMarketQuotes(page, () => ({
      status: 200,
      body: { ...snapshotBody(staleQuotes), stale: true },
    }))
    await page.goto('/')

    const bitcoinRow = page.getByTestId('market-row-bitcoin')
    await expect(bitcoinRow).toHaveClass(/markets-row-stale/)
    // The stale note rides in the hover tooltip now (native title removed).
    await bitcoinRow.hover()
    await expect(page.getByRole('tooltip')).toContainText('Cached data')
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
        background: flash.tick === 'up' ? FLASH_UP : FLASH_DOWN,
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
      await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
      // The points note rides in the hover tooltip now (native title removed).
      await ta35.hover()
      await expect(page.getByRole('tooltip')).toContainText(pointsNote)
    })
  }

  test('Indexes bar holds its slot with skeleton bars while the feeds load', async ({ page }) => {
    // The standard CBS mocks are installed first, then overridden with a
    // DELAYED call that ultimately fails: that exercises both halves of the
    // contract - skeleton bars while in flight, legacy silent degradation
    // (bar gone) once every feed has failed.
    await installExternalMocks(page)
    await page.route(/api\.cbs\.gov\.il/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.abort()
    })
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const bar = page.getByTestId('indexes-bar')
    await expect(bar).toBeVisible()
    await expect(bar).toHaveAttribute('data-state', 'loading')
    await expect(bar).toHaveAttribute('aria-busy', 'true')
    // One entry per feed, each holding the name + value slots.
    await expect(bar.locator('.indexes-skeleton')).toHaveCount(3)

    // The name is the real localized label (it must not blink in and out per
    // feed); only the value slot shimmers, and it is the same shimmer the
    // Markets strip uses while it loads.
    const shimmer = (await page.evaluate(`(() => {
      const entry = document.querySelector('[data-testid="indexes-skeleton-cpi"]')
      const name = entry.querySelector('.indexes-skeleton-name')
      const value = entry.querySelector('.indexes-skeleton-value')
      return {
        nameText: name.textContent,
        nameAnimation: getComputedStyle(name).animationName,
        valueAnimation: getComputedStyle(value).animationName,
        nameWidth: name.getBoundingClientRect().width,
        valueWidth: value.getBoundingClientRect().width,
      }
    })()`)) as {
      nameText: string
      nameAnimation: string
      valueAnimation: string
      nameWidth: number
      valueWidth: number
    }
    expect(shimmer.nameText).toBe('CPI')
    expect(shimmer.nameAnimation).toBe('none')
    expect(shimmer.valueAnimation).toBe('market-skeleton-shimmer')
    expect(shimmer.nameWidth).toBeGreaterThan(0)
    expect(shimmer.valueWidth).toBeGreaterThan(0)

    // The stack is settled while loading: Markets sits directly under the bar,
    // so the numbers landing (or the feeds failing) never moves the navbar.
    const geometry = (await page.evaluate(`(() => {
      const box = (selector) => document.querySelector(selector).getBoundingClientRect()
      return {
        barBottom: Math.round(box('[data-testid="indexes-bar"]').bottom),
        marketsTop: Math.round(box('[data-testid="market-tracker"]').top),
      }
    })()`)) as { barBottom: number; marketsTop: number }
    expect(geometry.marketsTop).toBe(geometry.barBottom)

    // Every feed failed: the bar disappears and Markets takes the top slot.
    await expect(bar).toBeHidden()
    await expect(page.getByTestId('market-tracker')).toHaveClass(/markets-no-indexes/)
  })

  test('strip stays visible above the navbar when the Indexes bar is absent', async ({ page }) => {
    // The Indexes bar must stay hidden (CBS feeds fail), so the Markets
    // strip moves to the top slot, not float mid-air under it. The failure
    // is enforced with aborted CBS routes rather than assumed: this suite
    // installs no data mocks, but letting the real api.cbs.gov.il answer
    // (it does, sometimes, from a connected machine) would flip the bar
    // visible and break the premise nondeterministically.
    await page.route(/api\.cbs\.gov\.il/, (route) => route.abort())
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
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
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const bar = page.getByTestId('indexes-bar')
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('CPI')
    await expect(bar).toContainText('Monthly change')
    await expect(bar).toContainText('Yearly change')
    // Each row's hover tooltip carries what the index measures and how it
    // reaches a mortgage (a visually-hidden copy lives inside the anchor); the full
    // official feed name stays in the link's href. Read the strip's VISIBLE
    // text with the visually-hidden tooltip copy stripped, to check the labels
    // that actually paint.
    const visibleText = (await page.evaluate(`(() => {
      const clone = document.querySelector('[data-testid="indexes-bar"]').cloneNode(true)
      clone.querySelectorAll('.visually-hidden').forEach((el) => el.remove())
      return clone.textContent
    })()`)) as string
    expect(visibleText).not.toContain('מדד המחירים לצרכן')
    expect(visibleText).not.toContain('שינוי חודשי')
    expect(visibleText).not.toContain('שינוי שנתי')
    // Hovering a row opens the styled panel (not a native title) with the
    // description plus how it reaches a mortgage. The copy is also inside the
    // anchor as visually-hidden text, so asserting on the live `tooltip` role
    // proves the PANEL itself opened.
    await bar.locator('a').first().hover()
    await expect(page.getByRole('tooltip')).toContainText('consumer price index')
    await expect(page.getByRole('tooltip')).toContainText('link mortgage tracks to inflation')
    // Default CPI fixture: monthly 0.4 (rising), yearly 3.5 - both trends
    // up, so both are red and carry '+'. The sign leads the percent and
    // the arrow trails it in English reading order.
    await expect(bar).toContainText('+0.4% ⭡')
    await expect(bar).toContainText('+3.5% ⭡')
  })

  test('indexes row tooltip renders the resolved Hebrew copy, not raw keys', async ({ page }) => {
    // Hebrew is the default (unprefixed URLs). The panel must show the Hebrew
    // description and mortgage effect; a raw `indexesBar.` string means the
    // loaded translations do not carry the key (a stale i18n resource).
    await installExternalMocks(page)
    await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
    await page.goto('/')

    const bar = page.getByTestId('indexes-bar')
    await expect(bar).toBeVisible()
    await bar.locator('a').first().hover()
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toContainText('מדד המחירים לצרכן')
    await expect(tooltip).toContainText('מוצמדים')
    await expect(tooltip).not.toContainText('indexesBar.')
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
      await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')

      const bar = page.getByTestId('indexes-bar')
      // The bar now holds its slot with skeleton bars while the feeds load, so
      // "visible" is no longer the same as "loaded": wait for the numbers.
      await expect(bar).toHaveAttribute('data-state', 'ready')

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
      await mockMarketQuotes(page, () => ({ status: 200, body: snapshotBody(MIXED_QUOTES) }))
      await page.goto('/')

      const bar = page.getByTestId('indexes-bar')
      // Skeleton bars hold the slot until the feeds land (see the strip's
      // loading test): wait for the loaded state, not just for visibility.
      await expect(bar).toHaveAttribute('data-state', 'ready')

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
