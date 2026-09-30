import { test, expect } from '../../fixtures'
import type { Page } from '@playwright/test'

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
}

test.describe('theme toggle', () => {
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

  test('the scrolled bar is solid aliceblue in light and frosted glass in dark', async ({
    page,
  }) => {
    await page.goto('/')

    /** Computed backdrop + background of the (scrolled) navbar. */
    const read = () =>
      page.evaluate(`(() => {
        const nav = document.getElementById('navbar')
        const cs = getComputedStyle(nav)
        return cs.backdropFilter + '|' + cs.backgroundColor
      })()`) as Promise<string>
    /**
     * Scrolls and polls until the bar has SETTLED into a state matching
     * `ok`. Polling (and re-scrolling each tick, so a scroll missed before
     * hydration is retried) removes the fixed-delay window in which the
     * scrolled class could drop between the read and the assertion - the
     * flake that made the full suite's light read see the base blur.
     */
    const settled = async (ok: (bar: string) => boolean) => {
      await expect
        .poll(async () => {
          await page.evaluate(`window.scrollTo(0, 400)`)
          return ok(await read())
        })
        .toBe(true)
      return read()
    }

    // Light: the legacy bar - solid aliceblue, no blur.
    const lightBar = await settled((bar) => {
      const [backdrop, bg] = bar.split('|')
      return backdrop === 'none' && channelsOf(bg).join(',') === '240,248,255'
    })
    expect(lightBar.split('|')[0]).toBe('none')

    // Dark: the top state's frosted glass, translucent over dark.
    await toggleTheme(page)
    const darkBar = await settled((bar) => {
      const [backdrop, bg] = bar.split('|')
      const alpha = Number(bg.match(/[\d.]+\)$/)?.[0]?.replace(')', ''))
      return backdrop.includes('blur') && alpha > 0.5 && alpha < 1
    })
    expect(darkBar.split('|')[0]).toContain('blur')
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
