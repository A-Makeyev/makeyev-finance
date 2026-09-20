import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'
import { PRIME_MARGIN, VARIABLE_SHARE_LIMIT } from '../../src/lib/amortization'

/** The four track building blocks, in reading order. */
const BLOCK_KEYS = ['prime', 'fixed', 'variable', 'indexed'] as const

/**
 * The mortgage-track-types article is general educational content sitting
 * next to a calculator that enforces the same numbers in code. The i18n parity
 * test already guarantees both languages define the same keys; these tests
 * guard that the values are usable and - the important part - that the
 * figures the article quotes for the prime margin and the variable-share
 * ceiling still agree with `lib/amortization.ts`, so the two surfaces cannot
 * drift apart.
 */
describe('mortgage track types article content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    describe(language, () => {
      const content = translation.education.trackTypes

      it('states all four building blocks with a title and a text each', () => {
        for (const key of BLOCK_KEYS) {
          expect(content.blocks[key].title.trim(), `${key} title`).not.toBe('')
          expect(content.blocks[key].text.trim(), `${key} text`).not.toBe('')
        }
      })

      it('fills the intro, methods, mix, choosing and disclaimer sections', () => {
        for (const [name, value] of [
          ['intro', content.intro],
          ['blocks.title', content.blocks.title],
          ['primePenaltyNote', content.primePenaltyNote],
          ['prepaymentLink', content.prepaymentLink],
          ['methods.title', content.methods.title],
          ['methods.spitzer', content.methods.spitzer],
          ['methods.equalPrincipal', content.methods.equalPrincipal],
          ['methods.note', content.methods.note],
          ['mix.title', content.mix.title],
          ['mix.body', content.mix.body],
          ['mix.limit', content.mix.limit],
          ['choosing.title', content.choosing.title],
          ['choosing.body', content.choosing.body],
          ['choosing.terms', content.choosing.terms],
          ['choosing.calculatorLead', content.choosing.calculatorLead],
          ['choosing.calculatorLink', content.choosing.calculatorLink],
          ['disclaimer', content.disclaimer],
          ['backToArticles', content.backToArticles],
        ] as const) {
          expect(value.trim(), name).not.toBe('')
        }
      })

      it('quotes the same prime margin the calculator uses', () => {
        // The article's ~1.5% figure must match PRIME_MARGIN, never a stale
        // course-material number.
        expect(content.blocks.prime.text).toContain(`${PRIME_MARGIN}%`)
      })

      it('quotes the same variable-share ceiling the calculator enforces', () => {
        // Pin against the calculator's own displayed wording rather than a
        // computed value: the app renders 66.66% (the truncated 2/3), so the
        // article must say the same thing the form's error line says.
        const calculatorCap = /(\d+\.\d+)%/.exec(
          translation.calculator.errors.variableCapLine1,
        )?.[1]
        expect(calculatorCap, 'calculator variable-cap wording').toBe('66.66')
        expect(content.mix.limit).toContain(`${calculatorCap}%`)
        // And the fixed-side complement is at least a third, matching 2/3
        // within the rounding the app displays.
        expect(Number('33.33')).toBeCloseTo((1 - VARIABLE_SHARE_LIMIT) * 100, 1)
        expect(content.mix.limit).toContain('33.33%')
      })

      it('fills the article card title, summary and cta on the articles list', () => {
        expect(translation.articles.trackTypes.title.trim()).not.toBe('')
        expect(translation.articles.trackTypes.summary.trim()).not.toBe('')
        expect(translation.articles.trackTypes.cta.trim()).not.toBe('')
      })

      it('fills the per-page meta description', () => {
        const description = translation.meta.articlesTrackTypesDescription
        expect(description.trim()).not.toBe('')
        expect(description).not.toContain('\u2014')
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          content.intro,
          content.blocks.title,
          ...BLOCK_KEYS.flatMap((key) => [content.blocks[key].title, content.blocks[key].text]),
          content.primePenaltyNote,
          content.prepaymentLink,
          content.methods.title,
          content.methods.spitzer,
          content.methods.equalPrincipal,
          content.methods.note,
          content.mix.title,
          content.mix.body,
          content.mix.limit,
          content.choosing.title,
          content.choosing.body,
          content.choosing.terms,
          content.choosing.calculatorLead,
          content.choosing.calculatorLink,
          content.disclaimer,
          content.backToArticles,
          translation.articles.trackTypes.title,
          translation.articles.trackTypes.summary,
          translation.articles.trackTypes.cta,
        ]
        for (const value of strings) expect(value).not.toContain('\u2014')
      })
    })
  }
})
