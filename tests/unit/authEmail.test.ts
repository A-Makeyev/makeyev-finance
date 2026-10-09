import { describe, expect, it } from 'vitest'
import {
  buildDeleteAccountEmail,
  buildOtpEmail,
  buildVerificationEmail,
  deleteConfirmationUrl,
  pickEmailLanguage,
} from '@/server/auth/email'
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

  it('renders the CTA as a full-width, centered block', () => {
    // The one action in the mail spans the card with its label centered
    // (user-requested), in both languages. border-box keeps the padding inside
    // 100%, so the button never overflows the card.
    for (const language of ['hebrew', 'english'] as const) {
      const { html } = buildVerificationEmail(language, url, 'Dana')
      const anchor = html.slice(html.indexOf('<a href'))
      expect(anchor, language).toContain('display:block')
      expect(anchor, language).toContain('width:100%')
      expect(anchor, language).toContain('box-sizing:border-box')
      expect(anchor, language).toContain('text-align:center')
    }
  })
})

describe('buildDeleteAccountEmail', () => {
  const url = 'https://example.com/api/auth/delete-user/callback?token=abc&callbackURL=%2F'

  it('renders Hebrew RTL with the Hebrew deletion copy', () => {
    const email = buildDeleteAccountEmail('hebrew', url, 'Dana')
    expect(email.subject).toBe(he.translation.auth.emails.deleteSubject)
    expect(email.html).toContain('dir="rtl"')
    expect(email.html).toContain(he.translation.auth.emails.deleteHeading)
    expect(email.text).toContain(url)
  })

  it('renders English LTR with the English deletion copy', () => {
    const email = buildDeleteAccountEmail('english', url, 'Dana')
    expect(email.subject).toBe(en.translation.auth.emails.deleteSubject)
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain(en.translation.auth.emails.deleteCta)
  })

  it('shares the verification template, so direction and escaping cannot drift', () => {
    const deletion = buildDeleteAccountEmail('english', 'https://x.test/?a=1&b=2', 'Dana')
    expect(deletion.html).not.toContain('?a=1&b=2')
    expect(deletion.html).toContain('?a=1&amp;b=2')
    for (const language of ['hebrew', 'english'] as const) {
      const anchor = buildDeleteAccountEmail(language, url, 'Dana').html.slice(
        buildDeleteAccountEmail(language, url, 'Dana').html.indexOf('<a href'),
      )
      expect(anchor, language).toContain('display:block')
      expect(anchor, language).toContain('box-sizing:border-box')
      expect(anchor, language).toContain('text-align:center')
    }
  })

  it('says the account is not deleted by asking, only by the link', () => {
    // The request mails a link; the words in the mail are the last chance to
    // stop an irreversible action, so the ignore line must be present.
    for (const language of ['hebrew', 'english'] as const) {
      const copy = language === 'hebrew' ? he.translation.auth.emails : en.translation.auth.emails
      expect(buildDeleteAccountEmail(language, url, null).html).toContain(copy.deleteIgnore)
    }
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

describe('deleteConfirmationUrl', () => {
  it('lands on the profile page of the mail\'s own language, with the token', () => {
    expect(deleteConfirmationUrl('hebrew', 'https://app.test', 'tok123')).toBe(
      'https://app.test/profile?delete=tok123',
    )
    expect(deleteConfirmationUrl('english', 'https://app.test', 'tok123')).toBe(
      'https://app.test/en/profile?delete=tok123',
    )
  })

  it('tolerates a trailing slash on the origin and encodes the token', () => {
    expect(deleteConfirmationUrl('hebrew', 'https://app.test/', 'a b/c')).toBe(
      'https://app.test/profile?delete=a%20b%2Fc',
    )
  })

  it('is the link the deletion mail carries, not Better Auth\'s callback endpoint', () => {
    // The callback endpoint deletes on GET; the product wants opening the link
    // to land on the profile, where the last step is a button.
    const { html, text } = buildDeleteAccountEmail(
      'hebrew',
      deleteConfirmationUrl('hebrew', 'https://app.test', 'tok123'),
      'Dana',
    )
    expect(html).toContain('https://app.test/profile?delete=tok123')
    expect(html).not.toContain('/api/auth/delete-user/callback')
    expect(text).toContain('https://app.test/profile?delete=tok123')
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
