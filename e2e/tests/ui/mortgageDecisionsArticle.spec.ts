import { test, expect, seedLanguage, seedSiteState } from '../../fixtures'

/**
 * The mortgage-decisions article: reachable from the articles list, reads in
 * the document language's direction (RTL for Hebrew), links to the calculator
 * (with per-preset deep links), the prepayment article and the track-types
 * article, and stays within the viewport at phone size. Same user path as the
 * other articles: list -> article -> back to the list, in both languages and
 * at phone and desktop widths.
 */

const VIEWPORTS = [
  { width: 360, height: 800, tag: '360' },
  { width: 1280, height: 900, tag: '1280' },
]

/** The preset ids, in PRESETS/PRESET_IDS order. */
type PresetId = 'basket1' | 'basket2' | 'basket3' | 'basket4'

/** Each preset's track types, mirroring lib/amortization.ts PRESETS. */
const PRESET_TYPES: Record<PresetId, string[]> = {
  basket1: ['fixed'],
  basket2: ['fixed', 'prime'],
  basket3: ['fixed', 'prime', 'variableIndexed5y'],
  basket4: ['prime', 'fixed', 'variableIndexed5y'],
}

function channelsOf(rgb: string): number[] {
  return rgb
    .replace(/[^0-9,]/g, '')
    .split(',')
    .slice(0, 3)
    .map(Number)
}

for (const language of ['hebrew', 'english'] as const) {
  for (const viewport of VIEWPORTS) {
    test(`mortgage-decisions article - ${language} @ ${viewport.tag}px`, async ({ page }) => {
      const rtl = language === 'hebrew'
      seedLanguage(page, language)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/articles')

      // The card is on the list and leads to the article.
      const card = page.locator('.article-card[href="/articles/mortgage-decisions"]')
      await expect(card).toBeVisible()
      await expect(card.locator('img.article-card-media')).toBeVisible()
      await card.click()
      await expect(page).toHaveURL(/\/articles\/mortgage-decisions$/)

      const article = page.getByTestId('mortgage-decisions-article')
      await expect(article).toBeVisible()
      await expect(article).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')

      // The article's own picture is the hero banner background.
      const heroBackground = (await page.evaluate(
        `getComputedStyle(document.querySelector('section.article-sub-header')).backgroundImage`,
      )) as string
      expect(heroBackground).toContain('linear-gradient')
      expect(heroBackground).toContain('/images/mortgage-12.jpeg')

      // Three sections, each with a heading and real body text.
      const sections = article.locator('section.article-section')
      await expect(sections).toHaveCount(3)
      for (const section of await sections.all()) {
        await expect(section.locator('h2')).not.toHaveText('')
      }
      for (const paragraph of await article.locator('.article-paragraph').all()) {
        await expect(paragraph).not.toHaveText('')
      }

      // The four preset blocks, each with a title, a text and its own
      // calculator deep link.
      const presetBlocks = sections.nth(0).locator('.article-facts li')
      await expect(presetBlocks).toHaveCount(4)
      for (const block of await presetBlocks.all()) {
        await expect(block.locator('h4')).not.toHaveText('')
        await expect(block.locator('p')).not.toHaveText('')
        const tryLink = block.locator('a.article-link')
        await expect(tryLink).toBeVisible()
        expect(await tryLink.getAttribute('href')).toMatch(/^\/calculators\?preset=basket\d$/)
      }
      // The prepayment rule-of-thumb facts (core rule + penalty exception).
      const prepayFacts = sections.nth(1).locator('.article-facts li')
      await expect(prepayFacts).toHaveCount(2)

      // The two in-app article links are real routes: the prepayment article
      // and the track-types article. Walk each one and come back.
      const prepaymentLink = article.locator('.article-link[href="/articles/prepayment-penalties"]')
      await expect(prepaymentLink).toBeVisible()
      await prepaymentLink.click()
      await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)
      await page.goBack()
      await expect(article).toBeVisible()

      const trackTypesLink = article.locator('.article-link[href="/articles/mortgage-track-types"]')
      await expect(trackTypesLink).toBeVisible()
      await trackTypesLink.click()
      await expect(page).toHaveURL(/\/articles\/mortgage-track-types$/)
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

test('mortgage-decisions article - a preset deep link loads that mix in the calculator', async ({
  page,
}) => {
  seedLanguage(page, 'hebrew')
  await page.setViewportSize({ width: 1280, height: 900 })

  // Mix 3: three equal tracks (fixed / prime / variable indexed 5y), per
  // PRESETS in lib/amortization.ts.
  await page.goto('/calculators?preset=basket3')
  await expect(page.getByTestId('tracks-list').locator('fieldset')).toHaveCount(3)
  const expectedTypes = PRESET_TYPES.basket3
  for (let index = 0; index < expectedTypes.length; index++) {
    await expect(page.getByTestId(`track-type-${index + 1}`)).toHaveValue(expectedTypes[index])
  }
  // The matching preset button is the active one in the selector.
  await expect(page.getByTestId('preset-basket3')).toHaveAttribute('aria-pressed', 'true')

  // A deep link to a different preset swaps the mix accordingly.
  await page.goto('/calculators?preset=basket4')
  await expect(page.getByTestId('tracks-list').locator('fieldset')).toHaveCount(3)
  for (let index = 0; index < PRESET_TYPES.basket4.length; index++) {
    await expect(page.getByTestId(`track-type-${index + 1}`)).toHaveValue(
      PRESET_TYPES.basket4[index],
    )
  }
  await expect(page.getByTestId('preset-basket4')).toHaveAttribute('aria-pressed', 'true')

  // No param: the store's own default state - the recommended mix active -
  // stays untouched.
  await page.goto('/calculators')
  await expect(page.getByTestId('preset-basket4')).toHaveAttribute('aria-pressed', 'true')
})

test('mortgage-decisions article - the new surfaces use the theme tokens', async ({ page }) => {
  seedSiteState(page, { language: 'hebrew', theme: 'dark' })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/articles/mortgage-decisions')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // The preset block cards take the dark --surface-card fill with readable ink.
  const block = (await page.evaluate(`(() => {
    const cs = getComputedStyle(document.querySelector('.article-facts li'));
    return { bg: cs.backgroundColor, ink: getComputedStyle(document.querySelector('.article-facts h4')).color };
  })()`)) as { bg: string; ink: string }
  for (const channel of channelsOf(block.bg)) expect(channel, 'block fill').toBeLessThan(60)
  for (const channel of channelsOf(block.ink)) expect(channel, 'block ink').toBeGreaterThan(150)
})
