/**
 * Translation-key parity between the language files.
 *
 * AGENTS.md treats a missing key as a missing test: it renders as the raw key
 * string, so a new feature can look shipped in one language and broken in the
 * other. These two tests fail the build in that case, and they check EVERY key
 * rather than only the ones a given change happens to touch.
 */
import { describe, expect, it } from 'vitest'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'

/** Every leaf key of a dictionary, as dotted paths. */
function flatten(o: unknown, prefix = ''): string[] {
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

const heKeys = new Set(flatten(he.translation))
const enKeys = new Set(flatten(en.translation))

describe('translation key parity', () => {
  it('has no key present in Hebrew and missing in English', () => {
    expect([...heKeys].filter((k) => !enKeys.has(k))).toEqual([])
  })

  it('has no key present in English and missing in Hebrew', () => {
    expect([...enKeys].filter((k) => !heKeys.has(k))).toEqual([])
  })

  it('carries real copy for the password-reset resend action', () => {
    expect(he.translation.auth.resetResend).toBe('שליחת קוד חדש')
    expect(en.translation.auth.resetResend).toBe('Send a new code')
    expect(he.translation.auth.resetResendSent).toBe('שלחנו קוד חדש. הקוד הקודם אינו תקף יותר')
    expect(en.translation.auth.resetResendSent).toBe(
      'We sent a new code. The previous one is no longer valid',
    )
    // The auth card's lines carry no trailing period (user preference): a
    // full stop sneaking back in fails here rather than on the page. The
    // exception is the in-flight label, whose trailing dots are an ELLIPSIS
    // ("שולח..." / "Sending..."), the loading convention, not a sentence stop.
    for (const translation of [he.translation, en.translation]) {
      const language = he.translation.auth === translation.auth ? 'he' : 'en'
      for (const [key, value] of Object.entries(translation.auth)) {
        if (typeof value === 'string' && key !== 'emails') {
          expect(
            value.endsWith('.') && !value.endsWith('...'),
            `auth.${key} in ${language}`,
          ).toBe(false)
        }
      }
    }
  })

  it('carries the re-send cooldown and ceiling copy, with its placeholder', () => {
    // The countdown interpolates the remaining seconds in both languages; a
    // missing placeholder would render the raw "{{seconds}}" next to a
    // disabled button.
    expect(he.translation.auth.resetResendIn).toContain('{{seconds}}')
    expect(en.translation.auth.resetResendIn).toContain('{{seconds}}')
    // The ceiling message has to name the way out, not just refuse.
    expect(he.translation.auth.resetResendExhausted).toContain('3')
    expect(en.translation.auth.resetResendExhausted).toMatch(/sign-in/i)
  })
})