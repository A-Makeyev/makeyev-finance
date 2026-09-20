import { expect, test } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'

/**
 * The mortgage-track-types article: reachable from the articles list, reads in
 * the document language's direction (RTL for Hebrew), links to the prepayment
 * article and to the calculator, and stays within the viewport at phone size.
 * Same user path as the other articles: list -> article -> back to the list,
 * in both languages and at phone and desktop widths.
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
    test(`track-types article - ${language} @ ${viewport.tag}px`, async ({ page }) => {
      const rtl = language === 'hebrew'
      await installExternalMocks(page)
      await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/articles')

      // The list has its own banner picture rather than the shared sub-cover.
      const listBanner = (await page.evaluate(
        `getComputedStyle(document.querySelector('section.articles-sub-header')).backgroundImage`,
      )) as string
      expect(listBanner).toContain('/images/articles-cover.jpg')

      // The card is on the list and leads to the article.
      const card = page.locator('.article-card[href="/articles/mortgage-track-types"]')
      await expect(card).toBeVisible()
      // The listing card carries a thumbnail for this article.
      await expect(card.locator('img.article-card-media')).toBeVisible()
      await card.click()
      await expect(page).toHaveURL(/\/articles\/mortgage-track-types$/)

      const article = page.getByTestId('track-types-article')
      await expect(article).toBeVisible()
      await expect(article).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')

      // The article's own picture is the hero banner background, still under
      // the shared dark overlay so the h1 stays readable - and the body itself
      // carries no image block.
      const heroBanner = page.locator('section.article-sub-header')
      const heroBackground = (await page.evaluate(
        `getComputedStyle(document.querySelector('section.article-sub-header')).backgroundImage`,
      )) as string
      expect(heroBackground).toContain('linear-gradient')
      expect(heroBackground).toContain('/images/mortgage-11.jpeg')
      await expect(heroBanner.locator('h1')).not.toHaveText('')
      await expect(article.locator('img')).toHaveCount(0)

      // Four sections, each with a heading and real body text.
      const sections = article.locator('section.article-section')
      await expect(sections).toHaveCount(4)
      for (const section of await sections.all()) {
        await expect(section.locator('h2')).not.toHaveText('')
      }
      // Every paragraph carries real text - a missing translation would render
      // an empty block.
      for (const paragraph of await article.locator('.article-paragraph').all()) {
        await expect(paragraph).not.toHaveText('')
      }

      // The four track building blocks, each with a title and a text.
      const blocks = article.locator('.article-facts li')
      await expect(blocks).toHaveCount(4)
      for (const block of await blocks.all()) {
        await expect(block.locator('h4')).not.toHaveText('')
        await expect(block.locator('p')).not.toHaveText('')
      }

      // Both in-app links are real routes: the prepayment article and the
      // calculator. Walk each one and come back.
      const prepaymentLink = article.locator('.article-link[href="/articles/prepayment-penalties"]')
      await expect(prepaymentLink).toBeVisible()
      await prepaymentLink.click()
      await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)
      await page.goBack()
      await expect(article).toBeVisible()

      const calculatorLink = article.locator('.article-link[href="/calculators"]')
      await expect(calculatorLink).toBeVisible()
      await calculatorLink.click()
      await expect(page).toHaveURL(/\/calculators$/)
      await page.goBack()
      await expect(article).toBeVisible()

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

test('track-types article - the new surfaces use the theme tokens', async ({ page }) => {
  await installExternalMocks(page)
  await page.addInitScript(() => {
    localStorage.setItem('site_language', 'hebrew')
    localStorage.setItem('site_theme', 'dark')
  })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/articles/mortgage-track-types')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // The track block cards take the dark --surface-card fill with readable ink.
  const block = (await page.evaluate(`(() => {
    const cs = getComputedStyle(document.querySelector('.article-facts li'));
    return { bg: cs.backgroundColor, ink: getComputedStyle(document.querySelector('.article-facts h4')).color };
  })()`)) as { bg: string; ink: string }
  for (const channel of channelsOf(block.bg)) expect(channel, 'block fill').toBeLessThan(60)
  for (const channel of channelsOf(block.ink)) expect(channel, 'block ink').toBeGreaterThan(150)

  // Section headings are --ink as well.
  const heading = (await page.evaluate(
    `getComputedStyle(document.querySelector('.article-section h2')).color`,
  )) as string
  for (const channel of channelsOf(heading)) expect(channel, 'heading ink').toBeGreaterThan(150)
})
