import { test, expect } from '../../fixtures'
import { ils } from '../../support/ils'

/**
 * Visual-QA spec: exercises new UI pieces - the lawyer-floor inline note, the
 * dashed balance-axis grid and the purchase-tax breakdown ladder - in both
 * languages (RTL/LTR) at mobile and desktop widths. Asserts layout invariants
 * and captures element screenshots into test-results/visual-qa/ for human
 * eyeballing.
 *
 * Gated behind VISUAL_QA=1 so it never runs in the normal e2e suite:
 *   VISUAL_QA=1 npx playwright test --project=ui-chromium -g "visual qa"
 */

if (!process.env.VISUAL_QA) {
  test.skip(true, 'Set VISUAL_QA=1 to run visual QA checks')
}

const SHOT_DIR = 'test-results/visual-qa'
const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  // Tablet / small-laptop width: the costs row used to squeeze the ₪ side of
  // the realtor / lawyer fee pairs here (see the layout test in
  // calculator.spec.ts).
  { width: 1024, height: 900, tag: '1024' },
  { width: 1280, height: 900, tag: '1280' },
]

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`visual qa: floor note + balance grid - ${language} @ ${viewport.tag}px`, async ({
      page,
    }) => {
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/calculators')

      // Prove we are actually in each mode before judging the layout.
      // (String-form evaluate: the e2e tsconfig has no DOM lib.)
      expect(await page.locator('html').getAttribute('dir')).toBe(
        language === 'hebrew' ? 'rtl' : 'ltr',
      )

      // A fee basis exists (prefilled 1M loan); trigger the floor override.
      const lawyerAmount = page.getByTestId('lawyer-amount')
      await lawyerAmount.fill('7,000')
      const note = page.getByTestId('lawyer-floor-note')
      await expect(note).toBeVisible()
      await expect(note).toContainText('7,080')

      // The note must fit the viewport with no horizontal page overflow.
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
      const noteBox = await note.boundingBox()
      expect(noteBox).not.toBeNull()
      expect(noteBox!.x).toBeGreaterThanOrEqual(0)
      expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(viewport.width + 1)

      // The amortization chart (inside the schedule section) renders from the
      // prefill: every balance tick gets its own dashed gridline, and the
      // CSS binding (dashed, tinted, faint) must actually apply.
      const balanceTicks = page.locator('.amort-chart .chart-tick-balance')
      const balanceGrid = page.locator('.amort-chart .chart-grid-balance')
      await expect(balanceTicks.first()).toBeVisible()
      expect(await balanceGrid.count()).toBe(await balanceTicks.count())
      const gridStyle = (await page.evaluate(
        `(() => {
          const el = document.querySelector('.amort-chart .chart-grid-balance')
          if (!el) return null
          const cs = getComputedStyle(el)
          return { dash: cs.strokeDasharray, opacity: cs.opacity }
        })()`,
      )) as { dash: string; opacity: string } | null
      expect(gridStyle).not.toBeNull()
      expect(gridStyle!.dash).toContain('3')
      expect(Number(gridStyle!.opacity)).toBeLessThan(0.2)

      // Screenshots for the human pass.
      await page
        .getByTestId('costs-row')
        .screenshot({ path: `${SHOT_DIR}/costs-${language}-${viewport.tag}.png` })
      await page
        .locator('.amort-chart')
        .screenshot({ path: `${SHOT_DIR}/amort-chart-${language}-${viewport.tag}.png` })
      await page.screenshot({
        path: `${SHOT_DIR}/full-${language}-${viewport.tag}.png`,
        fullPage: true,
      })
    })
  }
}

/**
 * The auth screen is the only page shell with no hero banner: it carries its
 * own faint backdrop, fills the viewport (so the footer starts below the
 * fold) and has to stay clear of the fixed chrome. Checked in both themes at
 * both widths, with a full-page shot for the human pass.
 */
for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 360, height: 800, tag: '360' },
    { width: 1280, height: 900, tag: '1280' },
  ]) {
    test(`visual qa: auth page shell - ${theme} @ ${viewport.tag}px`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('site_theme', value), theme)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/login')

      expect(await page.locator('html').getAttribute('data-theme')).toBe(theme)

      const layout = (await page.evaluate(
        `(() => {
          const box = (selector) => document.querySelector(selector).getBoundingClientRect()
          const main = document.querySelector('main.auth-page')
          return {
            navbarBottom: Math.round(box('[data-testid="navbar"]').bottom),
            headingTop: Math.round(box('h1').top),
            footers: document.querySelectorAll('footer.footer').length,
            backdrop: getComputedStyle(main).backgroundImage,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }
        })()`,
      )) as {
        navbarBottom: number
        headingTop: number
        footers: number
        backdrop: string
        overflow: number
      }

      expect(layout.overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
      expect(layout.headingTop, 'card clears the fixed chrome').toBeGreaterThanOrEqual(
        layout.navbarBottom,
      )
      // No footer on the auth surface, and the photo backdrop really paints.
      expect(layout.footers, 'auth page has no footer').toBe(0)
      expect(layout.backdrop, 'auth backdrop applied').toContain('/images/login-cover.jpg')

      await page.screenshot({
        path: `${SHOT_DIR}/auth-${theme}-${viewport.tag}.png`,
        fullPage: true,
      })
    })
  }
}

test('visual qa: auth submit loading state', async ({ page }) => {
  // Slow the credential call down so the button's in-flight state can be
  // captured: a spinning glyph, the "sending" label, locked and busy.
  await page.route('**/api/auth/sign-in/email', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'visual-qa', user: { emailVerified: true } }),
    })
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/login')
  await page.getByTestId('auth-email').fill('user@example.test')
  await page.getByTestId('auth-password').fill('password123')

  const submit = page.getByTestId('auth-submit')
  await submit.click()
  await expect(submit).toHaveAttribute('aria-busy', 'true')
  await expect(submit).toBeDisabled()
  await expect(page.getByTestId('auth-submit-spinner')).toBeVisible()

  await submit.screenshot({ path: `${SHOT_DIR}/auth-submit-loading.png` })
  await page.screenshot({ path: `${SHOT_DIR}/auth-page-loading.png`, fullPage: false })
})

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`visual qa: purchase-tax breakdown - ${language} @ ${viewport.tag}px`, async ({
      page,
    }) => {
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/calculators')

      expect(await page.locator('html').getAttribute('dir')).toBe(
        language === 'hebrew' ? 'rtl' : 'ltr',
      )

      // 2,000,000 first home with 500,000 capital: tax is charged, so the
      // ladder renders under the summary notes.
      await page.getByTestId('property-value').fill('2,000,000')
      await page.getByTestId('initial-capital').fill('500,000')
      const breakdown = page.getByTestId('purchase-tax-breakdown')
      await expect(breakdown).toBeVisible()
      await breakdown.locator('summary').click()

      // The ladder must fit the viewport with no horizontal page overflow.
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
      const box = await breakdown.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)

      // Its bottom line matches the summary figure, in both languages
      // (3.5% × 21,255 = 743.925 → displayed as 744).
      await expect(breakdown.locator('tfoot')).toContainText(ils(744))

      await breakdown.screenshot({
        path: `${SHOT_DIR}/tax-breakdown-${language}-${viewport.tag}.png`,
      })
    })
  }
}
