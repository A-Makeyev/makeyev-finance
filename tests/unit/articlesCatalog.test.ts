import { describe, expect, it } from 'vitest'
import { ARTICLE_IMAGES, ARTICLE_LIST, articleHeroBackground, isArticleSlug } from '@/lib/articles'
import { PRESET_IDS, PRESETS, PRIME_MARGIN, VARIABLE_SHARE_LIMIT } from '@/lib/amortization'

describe('article catalog', () => {
  it('lists every article with its own image', () => {
    expect(ARTICLE_LIST.map(({ slug }) => slug)).toEqual([
      'prepayment-penalties',
      'moving-checklist',
      'mortgage-track-types',
      'mortgage-decisions',
    ])
    for (const { slug } of ARTICLE_LIST) {
      expect(ARTICLE_IMAGES[slug]).toMatch(/^\/images\//)
    }
  })

  it('accepts exactly the real slugs (the comment routes validate with this)', () => {
    for (const slug of Object.keys(ARTICLE_IMAGES)) {
      expect(isArticleSlug(slug)).toBe(true)
    }
    expect(isArticleSlug('nope')).toBe(false)
    expect(isArticleSlug('')).toBe(false)
    // A prototype key must not pass as an article.
    expect(isArticleSlug('toString')).toBe(false)
  })

  it('builds the hero background from the article image with the dark overlay', () => {
    const style = articleHeroBackground('prepayment-penalties')
    expect(style.backgroundImage).toContain('linear-gradient')
    expect(style.backgroundImage).toContain(ARTICLE_IMAGES['prepayment-penalties'])
  })
})

describe('calculator constants the articles quote', () => {
  // The track-types article quotes these numbers in its copy; the same
  // content-drift pin the client app's tests apply, kept here so the ported
  // article pages and the shared amortization module cannot drift apart.
  // (PRIME_MARGIN is in PERCENT here: 1.5 means 1.5%.)
  it('keeps the prime margin and variable-share ceiling at the regulated values', () => {
    expect(PRIME_MARGIN).toBeCloseTo(1.5, 6)
    expect(VARIABLE_SHARE_LIMIT).toBeCloseTo(2 / 3, 6)
  })

  it('exposes a preset id for every preset definition (article deep links)', () => {
    expect(PRESET_IDS.length).toBeGreaterThan(0)
    for (const id of PRESET_IDS) {
      expect(PRESETS[id].length).toBeGreaterThan(0)
    }
  })
})
