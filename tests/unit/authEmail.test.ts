import { describe, expect, it } from 'vitest'
import {
  buildDeleteCodeEmail,
  buildOtpEmail,
  buildVerificationEmail,
  emailLanguageForRequest,
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

describe('emailLanguageForRequest', () => {
  const requestWith = (headers: Record<string, string>) =>
    new Request('https://app.test/api/auth/delete-user', { headers })

  it('follows the locale of the page the request came from', () => {
    // The page path is the strongest signal: the Hebrew site is unprefixed and
    // English lives under /en, so a Hebrew user gets Hebrew mail even when the
    // browser itself is English.
    expect(emailLanguageForRequest(requestWith({ referer: 'https://app.test/profile' }))).toBe(
      'hebrew',
    )
    expect(
      emailLanguageForRequest(requestWith({ referer: 'https://app.test/en/profile?delete=tok' })),
    ).toBe('english')
    expect(emailLanguageForRequest(requestWith({ referer: 'https://app.test/en' }))).toBe('english')
    expect(
      emailLanguageForRequest(requestWith({ referer: 'https://app.test/login?next=%2Fprofile' })),
    ).toBe('hebrew')
  })

  it('prefers the page over the browser language', () => {
    // The bug this fixes: an English browser on the Hebrew site got English
    // mail and an English account-deletion link.
    expect(
      emailLanguageForRequest(
        requestWith({ referer: 'https://app.test/profile', 'accept-language': 'en-US,en;q=0.9' }),
      ),
    ).toBe('hebrew')
  })

  it('falls back to Accept-Language when there is no referrer', () => {
    expect(
      emailLanguageForRequest(requestWith({ 'accept-language': 'en-US,en;q=0.9' })),
    ).toBe('english')
    expect(emailLanguageForRequest(requestWith({ 'accept-language': 'he-IL' }))).toBe('hebrew')
  })

  it('defaults to Hebrew for a missing, empty or malformed request', () => {
    expect(emailLanguageForRequest(undefined)).toBe('hebrew')
    expect(emailLanguageForRequest(requestWith({ referer: 'not a url' }))).toBe('hebrew')
    expect(emailLanguageForRequest(requestWith({}))).toBe('hebrew')
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

  it('carries the direction on the wrapper, not only on <html>', () => {
    // Clients that ignore <html dir> render the message from the table, which
    // is why a Hebrew mail showed up left-aligned (user-reported). Direction
    // and alignment are repeated on the body, the table and the content cell.
    const hebrew = buildVerificationEmail('hebrew', url, 'Dana').html
    expect(hebrew).toContain('<body dir="rtl"')
    expect(hebrew).toContain('<table role="presentation" width="100%" dir="rtl"')
    expect(hebrew).toContain('<td dir="rtl"')
    expect(hebrew).toContain('text-align:right')
    expect(hebrew).not.toContain('text-align:start')

    const english = buildVerificationEmail('english', url, 'Dana').html
    expect(english).toContain('<body dir="ltr"')
    expect(english).toContain('<table role="presentation" width="100%" dir="ltr"')
    expect(english).toContain('<td dir="ltr"')
    expect(english).toContain('text-align:left')
    expect(english).not.toContain('text-align:right')
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

describe('buildDeleteCodeEmail', () => {
  it('renders Hebrew RTL with the Hebrew deletion copy', () => {
    const email = buildDeleteCodeEmail('hebrew', 'AB12CD')
    expect(email.subject).toBe(he.translation.auth.emails.deleteSubject)
    expect(email.html).toContain('dir="rtl"')
    expect(email.html).toContain('lang="he"')
    expect(email.html).toContain(he.translation.auth.emails.deleteHeading)
    expect(email.html).toContain('AB12CD')
    expect(email.text).toContain('AB12CD')
  })

  it('renders English LTR with the English deletion copy', () => {
    const email = buildDeleteCodeEmail('english', 'AB12CD')
    expect(email.subject).toBe(en.translation.auth.emails.deleteSubject)
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain(en.translation.auth.emails.deleteHeading)
    expect(email.html).toContain('AB12CD')
  })

  it('isolates the code as LTR inside an RTL message', () => {
    // Six letters and digits in an RTL body can render reversed; the code span
    // carries its own dir="ltr" so the user reads what was generated.
    const email = buildDeleteCodeEmail('hebrew', 'AB12CD')
    expect(email.html).toContain('dir="ltr"')
  })

  it('carries the direction on the wrapper, not only on <html>', () => {
    const hebrew = buildDeleteCodeEmail('hebrew', 'AB12CD').html
    expect(hebrew).toContain('<body dir="rtl"')
    expect(hebrew).toContain('<table role="presentation" width="100%" dir="rtl"')
    expect(hebrew).toContain('<td dir="rtl"')
    expect(hebrew).toContain('text-align:right')
    expect(hebrew).not.toContain('text-align:start')

    const english = buildDeleteCodeEmail('english', 'AB12CD').html
    expect(english).toContain('<body dir="ltr"')
    expect(english).toContain('<table role="presentation" width="100%" dir="ltr"')
    expect(english).toContain('<td dir="ltr"')
    expect(english).toContain('text-align:left')
  })

  it('carries no link: the code is typed into the profile modal', () => {
    // Nothing to click means nothing can delete on a GET, which is also what
    // makes the mail immune to link-scanning prefetch.
    const email = buildDeleteCodeEmail('english', 'AB12CD')
    expect(email.html).not.toContain('href=')
    expect(email.text).not.toMatch(/https?:\/\//)
  })

  it('says the account is not deleted by asking, only by the code', () => {
    // The request mails a code; the words in the mail are the last chance to
    // stop an irreversible action, so the ignore line must be present.
    for (const language of ['hebrew', 'english'] as const) {
      const copy = language === 'hebrew' ? he.translation.auth.emails : en.translation.auth.emails
      expect(buildDeleteCodeEmail(language, 'AB12CD').html).toContain(copy.deleteIgnore)
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

  it('aligns the code explicitly per language, and repeats the direction on the wrapper', () => {
    // right/left rather than `start`: `start` only means anything once the
    // direction is honoured, and clients that ignore <html dir> render from
    // the table.
    const hebrew = buildOtpEmail('hebrew', '1234').html
    expect(hebrew).toContain('<table role="presentation" width="100%" dir="rtl"')
    expect(hebrew).toContain('<td dir="rtl"')
    expect(hebrew).toContain('text-align:right')
    expect(hebrew).not.toContain('text-align:start')

    expect(buildOtpEmail('english', '9876').html).toContain('text-align:left')
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
