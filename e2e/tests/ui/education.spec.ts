import { expect, test } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'

/**
 * Prepayment-penalty education: the collapsible note inside the calculator
 * panel and the article it links to. Both surfaces state the same four facts
 * from one set of translation keys, so this walks the path a user actually
 * takes (note → article → back to the list) in both languages and at phone and
 * desktop widths.
 *
 * Set VISUAL_QA=1 to also drop light/dark screenshots into
 * test-results/visual-qa/ for the human pass:
 *   VISUAL_QA=1 npx playwright test --project=ui-chromium -g "prepayment-penalty"
 */

const SHOT_DIR = 'test-results/visual-qa'
const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`prepayment-penalty note and article - ${language} @ ${viewport.tag}px`, async ({
      page,
    }) => {
      const rtl = language === 'hebrew'
      await installExternalMocks(page, { boiKeyRate: 4.5 })
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/calculators')

      // Prove each mode before judging the layout (the calculator is the one
      // route that goes RTL for Hebrew).
      expect(await page.locator('html').getAttribute('dir')).toBe(rtl ? 'rtl' : 'ltr')

      // Collapsed by default so the terse summary stays clean, and the note
      // sits on the real page rather than behind a computed state.
      const note = page.getByTestId('prepayment-note')
      await expect(note).toBeVisible()
      await expect(page.getByTestId('prepayment-penalty-facts')).toBeHidden()

      // The note is indented under the ⚠️ warning (user request): never out
      // past the ⚠️ marker, and flush beneath the warning box. The exact indent
      // is a taste knob, so this guards the property, not the number. Read the
      // live boxes so a padding or margin change fails here instead of drifting
      // quietly. (String-form evaluate: the e2e tsconfig has no DOM lib.)
      const alignment = (await page.evaluate(
        `(() => {
          const marker = document.querySelector('.regulatory-note strong')
          const warning = document.querySelector('.regulatory-note')
          const summary = document.querySelector('[data-testid="prepayment-note"] > summary')
          if (!marker || !warning || !summary) return null
          const m = marker.getBoundingClientRect()
          const w = warning.getBoundingClientRect()
          const s = summary.getBoundingClientRect()
          // Distance inward from the ⚠️ marker: positive means indented under
          // it, negative means overhanging out past it. In RTL the start edge
          // is the right one, and indenting moves it left, so flip the signs.
          const rtl = getComputedStyle(document.documentElement).direction === 'rtl'
          return {
            indentFromMarker: Math.round(rtl ? m.right - s.right : s.left - m.left),
            gapBelowWarning: Math.round(s.top - w.bottom),
          }
        })()`,
      )) as { indentFromMarker: number; gapBelowWarning: number } | null
      expect(alignment, 'warning and note both rendered').not.toBeNull()
      expect(
        alignment?.indentFromMarker,
        'note starts at or under the ⚠️ marker',
      ).toBeGreaterThanOrEqual(0)
      expect(alignment?.gapBelowWarning, 'note sits under the warning').toBeGreaterThanOrEqual(0)
      expect(alignment?.gapBelowWarning, 'note sits under the warning').toBeLessThanOrEqual(8)

      await note.locator('summary').click()
      const facts = page.getByTestId('prepayment-penalty-facts')
      await expect(facts).toBeVisible()
      await expect(facts.locator('li')).toHaveCount(4)
      // Every fact carries a title and a text - a blank translation would
      // otherwise render as an empty bullet.
      for (const item of await facts.locator('li').all()) {
        await expect(item.locator('h4')).not.toHaveText('')
        await expect(item.locator('p')).not.toHaveText('')
      }

      // The note is meant to read as the same kind of collapsible block as the
      // purchase-tax breakdown (user request: same collapsing treatment and
      // spacing), so compare the two blocks' live computed values instead of
      // pinning numbers that would silently drift. Triggering the breakdown
      // needs a taxed purchase: 2,000,000 first home with 500,000 capital.
      // (String-form evaluate: the e2e tsconfig has no DOM lib.)
      await page.getByTestId('property-value').fill('2,000,000')
      await page.getByTestId('initial-capital').fill('500,000')
      const taxBreakdown = page.getByTestId('purchase-tax-breakdown')
      await expect(taxBreakdown).toBeVisible()
      // Open it too, so the open-state summary gap is part of the comparison.
      await taxBreakdown.locator('summary').click()

      if (process.env.VISUAL_QA) {
        // The other block that draws the caret, for the human pass.
        await taxBreakdown.screenshot({
          path: `${SHOT_DIR}/tax-breakdown-${language}-${viewport.tag}.png`,
        })
      }

      const snapshot = (await page.evaluate(
        `(() => {
          const read = (selector) => {
            const el = document.querySelector(selector)
            if (!el) return null
            const block = getComputedStyle(el)
            const summary = getComputedStyle(el.querySelector('summary'))
            return {
              fontSize: block.fontSize,
              marginTop: block.marginTop,
              summaryLineHeight: summary.lineHeight,
              summaryWeight: summary.fontWeight,
              summaryColor: summary.color,
              openSummaryGap: summary.marginBlockEnd,
            }
          }
          const noteBody = getComputedStyle(
            document.querySelector('[data-testid="prepayment-note"] .prepayment-facts p'),
          )
          return {
            note: read('[data-testid="prepayment-note"]'),
            breakdown: read('.tax-breakdown'),
            noteBodyFontSize: noteBody.fontSize,
            noteBodyLineHeight: noteBody.lineHeight,
          }
        })()`,
      )) as {
        note: Record<string, string> | null
        breakdown: Record<string, string> | null
        noteBodyFontSize: string
        noteBodyLineHeight: string
      }

      // Same collapsing treatment and spacing: every block- and summary-level
      // value matches the purchase-tax breakdown's.
      expect(snapshot.breakdown).not.toBeNull()
      expect(snapshot.note).toEqual(snapshot.breakdown)
      // The two blocks draw their own caret instead of the UA marker (user
      // requests: the marker's 10x18px glyph can neither match the ⚠️ glyph's
      // size nor sit under the 💡). Read the live boxes: the caret against the
      // ⚠️'s ink, and the tax caret's start edge against the 💡 glyph's.
      const caret = (await page.evaluate(
        `(() => {
          const rect = (el) => {
            const r = el.getBoundingClientRect()
            return { left: r.left, right: r.right, width: r.width, height: r.height }
          }
          const warn = document.querySelector('.regulatory-note strong')
          const icon = document.querySelector('.note-line.info .note-icon')
          if (!warn || !icon) return null
          const canvas = document.createElement('canvas').getContext('2d')
          canvas.font = getComputedStyle(warn).font
          const metrics = canvas.measureText('\u26A0\uFE0F')
          const glyph = document.createRange()
          glyph.selectNodeContents(icon)
          const iconBox = glyph.getBoundingClientRect()
          const centre = (box) => (box.left + box.right) / 2
          return {
            warnInk: {
              width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
              height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
            },
            iconCentre: centre(iconBox),
            taxCaret: rect(document.querySelector('.tax-breakdown .collapse-caret')),
            noteCaret: rect(
              document.querySelector('[data-testid="prepayment-note"] .collapse-caret'),
            ),
            caretCentre: centre(document.querySelector('.tax-breakdown .collapse-caret').getBoundingClientRect()),
          }
        })()`,
      )) as {
        warnInk: { width: number; height: number }
        iconCentre: number
        taxCaret: { width: number; height: number }
        noteCaret: { width: number; height: number }
        caretCentre: number
      } | null
      expect(caret, 'warning, icon and both carets rendered').not.toBeNull()

      // In the ⚠️ glyph's ballpark, and square rather than the UA marker's tall
      // thin 10x18 shape. A loose band on purpose: the ⚠️'s ink depends on the
      // installed colour-emoji font, the caret's size is a dialable knob, and
      // Chrome's border snapping moves the rendered figure a pixel either way
      // depending on where the block lands on the sub-pixel grid. The
      // squareness check below is the one that catches a marker fallback.
      for (const [name, box] of Object.entries({ tax: caret?.taxCaret, note: caret?.noteCaret })) {
        expect(box?.width, `${name} caret ~ ⚠️ width`).toBeGreaterThan(
          (caret?.warnInk.width ?? 0) * 0.6,
        )
        expect(box?.width, `${name} caret ~ ⚠️ width`).toBeLessThan(
          (caret?.warnInk.width ?? 0) * 1.5,
        )
        expect(box?.height, `${name} caret ~ ⚠️ height`).toBeGreaterThan(
          (caret?.warnInk.height ?? 0) * 0.6,
        )
        expect(box?.height, `${name} caret ~ ⚠️ height`).toBeLessThan(
          (caret?.warnInk.height ?? 0) * 1.5,
        )
        // Within a pixel rather than exactly square: border widths snap to whole
        // pixels, so a notch off square is normal. The UA marker's 10x18 shape
        // is what this rules out.
        expect(
          Math.abs((box?.width ?? 0) - (box?.height ?? 0)),
          `${name} caret is square, not the UA marker`,
        ).toBeLessThanOrEqual(1)
      }

      // And the tax ladder's caret is centred on the 💡 above it, not sitting at
      // the bare text edge. Centres, not start edges: both are centred in the
      // notes' 1.2em icon cell, so centring is what "under the 💡" means and it
      // stays true at any caret size, where matching start edges would drift
      // apart as the caret shrinks below the glyph's width.
      expect(Math.abs((caret?.caretCentre ?? 0) - (caret?.iconCentre ?? 0))).toBeLessThanOrEqual(2)

      // And the note's text follows its own block size with the table cells'
      // 1.5 rhythm (the global `p` rule used to win at 20px). This is a
      // self-consistency check rather than note-vs-ladder: the generic
      // narrow-screen `td` rule written for the schedule table also hits the
      // ladder's cells, so those two body sizes diverge at 360px only.
      expect(snapshot.noteBodyFontSize).toBe(snapshot.note?.fontSize)
      expect(parseFloat(snapshot.noteBodyLineHeight)).toBeCloseTo(
        parseFloat(snapshot.noteBodyFontSize) * 1.5,
        1,
      )

      // The expanded note must not push the page sideways on a phone.
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)

      if (process.env.VISUAL_QA) {
        await note.screenshot({
          path: `${SHOT_DIR}/prepayment-note-${language}-${viewport.tag}.png`,
        })
      }

      // Note → article.
      await note.getByRole('link').click()
      await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)

      const article = page.getByTestId('prepayment-penalty-article')
      await expect(article).toBeVisible()
      await expect(article.locator('li')).toHaveCount(4)
      // The article body opts into the document language's direction locally
      // (the site-wide rule keeps non-calculator pages LTR).
      await expect(article).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')

      if (process.env.VISUAL_QA) {
        await page.screenshot({
          path: `${SHOT_DIR}/article-${language}-${viewport.tag}.png`,
          fullPage: true,
        })
        await page.addInitScript(() => localStorage.setItem('site_theme', 'dark'))
        await page.reload()
        await page.screenshot({
          path: `${SHOT_DIR}/article-dark-${language}-${viewport.tag}.png`,
          fullPage: true,
        })
      }

      // The articles list links to the same page.
      await page.goto('/articles')
      const card = page.locator('.article-card')
      await expect(card).toBeVisible()
      await card.click()
      await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)
      await expect(page.getByTestId('prepayment-penalty-article')).toBeVisible()
    })
  }
}
