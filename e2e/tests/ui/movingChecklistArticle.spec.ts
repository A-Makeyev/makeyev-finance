import { test, expect, seedLanguage, seedSiteState } from '../../fixtures'

/**
 * The moving-checklist article: reachable from the articles list, reads in
 * the document language's direction (RTL for Hebrew), and stays within the
 * viewport width at phone size. Same user path as the prepayment article:
 * list -> article -> back to the list, in both languages and at phone and
 * desktop widths.
 */

const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

/** "rgb(r, g, b)" -> the three channels, so a test can assert dark/light
    without pinning the exact palette value (same approach as theme.spec.ts). */
function channelsOf(rgb: string): number[] {
  return rgb
    .replace(/[^0-9,]/g, '')
    .split(',')
    .slice(0, 3)
    .map(Number)
}

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`moving-checklist article - ${language} @ ${viewport.tag}px`, async ({ page }) => {
      const rtl = language === 'hebrew'
      seedLanguage(page, language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/articles')

      // Per-page meta descriptions (usePageMeta rewrites the tag on every
      // client-side navigation): present on the list, non-empty.
      const readMetaDescription = () =>
        page.evaluate(
          `document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null`,
        ) as Promise<string | null>
      const listDescription = await readMetaDescription()
      expect(listDescription?.trim() ?? '', 'list meta description').not.toBe('')

      // The card is on the list and leads to the article (targeted via its
      // href now that the list carries more than one card).
      const card = page.locator('.article-card[href="/articles/moving-checklist"]')
      await expect(card).toBeVisible()
      await card.click()
      await expect(page).toHaveURL(/\/articles\/moving-checklist$/)

      // The article page rewrites the tag with its own description - a
      // per-page value, not the list's carried over. The rewrite lands in a
      // post-commit effect, just after the URL updates, so poll until it has
      // happened instead of reading once at race-with-the-render timing.
      await expect
        .poll(async () => (await readMetaDescription())?.trim() ?? '')
        .not.toBe(listDescription?.trim() ?? '')
      const articleDescription = await readMetaDescription()
      expect(articleDescription?.trim() ?? '', 'article meta description').not.toBe('')

      const article = page.getByTestId('moving-checklist-article')
      await expect(article).toBeVisible()
      // The body opts into the document language's direction locally (the
      // site-wide rule keeps non-calculator pages LTR).
      await expect(article).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')

      // Five checklist sections, each with a heading and at least one item.
      const sections = article.locator('section.article-section')
      await expect(sections).toHaveCount(5)
      for (const section of await sections.all()) {
        await expect(section.locator('h2')).not.toHaveText('')
        await expect(section.locator('li').first()).toBeVisible()
      }
      // Every rendered item carries real text - a missing translation would
      // otherwise render as an empty bullet.
      for (const item of await article.locator('li').all()) {
        await expect(item).not.toHaveText('')
      }

      // The owner-liability callout renders once, inside the meters section.
      await expect(article.locator('.article-callout')).toHaveCount(1)

      // The expanded article must not push the page sideways on a phone.
      const overflow = (await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      )) as number
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)

      // Back to the list.
      await article.locator('.article-back').click()
      await expect(page).toHaveURL(/\/articles$/)
    })
  }
}

test('moving-checklist article - the new surfaces use the theme tokens', async ({ page }) => {
  seedSiteState(page, { language: 'hebrew', theme: 'dark' })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/articles/moving-checklist')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // The callout is the one new surface this page adds: it must take the dark
  // --surface-soft fill with light --ink text on top. Styling it with raw
  // white/black (or a legacy literal) would leave it unreadable here.
  const callout = (await page.evaluate(`(() => {
    const cs = getComputedStyle(document.querySelector('.article-callout'));
    return { bg: cs.backgroundColor, ink: cs.color };
  })()`)) as { bg: string; ink: string }
  for (const channel of channelsOf(callout.bg)) expect(channel, 'callout fill').toBeLessThan(60)
  for (const channel of channelsOf(callout.ink)) expect(channel, 'callout ink').toBeGreaterThan(150)

  // Section headings are --ink as well.
  const heading = (await page.evaluate(
    `getComputedStyle(document.querySelector('.article-section h2')).color`,
  )) as string
  for (const channel of channelsOf(heading)) expect(channel, 'heading ink').toBeGreaterThan(150)
})
