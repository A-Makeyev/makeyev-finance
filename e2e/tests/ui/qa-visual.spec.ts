import { expect, test } from '@playwright/test'

/**
 * Visual-QA spec: exercises the two new UI pieces - the lawyer-floor inline
 * note and the dashed balance-axis grid - in both languages (RTL/LTR) at
 * mobile and desktop widths. Asserts layout invariants and captures element
 * screenshots into test-results/visual-qa/ for human eyeballing.
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
