import { test } from '../../fixtures'
import { HeroScrollCuePage } from '../../pages/HeroScrollCuePage'
import { installExternalMocks } from '../../support/mocks'
import { serveQuotes } from '../../support/marketMocks'
import { MIXED_QUOTES } from '../../data/marketQuotes'
import type { Page } from '@playwright/test'

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

/** CPI values chosen so the Indexes bar renders its three feeds. */
const HERO_CPI = {
  currentValue: '101.2',
  previousValue: '100.0',
  currentPercent: '1.2',
  currentPercentYear: '3.1',
  previousPercentYear: '2.9',
} as const

async function installMocks(page: Page): Promise<void> {
  await installExternalMocks(page, { boiKeyRate: 4.5, cpi: HERO_CPI })
  // Fixed market quotes: the Markets strip renders one full-width line of
  // six assets (shared fixture with the marketTracker suite).
  await serveQuotes(page, MIXED_QUOTES)
}

test.describe('hero scroll cue', () => {
  test('home: the cue is centered under the hero text and scrolls past the hero', async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 700, 'centered-overlap geometry is pinned on desktop widths')
    await installMocks(page)
    const cue = new HeroScrollCuePage(page)
    await cue.goto('/')
    await cue.expectCenteredNearHeroBottom()
    await cue.clickAndExpectContentLanded()
  })

  test('articles: the cue is present on inner-page banners and scrolls to the list', async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 700, 'centered-overlap geometry is gated to desktop widths')
    await installMocks(page)
    const cue = new HeroScrollCuePage(page)
    await cue.goto('/articles')
    await cue.expectCenteredNearHeroBottom()
    await cue.clickAndExpectContentLanded()
  })

  test('calculator: ArrowDown scrolls past the hero like the cue', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 700, 'hero-fill gating is asserted on desktop widths')
    await installMocks(page)
    const cue = new HeroScrollCuePage(page)
    await cue.goto('/calculators')
    await cue.pressArrowDownAndExpectContentLanded()
  })
})
