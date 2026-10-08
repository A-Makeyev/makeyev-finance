import { test, expect } from '../../fixtures'
import type { Page } from '@playwright/test'
import { mockGetSessionNull } from '../../support/authMocks'

/**
 * UI contract for the site theme: follows the OS on a first visit, remembers
 * an explicit choice in localStorage, and flips the whole surface - not just
 * the navbar.
 *
 * The standalone crescent/sun glyph was removed from the navbar; the only
 * toggle is now the color-mode row inside the account menu, so every
 * flip in here opens that menu first.
 *
 * `data-theme` on <html> is the single source of truth the CSS hangs off, so
 * these tests read it instead of sniffing Tailwind classes.
 */

const STORAGE_KEY = 'site_theme'

const themeAttr = (page: Page) =>
  page.evaluate(`document.documentElement.getAttribute('data-theme')`) as Promise<string | null>

const panelBackground = (page: Page) =>
  page.evaluate(
    `getComputedStyle(document.querySelector('.calculator-panel')).backgroundColor`,
  ) as Promise<string>

/** "rgb(r, g, b)" -> the three channels, so a test can assert "dark" without
    pinning the exact palette value. */
function channelsOf(rgb: string): number[] {
  return rgb
    .replace(/[^0-9,]/g, '')
    .split(',')
    .slice(0, 3)
    .map(Number)
}

/**
 * Flips the theme through the account menu (the navbar glyph is gone). Hover
 * opens the menu; the row itself is a button, so the same helper works on
 * mobile too once the panel is open. The menu stays open after the click.
 */
async function toggleTheme(page: Page): Promise<void> {
  await page.getByTestId('nav-avatar').hover()
  const row = page.getByTestId('nav-account-theme')
  await expect(row).toBeVisible()
  await row.click()
  // The bar, the links and the logos all transition over 0.5s, so the paint
  // settles AFTER data-theme flips on <html>. Give the transition the same
  // runway the spec already budgets for the fade (500ms bar transition + 200ms
  // per readSettled attempt x 20 attempts = 4s, plenty to clear a 500ms fade).
  await page.waitForTimeout(800)
      // The bar, the links and the logos all transition over 0.5s, so the paint
      // settles AFTER data-theme flips on <html>. Give the transition the same
      // runway the spec already budgets for the fade (500ms bar transition + 200ms
      // per readSettled attempt x 20 attempts = 4s, plenty to clear a 500ms fade).
      await page.waitForTimeout(800)
  // The bar, the links and the logos all transition over 0.5s, so the paint
  // settles AFTER data-theme flips on <html>. Give the transition the same
  // runway the spec already budgets for the fade (500ms bar transition + 200ms
  // per readSettled attempt x 20 attempts = 4s, plenty to clear a 500ms fade).
  await page.waitForTimeout(800)
}

