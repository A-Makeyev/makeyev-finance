import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

/** The checklist sections, in reading order. */
const SECTION_KEYS = ['municipalities', 'utilities', 'meters', 'logistics', 'deposits'] as const

/**
 * The moving-checklist article is general educational content. The i18n
 * parity test already guarantees both languages define the same keys; these
 * tests guard that the values are actually usable: no empty strings (a blank
 * item would render as an empty bullet), the required documents and the
 * owner-liability warning are present, and no em dash anywhere (project rule).
 */
describe('moving-checklist article content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    describe(language, () => {
      const content = translation.education.movingChecklist
      const items = SECTION_KEYS.flatMap((key) => content.sections[key].items)

      it('states every checklist item with real text', () => {
        expect(items.length).toBeGreaterThanOrEqual(10)
        for (const item of items) expect(item.trim(), item).not.toBe('')
      })

      it('fills the intro, documents lead, timing note and disclaimer', () => {
        for (const [name, value] of [
          ['intro', content.intro],
          ['documentsLead', content.documentsLead],
          ['timing', content.timing],
          ['disclaimer', content.disclaimer],
        ] as const) {
          expect(value.trim(), name).not.toBe('')
        }
      })

      it('mentions the required documents', () => {
        // The documents lead must actually name the lease and the ID (תעודת
        // זהות), since gathering them up front is the point of the paragraph.
        expect(content.documentsLead).toMatch(/(?:חוזה|lease)/i)
        expect(content.documentsLead).toMatch(/(?:תעודת זהות|\bID\b)/i)
      })

      it('carries the owner-liability callout in the meters section', () => {
        expect(content.sections.meters.callout.trim()).not.toBe('')
      })

      it('fills the article card title and summary on the articles list', () => {
        expect(translation.articles.movingChecklist.title.trim()).not.toBe('')
        expect(translation.articles.movingChecklist.summary.trim()).not.toBe('')
      })

      it('fills the per-page meta description', () => {
        // The article page sets <meta name="description"> from this key
        // (usePageMeta), so a blank value would ship an empty tag.
        const description = translation.meta.articlesMovingChecklistDescription
        expect(description.trim()).not.toBe('')
        expect(description).not.toContain('\u2014')
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          content.intro,
          content.documentsLead,
          content.timing,
          content.disclaimer,
          content.backToArticles,
          translation.articles.movingChecklist.title,
          translation.articles.movingChecklist.summary,
          translation.articles.movingChecklist.cta,
          ...SECTION_KEYS.flatMap((key) => [
            content.sections[key].title,
            ...content.sections[key].items,
          ]),
          content.sections.meters.callout,
        ]
        for (const value of strings) expect(value).not.toContain('\u2014')
      })
    })
  }
})
