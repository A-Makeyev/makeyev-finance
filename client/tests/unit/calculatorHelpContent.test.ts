import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'
import { TRACK_TYPES } from '../../src/lib/amortization'

/**
 * The calculator's inline "?" help tooltips: one body per track type (the
 * tip switches with the selected type) plus the shared method/term/preset
 * tips, each as an aria/body pair.
 */
const HELP_KEYS = ['method', 'term', 'preset'] as const
const TYPE_BODIES = TRACK_TYPES

/**
 * The calculator's help tooltips are new interactive UI, so their strings
 * get the same content guards as the articles: every tooltip needs an
 * aria-label and a body in every language, and the shared "read more" link
 * text must exist. (Key parity across languages is already enforced by the
 * i18n parity test.)
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
        expect(help.trackTypeAria.trim(), 'trackTypeAria').not.toBe('')
        for (const type of TYPE_BODIES) {
          expect(help.trackTypes[type].trim(), `trackTypes.${type}`).not.toBe('')
        }
      })

      it('covers each of the 7 track types the select offers', () => {
        expect(TYPE_BODIES.length).toBe(7)
        for (const type of TYPE_BODIES) {
          expect(Object.keys(help.trackTypes), `trackTypes.${type}`).toContain(type)
        }
      })

      it('opens each track-type body with the select label itself', () => {
        // The tooltip sits on the type select's label row, so the body must
        // read "<name> ..." - the same string the select shows - rather than
        // force the reader to match a nameless tip back to the select.
        for (const type of TYPE_BODIES) {
          const label = translation.calculator.trackTypes[type]
          expect(help.trackTypes[type].startsWith(label), `trackTypes.${type}`).toBe(true)
        }
      })

      it('keeps every tooltip short - a summary, not the article', () => {
        // A tooltip that carries the full article defeats the purpose; the
        // bodies must stay within roughly three sentences.
        for (const key of HELP_KEYS) {
          const sentences = help[key].split(/[.!?]\s/).filter((part) => part.trim() !== '')
          expect(sentences.length, key).toBeLessThanOrEqual(3)
        }
        for (const type of TYPE_BODIES) {
          const sentences = help.trackTypes[type].split(/[.!?]\s/).filter((p) => p.trim() !== '')
          expect(sentences.length, `trackTypes.${type}`).toBeLessThanOrEqual(3)
        }
      })

      it('uses no em dash in any of its strings', () => {
        const strings = [
          help.readMore,
          help.trackTypeAria,
          ...HELP_KEYS.flatMap((key) => [help[`${key}Aria`], help[key]]),
          ...TYPE_BODIES.map((type) => help.trackTypes[type]),
        ]
        for (const value of strings) expect(value).not.toContain('\u2014')
      })
    })
  }
})
