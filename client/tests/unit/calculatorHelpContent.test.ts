import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

/** The calculator's inline "?" help tooltips, each as an aria/body pair. */
const HELP_KEYS = ['trackType', 'method', 'term', 'preset'] as const

/**
 * The calculator's help tooltips are new interactive UI, so their strings
 * get the same content guards as the articles: every tooltip needs an
 * aria-label and a 1-3 sentence body in every language, and the shared
 * "read more" link text must exist. (Key parity across languages is already
 * enforced by the i18n parity test.)
 */
describe('calculator help tooltip content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    describe(language, () => {
      const help = translation.calculator.help

      it('defines an aria-label and a body for every tooltip', () => {
        for (const key of HELP_KEYS) {
          expect(help[`${key}Aria`].trim(), `${key}Aria`).not.toBe('')
          expect(help[key].trim(), key).not.toBe('')
        }
        expect(help.readMore.trim(), 'readMore').not.toBe('')
      })

      it('keeps every tooltip short - a summary, not the article', () => {
        // A tooltip that carries the full article defeats the purpose; the
        // bodies must stay within roughly three sentences.
        for (const key of HELP_KEYS) {
          const sentences = help[key].split(/[.!?]\\s/).filter((part) => part.trim() !== '')
          expect(sentences.length, key).toBeLessThanOrEqual(3)
        }
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          help.readMore,
          ...HELP_KEYS.flatMap((key) => [help[`${key}Aria`], help[key]]),
        ]
        for (const value of strings) expect(value).not.toContain('\\u2014')
      })
    })
  }
})
