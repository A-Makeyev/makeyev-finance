import { describe, expect, it } from 'vitest'
import { he } from '../../src/i18n/he'
import { en } from '../../src/i18n/en'

/**
 * The hero scroll cue's strings. The parity suite guarantees both locales
 * define the same keys; these tests guard that the values are usable - a
 * present-but-empty string would render an unlabeled icon-only button,
 * which fails the accessibility bar.
 */
describe('hero scroll cue content', () => {
  for (const [language, translation] of [
    ['he', he.translation],
    ['en', en.translation],
  ] as const) {
    it(`${language}: the icon-only button has a non-empty accessible label`, () => {
      expect(translation.heroScrollCue.aria.trim()).not.toBe('')
    })
  }
})
