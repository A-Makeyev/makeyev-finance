import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'
import { PRESETS, PRESET_IDS } from '../../src/lib/amortization'

/** The prepayment rule-of-thumb facts, in reading order. */
const PREPAY_FACT_KEYS = ['rateFirst', 'penalty'] as const

/**
 * Track-count wording per language, as the article copy phrases it. basket3's
 * three tracks are equal thirds while basket4's three tracks are unequal, so
 * the count phrase is keyed per preset rather than per number.
 */
const TRACK_COUNT_WORDS: Record<string, Record<string, RegExp>> = {
  he: {
    basket1: /מסלול אחד/,
    basket2: /שני מסלולים/,
    basket3: /שלושה מסלולים שווים/,
    basket4: /שלושה מסלולים/,
  },
  en: {
    basket1: /A single/,
    basket2: /Two tracks/,
    basket3: /Three equal tracks/,
    basket4: /three tracks/,
  },
}

/** Percent text for a preset share, as the article copy quotes it per language. */
function sharePercentText(share: number, language: string): string {
  const percent = Math.round(share * 100)
  if (Number.isInteger(share * 100)) return String(percent)
  // A third is not an integer percent: Hebrew writes "כ-33%", English "about 33%".
  return language === 'he' ? `כ-${percent}` : `about ${percent}`
}

/**
 * The mortgage-decisions article explains the calculator's own preset mixes.
 * The i18n parity test guarantees both languages define the same keys; these
 * tests guard that the article's per-preset descriptions still agree with
 * `lib/amortization.ts`'s PRESETS definitions - shares, track types and the
 * count of tracks - so the article can never describe a mix differently than
 * the code implements it. The Hebrew copy quotes shares as "100%", "50%" or
 * "כ-33%", and the English copy as "100%", "50%" or "about 33%"; the shared
 * structural checks below (per-track type words and the track count) hold in
 * both languages, and the language-specific wording checks are per language.
 */
