import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Content-top probe: the hero's next sibling (the first content section),
 * measured in VIEWPORT coordinates - the distance from the viewport's top
 * edge to the section's top edge. This is what a user sees: it shrinks as
 * the page scrolls down, and lands at the fixed chrome's height when the
 * scroll finishes. String form - the e2e tsconfig has no DOM lib, and
 * evaluate callbacks must not reference DOM globals (the marketTracker
 * suite follows the same rule).
 */
const CONTENT_TOP_EXPR = `(() => {
  const hero = document.querySelector('.header, .sub-header')
  return hero && hero.nextElementSibling
    ? hero.nextElementSibling.getBoundingClientRect().top
    : null
})()`

/** Combined height of the fixed chrome: navbar + Indexes + Markets strips. */
const CHROME_HEIGHT_EXPR = `(() => {
  const h = (sel) => document.querySelector(sel)?.offsetHeight ?? 0
  return h('nav#navbar') + h('.indexes') + h('.markets')
})()`

/**
 * Page Object for the hero scroll-down cue: the round chevron button pinned
 * near the bottom edge of every hero banner (.header on the home page,
 * .sub-header on inner pages). Owns the cue's locator and the smooth-scroll
 * interaction so a markup change means fixing one file, not every test.
 */
export class HeroScrollCuePage {
  readonly page: Page
  readonly cue: Locator

  constructor(page: Page) {
    this.page = page
    this.cue = page.getByTestId('hero-scroll-cue')
  }

  private async chromeHeight(): Promise<number> {
    return (await this.page.evaluate(CHROME_HEIGHT_EXPR)) as number
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path)
    await expect(this.cue).toBeVisible()
    // The Indexes/Markets strips grow when their mocked data arrives, which
    // changes the chrome height the scroll stop point is computed from.
    // Wait until it stops changing so cue clicks AND keyboard scrolls land
    // deterministically, no matter how fast the interaction follows goto.
    await this.expectChromeHeightSettled()
  }

  /** Polls until the chrome height reads the same on consecutive samples. */
  private async expectChromeHeightSettled(): Promise<void> {
    let previous: number | null = null
    await expect
      .poll(
        async () => {
          const height = await this.chromeHeight()
          const settled = previous !== null && height === previous
          previous = height
          return settled
        },
        { timeout: 5_000 },
      )
      .toBe(true)
  }

  /** The cue sits centered on the hero's inline axis, near its bottom edge. */
  async expectCenteredNearHeroBottom(): Promise<void> {
    const heroBox = await this.page.locator('.header, .sub-header').boundingBox()
    const cueBox = await this.cue.boundingBox()
    expect(heroBox, 'hero banner box').not.toBeNull()
    expect(cueBox, 'scroll cue box').not.toBeNull()
    if (!heroBox || !cueBox) return

    const heroCenter = heroBox.x + heroBox.width / 2
    const cueCenter = cueBox.x + cueBox.width / 2
    expect(Math.abs(cueCenter - heroCenter), 'cue is horizontally centered').toBeLessThanOrEqual(2)

    const gap = cueBox.y + cueBox.height - (heroBox.y + heroBox.height)
    expect(gap, 'cue hangs inside the hero bottom edge').toBeLessThanOrEqual(0)
    expect(gap, 'cue is near (not far above) the hero bottom edge').toBeGreaterThanOrEqual(-80)
  }

  /**
   * Asserts the smooth scroll settles with the hero's next sibling (the
   * first content section) starting at the fixed chrome's bottom edge -
   * i.e. the page landed on the content, with the hero fully scrolled past
   * and nothing hiding under the fixed strips.
   */
  private async expectContentLanded(): Promise<void> {
    const chrome = await this.chromeHeight()

    // The scroll animates; poll until the target's top stops moving, then
    // measure where it actually landed.
    let previousTop: number | null = null
    await expect
      .poll(
        async () => {
          const top = (await this.page.evaluate(CONTENT_TOP_EXPR)) as number | null
          const settled = previousTop !== null && top !== null && Math.abs(top - previousTop) < 0.5
          previousTop = top
          return settled
        },
        { timeout: 5_000 },
      )
      .toBe(true)

    const contentTop = (await this.page.evaluate(CONTENT_TOP_EXPR)) as number
    expect(
      Math.abs(contentTop - chrome),
      'content section starts at the fixed chrome bottom edge after the scroll',
    ).toBeLessThanOrEqual(3)
  }

  /**
   * Clicks the cue and asserts the scroll lands the first content section
   * at the fixed chrome's bottom edge.
   */
  async clickAndExpectContentLanded(): Promise<void> {
    await this.cue.click()
    await this.expectContentLanded()
  }

  /**
   * Presses ArrowDown on the page (focus on the body, as on a fresh visit)
   * and asserts the same landing as a cue click: the keyboard scrolls past
   * the hero with the same stop point.
   */
  async pressArrowDownAndExpectContentLanded(): Promise<void> {
    await this.page.keyboard.press('ArrowDown')
    await this.expectContentLanded()
  }
}
