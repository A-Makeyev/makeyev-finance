import { describe, expect, it } from 'vitest'
import { buildOtpEmail, buildVerificationEmail, pickEmailLanguage } from '@/server/auth/email'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'

describe('pickEmailLanguage', () => {
  it('picks English from an English Accept-Language header', () => {
    expect(pickEmailLanguage('en-US,en;q=0.9')).toBe('english')
    expect(pickEmailLanguage('EN-GB')).toBe('english')
    expect(pickEmailLanguage('en')).toBe('english')
  })

  it('defaults to Hebrew for Hebrew, unknown and missing headers', () => {
    expect(pickEmailLanguage('he-IL,he;q=0.9')).toBe('hebrew')
    expect(pickEmailLanguage('fr-FR,fr;q=0.8')).toBe('hebrew')
    expect(pickEmailLanguage('')).toBe('hebrew')
    expect(pickEmailLanguage(null)).toBe('hebrew')
    expect(pickEmailLanguage(undefined)).toBe('hebrew')
  })
})

describe('buildVerificationEmail', () => {
  const url = 'https://example.com/api/auth/verify-email?token=abc&callbackURL=%2F'

  it('renders Hebrew RTL with the Hebrew subject', () => {
    const email = buildVerificationEmail('hebrew', url, 'Dana')
    expect(email.subject).toBe(he.translation.auth.emails.subject)
    expect(email.html).toContain('dir="rtl"')
    expect(email.html).toContain('lang="he"')
    expect(email.text).toContain(url)
  })

  it('renders English LTR with the English subject', () => {
    const email = buildVerificationEmail('english', url, 'Dana')
    expect(email.subject).toBe(en.translation.auth.emails.subject)
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain('lang="en"')
  })

  it('escapes the URL interpolated into the HTML', () => {
    const email = buildVerificationEmail('english', 'https://x.test/?a=1&b=2', null)
    expect(email.html).not.toContain('?a=1&b=2')
    expect(email.html).toContain('?a=1&amp;b=2')
  })

  it('uses the generic greeting when no name is known', () => {
    const email = buildVerificationEmail('english', url, null)
    expect(email.html).toContain(en.translation.auth.emails.greetingGeneric)
  })
})

describe('buildOtpEmail', () => {
  it('renders the Hebrew RTL code email with the Hebrew subject', () => {
    const email = buildOtpEmail('hebrew', '1234')
    expect(email.subject).toBe(he.translation.auth.emails.otpSubject)
    expect(email.html).toContain('dir="rtl"')
    expect(email.html).toContain('lang="he"')
    expect(email.html).toContain('1234')
    expect(email.text).toContain('1234')
  })

  it('renders the English LTR code email with the English subject', () => {
    const email = buildOtpEmail('english', '9876')
    expect(email.subject).toBe(en.translation.auth.emails.otpSubject)
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain('lang="en"')
    expect(email.html).toContain('9876')
  })

  it('isolates the code as LTR inside an RTL message', () => {
    // Four bare digits in an RTL body can render reversed; the code span
    // carries its own dir="ltr" so the user reads what was generated.
    const email = buildOtpEmail('hebrew', '1234')
    expect(email.html).toContain('dir="ltr"')
  })

  it('colours the digits without a filled background behind them', () => {
    const email = buildOtpEmail('hebrew', '1234')
    expect(email.html).toContain('color:#0f5c4b')
    // The old treatment was white on a green block; the digits are the accent
    // now, so a background would double the emphasis and hide the underline
    // clients may add.
    expect(email.html).not.toContain('background:#0f5c4b')
    expect(email.html).not.toContain('color:#ffffff')
  })

  it('sets the code on the start edge, so it flips with the language', () => {
    // start, not right/left: the same template serves both locales.
    expect(buildOtpEmail('hebrew', '1234').html).toContain('text-align:start')
    expect(buildOtpEmail('english', '1234').html).toContain('text-align:start')
  })

  it('carries no link: the code is typed into the form the user came from', () => {
    const email = buildOtpEmail('english', '9876')
    expect(email.html).not.toContain('href=')
  })

  it('leaves the code out of neither the HTML nor the text alternative', () => {
    for (const language of ['hebrew', 'english'] as const) {
      const email = buildOtpEmail(language, '4567')
      expect(email.html, language).toContain('4567')
      expect(email.text, language).toContain('4567')
    }
  })
})

describe('auth i18n keys', () => {
  it('exposes the same auth keys in both languages', () => {
    expect(Object.keys(he.translation.auth).sort()).toEqual(Object.keys(en.translation.auth).sort())
  })

  it('exposes the same email keys in both languages', () => {
    expect(Object.keys(he.translation.auth.emails).sort()).toEqual(
      Object.keys(en.translation.auth.emails).sort(),
    )
  })

  it('leaves no auth string blank in either language', () => {
    const flatten = (value: Record<string, unknown>, prefix = ''): [string, unknown][] =>
      Object.entries(value).flatMap(([key, nested]) =>
        nested && typeof nested === 'object'
          ? flatten(nested as Record<string, unknown>, `${prefix}${key}.`)
          : [[`${prefix}${key}`, nested]],
      )

    for (const [key, value] of flatten(he.translation.auth)) {
      expect(value, `he.translation.auth.${key}`).toBeTruthy()
    }
    for (const [key, value] of flatten(en.translation.auth)) {
      expect(value, `en.translation.auth.${key}`).toBeTruthy()
    }
  })
})