describe('mortgage decisions article content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    describe(language, () => {
      const content = translation.education.mortgageDecisions

      it('states every preset in the calculator with a title and a text', () => {
        for (const presetId of PRESET_IDS) {
          expect(content.presets.blocks[presetId].title.trim(), presetId).not.toBe('')
          expect(content.presets.blocks[presetId].text.trim(), presetId).not.toBe('')
        }
      })

      it('mentions every track type each preset actually contains', () => {
        // The article must name every track type that makes up the mix, using
        // the same family word the calculator's own selector uses (פריים /
        // קבועה / משתנה in Hebrew, prime / fixed / variable in English), so a
        // reader is never told a mix contains something it does not.
        for (const presetId of PRESET_IDS) {
          const text = content.presets.blocks[presetId].text
          const types = [...new Set(PRESETS[presetId].map((definition) => definition.type))]
          for (const type of types) {
            const word =
              language === 'he'
                ? {
                    prime: 'פריים',
                    fixed: 'קבועה',
                    variable5y: 'משתנה',
                    variable: 'משתנה',
                    fixedIndexed: 'קבועה',
                    variableIndexed5y: 'משתנה',
                    variableIndexed: 'משתנה',
                  }[type]
                : {
                    prime: 'prime',
                    fixed: 'fixed',
                    variable5y: 'variable',
                    variable: 'variable',
                    fixedIndexed: 'fixed',
                    variableIndexed5y: 'variable',
                    variableIndexed: 'variable',
                  }[type]
            expect(text, `${presetId} should mention ${type}`).toContain(word)
          }
        }
      })

      it('describes the same number of tracks each preset allocates', () => {
        for (const presetId of PRESET_IDS) {
          const text = content.presets.blocks[presetId].text
          expect(text, `${presetId} track-count wording`).toMatch(
            TRACK_COUNT_WORDS[language][presetId],
          )
        }
      })

      it('quotes the preset shares in percent', () => {
        // Every share appears in the text as a percent figure, so a changed
        // PRESETS entry (say basket4's 0.34) forces the copy to be revisited.
        for (const presetId of PRESET_IDS) {
          const text = content.presets.blocks[presetId].text
          for (const share of PRESETS[presetId].map((definition) => definition.share)) {
            const percentText = sharePercentText(share, language)
            expect(text, `${presetId} share ${percentText}%`).toContain(percentText)
          }
        }
      })

      it('fills the intro, sections, disclaimer and back link', () => {
        for (const [name, value] of [
          ['intro', content.intro],
          ['presets.title', content.presets.title],
          ['presets.lead', content.presets.lead],
          ['presets.tryLabel', content.presets.tryLabel],
          ['prepay.title', content.prepay.title],
          ['prepay.lead', content.prepay.lead],
          ['prepay.ruleNote', content.prepay.ruleNote],
          ['prepay.prepaymentLink', content.prepay.prepaymentLink],
          ['methods.title', content.methods.title],
          ['methods.framing', content.methods.framing],
          ['methods.spitzer', content.methods.spitzer],
          ['methods.equalPrincipal', content.methods.equalPrincipal],
          ['methods.availability', content.methods.availability],
          ['methods.calculatorNote', content.methods.calculatorNote],
          ['methods.trackTypesLink', content.methods.trackTypesLink],
          ['disclaimer', content.disclaimer],
          ['backToArticles', content.backToArticles],
        ] as const) {
          expect(value.trim(), name).not.toBe('')
        }
      })

      it('states the prepayment rule-of-thumb facts', () => {
        for (const key of PREPAY_FACT_KEYS) {
          expect(content.prepay.facts[key].title.trim(), key).not.toBe('')
          expect(content.prepay.facts[key].text.trim(), key).not.toBe('')
        }
      })

      it('frames equal principal as mainly Leumi and Mizrahi-Tefahot', () => {
        // The availability caveat is a researched fact, not filler: the copy
        // must name the banks associated with offering it and tell the reader
        // to confirm with their own bank, rather than presenting the method as
        // routinely available everywhere.
        const expected =
          language === 'he'
            ? ['לאומי', 'מזרחי-טפחות', 'לוודא']
            : ['Leumi', 'Mizrahi-Tefahot', 'confirm']
        for (const fragment of expected) {
          expect(content.methods.availability, fragment).toContain(fragment)
        }
      })

      it('frames the amortization choice as a whole-loan decision', () => {
        // Topic 3's corrected framing: the schedule belongs to the loan as a
        // whole, not to individual tracks.
        expect(content.methods.title, 'borrower-level title').toMatch(
          language === 'he' ? /הלווה/ : /borrower/i,
        )
        expect(content.methods.framing, 'whole-loan framing').toMatch(
          language === 'he' ? /כולה/ : /whole loan/,
        )
      })

      it('fills the article card title, summary and cta on the articles list', () => {
        expect(translation.articles.mortgageDecisions.title.trim()).not.toBe('')
        expect(translation.articles.mortgageDecisions.summary.trim()).not.toBe('')
        expect(translation.articles.mortgageDecisions.cta.trim()).not.toBe('')
      })

      it('fills the per-page meta description', () => {
        const description = translation.meta.articlesMortgageDecisionsDescription
        expect(description.trim()).not.toBe('')
        expect(description).not.toContain('\\u2014')
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          content.intro,
          content.presets.title,
          content.presets.lead,
          content.presets.tryLabel,
          ...PRESET_IDS.flatMap((presetId) => [
            content.presets.blocks[presetId].title,
            content.presets.blocks[presetId].text,
          ]),
          content.prepay.title,
          content.prepay.lead,
          ...PREPAY_FACT_KEYS.flatMap((key) => [
            content.prepay.facts[key].title,
            content.prepay.facts[key].text,
          ]),
          content.prepay.ruleNote,
          content.prepay.prepaymentLink,
          content.methods.title,
          content.methods.framing,
          content.methods.spitzer,
          content.methods.equalPrincipal,
          content.methods.availability,
          content.methods.calculatorNote,
          content.methods.trackTypesLink,
          content.disclaimer,
          content.backToArticles,
          translation.articles.mortgageDecisions.title,
          translation.articles.mortgageDecisions.summary,
          translation.articles.mortgageDecisions.cta,
        ]
        for (const value of strings) expect(value).not.toContain('\\u2014')
      })
    })
  }
})