test.describe('theme toggle', () => {
  /**
   * Signed out, deterministically. The account trigger only renders once the
   * session lookup lands (the bar holds a muted skeleton until then), so an
   * un-mocked run makes every test that opens the theme menu wait on a real
   * /api/auth/get-session round trip - and how long the auth endpoint takes is
   * not what this suite is testing. The shared mock answers instantly with the
   * same signed-out session the un-mocked run gets, because the test context
   * carries no session cookie.
   */
  test.beforeEach(async ({ page }) => {
    await mockGetSessionNull(page)
  })

  test('first visit follows the OS (light here), and the toggle persists', async ({ page }) => {
    await page.goto('/')

    // No saved choice + a light OS => light, and nothing written yet.
    expect(await themeAttr(page)).toBe('light')
    expect(await page.evaluate(`localStorage.getItem('${STORAGE_KEY}')`)).toBeNull()

    // The label names the ACTION, so a light page offers "dark mode".
    await page.getByTestId('nav-avatar').hover()
    const row = page.getByTestId('nav-account-theme')
    await expect(row).toBeVisible()
    await expect(row).toHaveText('מצב כהה')

    await row.click()
    // The bar, the links and the logos all transition over 0.5s, so the paint
    // settles AFTER data-theme flips on <html>. Give the transition the same
    // runway the spec already budgets for the fade (500ms bar transition + 200ms
    // per readSettled attempt x 20 attempts = 4s, plenty to clear a 500ms fade).
    await page.waitForTimeout(800)
    expect(await themeAttr(page)).toBe('dark')
    // The explicit choice is persisted (never 'system').
    expect(await page.evaluate(`localStorage.getItem('${STORAGE_KEY}')`)).toBe('dark')
    // The menu stays open, which is the point of the row.
    await expect(row).toBeVisible()
    await expect(row).toHaveText('מצב בהיר')

    // The page itself repaints, not just the attribute.
    const bodyBg = (await page.evaluate(
      `getComputedStyle(document.body).backgroundColor`,
    )) as string
    for (const channel of channelsOf(bodyBg)) expect(channel).toBeLessThan(60)

    // Survives a reload (and the pre-paint script applies it before the bundle).
    await page.reload()
    expect(await themeAttr(page)).toBe('dark')

    // Toggling back to light is remembered too.
    await toggleTheme(page)
    // The bar, the links and the logos all transition over 0.5s, so the paint
    // settles AFTER data-theme flips on <html>. Give the transition the same
    // runway the spec already budgets for the fade (500ms bar transition + 200ms
    // per readSettled attempt x 20 attempts = 4s, plenty to clear a 500ms fade).
    await page.waitForTimeout(800)
    expect(await themeAttr(page)).toBe('light')
    await page.reload()
    expect(await themeAttr(page)).toBe('light')
  })

  test('applies to the calculator surfaces, not only the chrome', async ({ page }) => {
    await page.goto('/calculators')
    await toggleTheme(page)
    expect(await themeAttr(page)).toBe('dark')

    await expect(page.locator('.calculator-panel')).toBeVisible()
    const panel = await panelBackground(page)
    for (const channel of channelsOf(panel)) expect(channel).toBeLessThan(80)
  })

  test('fields dim down in dark mode, with light text inside', async ({ page }) => {
    await page.goto('/calculators')
    await toggleTheme(page)

    // The calculator's own field frame.
    const fieldBg = (await page.evaluate(
      `getComputedStyle(document.querySelector('.input-wrap')).backgroundColor`,
    )) as string
    for (const channel of channelsOf(fieldBg)) expect(channel).toBeLessThan(80)

    const fieldInk = (await page.evaluate(
      `getComputedStyle(document.querySelector('.input-wrap input')).color`,
    )) as string
    for (const channel of channelsOf(fieldInk)) expect(channel).toBeGreaterThan(150)

    // ...and the React contact form's floating-label field, which is a
    // separate component with its own (Tailwind) styling.
    await page.goto('/contact')
    await expect(page.locator('.field-island input').first()).toBeVisible()
    // Read via page.evaluate with a string IIFE (the pattern used above): a
    // function STRING passed to locator.evaluate is not invoked with the
    // element and comes back undefined.
    const contactField = (await page.evaluate(`(() => {
      const cs = getComputedStyle(document.querySelector('.field-island input'));
      return { bg: cs.backgroundColor, ink: cs.color };
    })()`)) as { bg: string; ink: string }
    for (const channel of channelsOf(contactField.bg)) expect(channel).toBeLessThan(80)
    for (const channel of channelsOf(contactField.ink)) expect(channel).toBeGreaterThan(150)
  })

  test('the bar is transparent at the top and a slab once scrolled, on every page', async ({
    page,
  }) => {
    /**
     * The legacy two-state bar (user-requested): TRANSPARENT while it sits over
     * the hero - the transparency is the point, the banner reads through it -
     * and a markedly denser slab once the page scrolls under it, which is the
     * change the visitor sees on scroll.
     *
     * Three claims are asserted:
     *   - ACROSS PAGES the bar must be identical (top AND scrolled), which is
     *     the per-page regression this test was written for. The profile page
     *     is the one deliberate exception: its top is the plain page surface,
     *     so it starts in the scrolled treatment instead of the glass.
     *   - ACROSS SCROLL it must NOT be identical: the top tint has to be
     *     measurably more transparent than the scrolled one, in both themes.
     *   - ACROSS THEMES the TOP is the SAME slab (one shared dark legacy tint,
     *     as on the legacy site), so the light items and the transparent logo
     *     are the right pairing there in either mode; only the SCROLLED slab is
     *     per-theme, and its items follow it (ink on light's pale slab, light
     *     on dark's ink slab).
     *
     * The glass layers are read separately (tint, sheen gradient, edge shadow)
     * because that is what makes the bar GLASS rather than a tinted panel: a
     * translucent fill, a blur, a top-edge highlight and an edge line.
     */
    const read = () =>
      page.evaluate(`(() => {
        const nav = document.getElementById('navbar')
        const cs = getComputedStyle(nav)
        const link = getComputedStyle(document.querySelector('#nav-list a'))
        // The logo is swapped by CSS on data-theme, never by JS, so read the
        // VISIBLE one: both variants are always in the DOM.
        const logos = [...document.querySelectorAll('[data-testid^="logo-"]')]
          .filter((el) => getComputedStyle(el).display !== 'none')
          .map((el) => el.getAttribute('src'))
          .join(',')
        return [cs.backdropFilter, cs.backgroundColor, link.color, logos, cs.backgroundImage, cs.boxShadow].join('|')
      })()`) as Promise<string>

    /** The blur radius in px, so "a real blur" can be asserted without pinning
        the exact radius a future design tweak may move. */
    const blurRadius = (filter: string): number => Number(filter.match(/blur\((\d+)px\)/)?.[1] ?? 0)

    /** The tint's alpha, so "more transparent" is a number, not a vibe. */
    const alphaOf = (colour: string): number =>
      Number(colour.match(/[\d.]+\)$/)?.[0]?.replace(')', ''))

    /**
     * nav#navbar transitions background-color over 0.5s, so a read taken right
     * after a scroll or a theme flip catches the tint MID-FADE (an alpha of
     * 0.537 instead of 0.6, say), and a strict equality check on the tint then
     * fails for a reason that has nothing to do with the bar. Two consecutive
     * identical reads mean the fade is over.
     */
    const readSettled = async (): Promise<string> => {
      let previous = await read()
      for (let attempt = 0; attempt < 20; attempt++) {
        await page.waitForTimeout(200)
        const current = await read()
        if (current === previous) return current
        previous = current
      }
      return previous
    }

    /**
     * Scrolls into the scrolled state and waits for the class that paints it.
     *
     * Returns false when the page has nothing to scroll under the bar at all:
     * the sign-in card is exactly one viewport tall whenever the deployment
     * enables no social provider (its "nothing to scroll past" is deliberate -
     * see shouldHideFooter in src/lib/siteChrome.ts). The bar is then
     * correctly still in its TOP treatment, so the caller records no scrolled
     * read for that route rather than waiting out a class that never comes.
     */
    const scrollIntoScrolledState = async (): Promise<boolean> => {
      // Whether a page can scroll under the bar at all is a LAYOUT fact, read
      // from scrollHeight vs the viewport - not from scrollY, which still
      // reads 0 right after scrollTo because the site sets smooth
      // scroll-behavior and animates instead of jumping.
      const scrollable = (await page.evaluate(
        `document.documentElement.scrollHeight - window.innerHeight > 1`,
      )) as boolean
      if (!scrollable) return false
      await expect
        .poll(async () => {
          await page.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
          return page.evaluate(
            `document.getElementById('navbar').classList.contains('navbar-scrolling')`,
          )
        })
        .toBe(true)
      return true
    }

    /** Reads the bar on every page in both scroll states, once per theme. */
    const readEveryPage = async (): Promise<{
      top: Record<string, string>
      scrolled: Record<string, string>
    }> => {
      const top: Record<string, string> = {}
      const scrolled: Record<string, string> = {}
      for (const route of pages) {
        await page.goto(route)
        await expect
          .poll(async () => page.evaluate(`document.documentElement.dataset.hydrated`))
          .toBe('true')
        top[route] = await readSettled()
        if (await scrollIntoScrolledState()) {
          scrolled[route] = await readSettled()
        } else {
          // Nothing to scroll under it: the bar stays in its top treatment.
          expect(await readSettled(), `no scroll on ${route}`).toBe(top[route])
        }
      }
      return { top, scrolled }
    }

    // Hero pages and the sign-in screen carry the identical bar. The profile
    // page is deliberately NOT in this list: it is the one page whose top is
    // the plain page surface, so it starts in the SCROLLED treatment instead of
    // the transparent glass (see navStartsSolid in src/lib/siteChrome.ts) - and
    // signed out this harness cannot reach it anyway, because the server-side
    // session check sends /profile to /login. The route below is what that
    // redirect actually renders, and it is a real third surface to compare.
    //
    // /login is a TOP-only surface: its single card is exactly one viewport
    // tall when this deployment enables no social provider, so there is
    // nothing to scroll under the bar and its scrolled read is skipped (see
    // scrollIntoScrolledState).
    const pages = ['/', '/calculators', '/articles', '/login']
    // The tints, pinned here so a stray re-declaration (or a scroll state
    // swapping its value) fails the run rather than sliding through. The TOP
    // one is shared by both themes - the legacy transparent glass.
    const TOP_TINT = 'rgba(15, 15, 15, 0.1)'
    const LIGHT_SCROLLED_TINT = 'rgba(240, 248, 255, 0.6)'
    const DARK_SCROLLED_TINT = 'rgba(9, 13, 15, 0.75)'
    await page.goto('/')
    // Poll until hydrated: the pre-hydration paint is the server HTML, whose
    // link/logo colours are the old hardcoded ones.
    await expect
      .poll(async () => page.evaluate(`document.documentElement.dataset.hydrated`))
      .toBe('true')

    const light = await readEveryPage()
    // Identical on every page, at BOTH scroll states: the per-page change the
    // user removed must not come back through either door. A route with no
    // scrolled read has nothing to scroll under the bar (see
    // scrollIntoScrolledState), so it only contributes the top comparison.
    for (const route of pages) {
      expect(light.top[route], `light top on ${route}`).toBe(light.top['/'])
      if (route in light.scrolled) {
        expect(light.scrolled[route], `light scrolled on ${route}`).toBe(light.scrolled['/'])
      }
    }

    // Light: the TOP is the legacy transparent glass - a thin ink tint (a
    // whisper on the light, hero-less profile page) with a real blur and the
    // light items on it - and scrolled it becomes the light theme's pale slab
    // with ink items.
    const [lightBackdrop, lightTopBg, lightLink, lightLogo, lightSheen, lightEdge] =
      light.top['/'].split('|')
    const [, lightScrolledBg, , lightScrolledLogo] = light.scrolled['/'].split('|')
    expect(lightBackdrop).toContain('blur')
    // The legacy recipe blurs 10px and adds saturation; a 2-3px smudge over a
    // translucent fill would just look like a washed-out panel.
    expect(blurRadius(lightBackdrop)).toBeGreaterThanOrEqual(8)
    expect(lightBackdrop).toContain('saturate')
    expect(lightTopBg).toBe(TOP_TINT)
    expect(lightScrolledBg).toBe(LIGHT_SCROLLED_TINT)
    const topAlpha = alphaOf(lightTopBg)
    const lightScrolledAlpha = alphaOf(lightScrolledBg)
    // "Transparent at the top, a slab once scrolled": the top tint is much the
    // thinner of the two, which is the change the visitor sees on scroll.
    expect(topAlpha).toBeLessThan(0.4)
    expect(topAlpha).toBeLessThan(lightScrolledAlpha)
    expect(lightScrolledAlpha).toBeGreaterThan(0.5)
    expect(lightScrolledAlpha).toBeLessThan(1)
    // The top slab is the shared dark one; the scrolled light slab is pale.
    for (const channel of channelsOf(lightTopBg)) expect(channel).toBeLessThan(80)
    for (const channel of channelsOf(lightScrolledBg)) expect(channel).toBeGreaterThan(200)
    // The items follow the SLAB: light items on the dark transparent top, ink
    // items and the dark logo once the pale slab is in.
    expect(channelsOf(lightLink).every((channel) => channel > 150)).toBe(true)
    expect(lightLogo).toBe('/images/Logo-T.png')
    expect(lightScrolledLogo).toBe('/images/Logo.png')
    // The top-edge highlight and the slab's own edge line.
    expect(lightSheen).toContain('linear-gradient')
    expect(lightEdge).toContain('inset')

    // Dark: the SAME transparent top slab, and an ink slab once scrolled.
    await page.goto('/articles')
    await toggleTheme(page)
    // Poll until the bar has actually PAINTED, not merely until data-theme
    // flipped: nav#navbar transitions background-color over 0.5s and the links
    // transition over 0.5s, so the colours read mid-fade. The logo carries no
    // transition, which is why it flips first and made this look like a token
    // bug rather than a timing one.
    await expect.poll(async () => (await readSettled()).split('|')[1]).toBe(TOP_TINT)
    const dark = await readEveryPage()
    for (const route of pages) {
      expect(dark.top[route], `dark top on ${route}`).toBe(dark.top['/'])
      if (route in dark.scrolled) {
        expect(dark.scrolled[route], `dark scrolled on ${route}`).toBe(dark.scrolled['/'])
      }
    }

    const [darkBackdrop, darkTopBg, darkLink, darkLogo, darkSheen, darkEdge] =
      dark.top['/'].split('|')
    const [, darkScrolledBg, , darkScrolledLogo] = dark.scrolled['/'].split('|')
    expect(darkScrolledBg).toBe(DARK_SCROLLED_TINT)
    const darkScrolledAlpha = alphaOf(darkScrolledBg)
    // The TOP is LITERALLY the same slab as in light mode (one shared legacy
    // token), so the two themes cannot drift apart there; only the SCROLLED
    // tint is per-theme. These four assertions are what fail first if a theme
    // re-declares the top slab or any other layer of the chrome.
    expect(darkTopBg).toBe(lightTopBg)
    expect(darkBackdrop).toBe(lightBackdrop)
    expect(darkSheen).toBe(lightSheen)
    expect(darkEdge).toBe(lightEdge)
    expect(darkTopBg).toBe(TOP_TINT)
    expect(alphaOf(darkTopBg)).toBe(topAlpha)
    // Same light items on the shared dark top, in dark mode too, with the
    // transparent logo - and they STAY light scrolled, because the dark
    // theme's scrolled slab is ink as well.
    expect(darkLink).toBe(lightLink)
    expect(darkLogo).toBe('/images/Logo-T.png')
    expect(darkScrolledLogo).toBe(darkLogo)
    // Both scrolled slabs are denser than the shared top, in either theme: that
    // is the scroll change itself.
    expect(darkScrolledAlpha).toBeLessThan(1)
    expect(darkScrolledAlpha).toBeGreaterThan(topAlpha)
    expect(darkScrolledBg).not.toBe(darkTopBg)
    expect(lightScrolledBg).not.toBe(lightTopBg)
    // Dark needs more of its own tint than light: dark glass over a dark page
    // is legible mainly by its own tint.
    expect(darkScrolledAlpha).toBeGreaterThan(lightScrolledAlpha)
    for (const channel of channelsOf(darkScrolledBg)) expect(channel).toBeLessThan(80)
    // The tint is the ONLY scroll-dependent chrome value: the blur, the sheen
    // and the edge are identical at the top and scrolled, in either mode.
    const [lightScrolledBackdrop, , , , lightScrolledSheen, lightScrolledEdge] =
      light.scrolled['/'].split('|')
    const [darkScrolledBackdrop, , , , darkScrolledSheen, darkScrolledEdge] =
      dark.scrolled['/'].split('|')
    for (const [where, backdrop, sheen, edge] of [
      ['light scrolled', lightScrolledBackdrop, lightScrolledSheen, lightScrolledEdge],
      ['dark scrolled', darkScrolledBackdrop, darkScrolledSheen, darkScrolledEdge],
    ] as const) {
      expect(backdrop, `${where} blur`).toBe(lightBackdrop)
      expect(sheen, `${where} sheen`).toBe(lightSheen)
      expect(edge, `${where} edge`).toBe(lightEdge)
    }
    expect(darkSheen).toContain('linear-gradient')
    expect(darkEdge).toContain('inset')
  })

  test('dark text stays legible on the dark surfaces (contrast)', async ({ page }) => {
    await page.goto('/calculators')
    await toggleTheme(page)

    // WCAG-style contrast against the nearest painted ancestor background.
    // These are the roles most likely to be picked wrong in a future edit:
    // body copy, the muted disclaimer and the regulatory note.
    const ratios = (await page.evaluate(`(() => {
      function lum(colour) {
        const channels = colour.match(/[\\d.]+/g).slice(0, 3).map(Number).map((value) => {
          const v = value / 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
      }
      function ratio(fg, bg) {
        const a = lum(fg)
        const b = lum(bg)
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      }
      function backgroundOf(el) {
        let node = el
        while (node) {
          const colour = getComputedStyle(node).backgroundColor
          if (colour && colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') return colour
          node = node.parentElement
        }
        return 'rgb(255, 255, 255)'
      }
      const out = {}
      for (const selector of ['p', '.disclaimer', '.regulatory-note', '.input-wrap span']) {
        const el = document.querySelector(selector)
        if (el) out[selector] = ratio(getComputedStyle(el).color, backgroundOf(el))
      }
      return out
    })()`)) as Record<string, number>

    expect(Object.keys(ratios).length).toBeGreaterThan(2)
    for (const [selector, value] of Object.entries(ratios)) {
      expect(value, `${selector} contrast in dark mode`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('the password-reset panel uses the theme roles, not raw colours', async ({ page }) => {
    await page.goto('/login')
    await toggleTheme(page)
    expect(await themeAttr(page)).toBe('dark')

    await page.getByTestId('auth-forgot').click()
    await expect(page.getByTestId('auth-forgot-panel')).toBeVisible()

    const panel = (await page.evaluate(`(() => {
      const field = document.querySelector('[data-testid="auth-email"]')
      const card = document.querySelector('[data-testid="auth-forgot-panel"]')
      const hint = card.querySelector('p')
      return {
        bg: getComputedStyle(field).backgroundColor,
        ink: getComputedStyle(field).color,
        cardBg: getComputedStyle(card.parentElement).backgroundColor,
        hintInk: getComputedStyle(hint).color,
      }
    })()`)) as { bg: string; ink: string; cardBg: string; hintInk: string }

    // Dark surface, light text: the same roles as the rest of the app.
    for (const channel of channelsOf(panel.bg)) expect(channel).toBeLessThan(80)
    for (const channel of channelsOf(panel.cardBg)) expect(channel).toBeLessThan(80)
    for (const channel of channelsOf(panel.ink)) expect(channel).toBeGreaterThan(150)
    for (const channel of channelsOf(panel.hintInk)) expect(channel).toBeGreaterThan(100)
  })

  test('toggling from the account menu works with the mobile panel open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const nav = page.getByTestId('navbar')
    await page.getByTestId('hamburger').click()
    await expect(nav).toHaveAttribute('data-menu-open', 'true')

    await toggleTheme(page)
    expect(await themeAttr(page)).toBe('dark')
  })

  test('the control row still fits 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/')
    await page.getByTestId('hamburger').click()

    // The row holds the account trigger alone now (the language switch moved
    // into the account menu), and it must stay inside the narrowest supported
    // width.
    const box = await page.getByTestId('nav-avatar').boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
    const row = (await page.getByTestId('nav-bar-controls').boundingBox())!
    expect(row.x).toBeGreaterThanOrEqual(0)
    expect(row.x + row.width).toBeLessThanOrEqual(360)
  })

  test('a dark-preferring visitor lands dark without touching the toggle', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto('/')

    expect(await themeAttr(page)).toBe('dark')
    // Still no stored choice: the OS preference is a fallback, not a decision.
    expect(await page.evaluate(`localStorage.getItem('${STORAGE_KEY}')`)).toBeNull()

    await context.close()
  })
})
