import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

/** The four confirmed facts, in reading order. */
const FACT_KEYS = ['prime', 'reset', 'fixed', 'loyalty'] as const

/**
 * The prepayment-penalty section is general educational content in a financial
 * tool, so a key that resolves but is blank would render as an empty fact, and
 * a wording pass that reaches for an em dash would violate the project rule.
 * The i18n parity test already guarantees both languages define the same keys;
 * these tests guard that the values are actually usable.
 */
describe('prepayment-penalty education content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    describe(language, () => {
      const content = translation.education.prepaymentPenalty

      it('states all four facts with a title and a text each', () => {
        for (const key of FACT_KEYS) {
          expect(content.facts[key].title.trim(), `${key} title`).not.toBe('')
          expect(content.facts[key].text.trim(), `${key} text`).not.toBe('')
        }
      })

      it('fills the lead, why-prime explanation, timing note and disclaimer', () => {
        for (const [name, value] of [
          ['lead', content.lead],
          ['whyPrime', content.whyPrime],
          ['timing', content.timing],
          ['disclaimer', content.disclaimer],
        ] as const) {
          expect(value.trim(), name).not.toBe('')
        }
      })

      it('fills the article card title and summary on the articles list', () => {
        expect(translation.articles.prepayment.title.trim()).not.toBe('')
        expect(translation.articles.prepayment.summary.trim()).not.toBe('')
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          content.title,
          content.lead,
          content.whyPrime,
          content.timing,
          content.disclaimer,
          content.articleLink,
          content.backToArticles,
          translation.articles.prepayment.title,
          translation.articles.prepayment.summary,
          translation.articles.prepayment.cta,
          ...FACT_KEYS.flatMap((key) => [content.facts[key].title, content.facts[key].text]),
        ]
        for (const value of strings) expect(value).not.toContain('\u2014')
      })
    })
  }
})
