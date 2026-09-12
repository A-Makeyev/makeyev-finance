import { test, expect, type Page } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'

/**
 * UI contract for the site theme (sun / crescent toggle beside the language
 * flag): follows the OS on a first visit, remembers an explicit choice in
 * localStorage, and flips the whole surface - not just the navbar.
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

test.describe('theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
  })

  test('first visit follows the OS (light here), and the toggle persists', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('theme-switch')).toBeVisible()

    // No saved choice + a light OS => light, and nothing written yet.
    expect(await themeAttr(page)).toBe('light')
    expect(await page.evaluate(`localStorage.getItem('${STORAGE_KEY}')`)).toBeNull()

    const toggle = page.getByTestId('theme-switch')
    // The label names the ACTION, so a light page offers "dark mode".
    await expect(toggle).toHaveAttribute('aria-label', 'מצב כהה')

    await toggle.click()
    expect(await themeAttr(page)).toBe('dark')
    // The explicit choice is persisted (never 'system').
    expect(await page.evaluate(`localStorage.getItem('${STORAGE_KEY}')`)).toBe('dark')
    await expect(toggle).toHaveAttribute('aria-label', 'מצב בהיר')

    // The page itself repaints, not just the attribute.
    const bodyBg = (await page.evaluate(
      `getComputedStyle(document.body).backgroundColor`,
    )) as string
    for (const channel of channelsOf(bodyBg)) expect(channel).toBeLessThan(60)

    // Survives a reload (and the pre-paint script applies it before the bundle).
    await page.reload()
    expect(await themeAttr(page)).toBe('dark')

    // Toggling back to light is remembered too.
    await page.getByTestId('theme-switch').click()
    expect(await themeAttr(page)).toBe('light')
    await page.reload()
    expect(await themeAttr(page)).toBe('light')
  })

  test('applies to the calculator surfaces, not only the chrome', async ({ page }) => {
    await page.goto('/calculators')
    await page.getByTestId('theme-switch').click()
    expect(await themeAttr(page)).toBe('dark')

    await expect(page.locator('.calculator-panel')).toBeVisible()
    const panel = await panelBackground(page)
    for (const channel of channelsOf(panel)) expect(channel).toBeLessThan(80)
  })

  test('fields dim down in dark mode, with light text inside', async ({ page }) => {
    await page.goto('/calculators')
    await page.getByTestId('theme-switch').click()

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

    const scrolledBar = async () => {
      await page.evaluate(`window.scrollTo(0, 400)`)
      await page.waitForTimeout(500)
      return (await page.evaluate(`(() => {
        const nav = document.getElementById('navbar')
        const cs = getComputedStyle(nav)
        return cs.backdropFilter + '|' + cs.backgroundColor
      })()`)) as string
    }

    // Light: the legacy bar - solid aliceblue, no blur.
    const [lightBackdrop, lightBg] = (await scrolledBar()).split('|')
    expect(lightBackdrop).toBe('none')
    expect(channelsOf(lightBg)).toEqual([240, 248, 255])

    // Dark: the top state's frosted glass, translucent over dark.
    await page.getByTestId('theme-switch').click()
    const [darkBackdrop, darkBg] = (await scrolledBar()).split('|')
    expect(darkBackdrop).toContain('blur')
    const darkAlpha = Number(darkBg.match(/[\d.]+\)$/)?.[0]?.replace(')', ''))
    expect(darkAlpha).toBeGreaterThan(0.5)
    expect(darkAlpha).toBeLessThan(1)
  })

  test('dark text stays legible on the dark surfaces (contrast)', async ({ page }) => {
    await page.goto('/calculators')
    await page.getByTestId('theme-switch').click()

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

  test('closes the mobile menu, like the language flag does', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const nav = page.getByTestId('navbar')
    await page.getByTestId('hamburger').click()
    await expect(nav).toHaveAttribute('data-menu-open', 'true')

    await page.getByTestId('theme-switch').click()
    await expect(nav).toHaveAttribute('data-menu-open', 'false')
    expect(await themeAttr(page)).toBe('dark')
  })

  test('the extra icon still fits the 360px control row', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/')
    await page.getByTestId('hamburger').click()

    const toggle = page.getByTestId('theme-switch')
    await expect(toggle).toBeVisible()
    const box = await toggle.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(360)
    }
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
