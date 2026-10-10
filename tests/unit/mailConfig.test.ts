import { afterEach, describe, expect, it, vi } from 'vitest'
import { SITE } from '@/config/siteConfig'
import {
  DEFAULT_AUTH_EMAIL_FROM,
  DEFAULT_CONTACT_TO_EMAIL,
  canSendMail,
  contactRecipient,
  getMailConfig,
  parseFromAddress,
  parseMailConfig,
  senderAddress,
} from '@/server/mail/config'

describe('parseMailConfig', () => {
  it('defaults the sender and keeps the secrets optional, so next build works without any', () => {
    expect(parseMailConfig({})).toEqual({ AUTH_EMAIL_FROM: DEFAULT_AUTH_EMAIL_FROM })
  })

  it('defaults to Resend test sender, which needs no verified domain', () => {
    expect(DEFAULT_AUTH_EMAIL_FROM).toBe('Makeyev Finance <onboarding@resend.dev>')
  })

  it('reads the values it is given', () => {
    const config = parseMailConfig({
      RESEND_API_KEY: 're_key',
      AUTH_EMAIL_FROM: 'Makeyev Finance <from@example.test>',
      CONTACT_TO_EMAIL: 'inbox@example.test',
    })
    expect(config.RESEND_API_KEY).toBe('re_key')
    // An explicitly configured sender always wins over the default.
    expect(config.AUTH_EMAIL_FROM).toBe('Makeyev Finance <from@example.test>')
    expect(config.CONTACT_TO_EMAIL).toBe('inbox@example.test')
  })

  it('rejects an explicitly empty API key', () => {
    expect(() => parseMailConfig({ RESEND_API_KEY: '' })).toThrow(/RESEND_API_KEY/)
  })
})

describe('getMailConfig', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('treats blank and whitespace-only values as unset', () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('AUTH_EMAIL_FROM', '   ')
    vi.stubEnv('CONTACT_TO_EMAIL', '')

    // A blank sender is "not configured", so the test-sender default applies
    // rather than an empty From header.
    expect(getMailConfig()).toEqual({ AUTH_EMAIL_FROM: DEFAULT_AUTH_EMAIL_FROM })
  })
})

describe('parseFromAddress', () => {
  it('parses Name <email>', () => {
    expect(parseFromAddress('Makeyev Finance <from@example.test>')).toEqual({
      name: 'Makeyev Finance',
      email: 'from@example.test',
    })
  })

  it('uses the default display name for a bare address', () => {
    expect(parseFromAddress('from@example.test')).toEqual({
      name: 'Makeyev Finance',
      email: 'from@example.test',
    })
  })

  it('strips quotes around the display name', () => {
    expect(parseFromAddress('"Makeyev Finance" <from@example.test>').name).toBe('Makeyev Finance')
  })

  it('trims surrounding whitespace', () => {
    expect(parseFromAddress('  from@example.test  ').email).toBe('from@example.test')
  })
})

describe('canSendMail', () => {
  it('is false without an API key, whatever the sender says', () => {
    expect(canSendMail(parseMailConfig({}))).toBe(false)
    expect(canSendMail(parseMailConfig({ AUTH_EMAIL_FROM: 'from@example.test' }))).toBe(false)
  })

  it('is true with an API key alone, because the sender is defaulted', () => {
    expect(canSendMail(parseMailConfig({ RESEND_API_KEY: 're_key' }))).toBe(true)
    expect(
      canSendMail(parseMailConfig({ RESEND_API_KEY: 're_key', AUTH_EMAIL_FROM: 'from@example.test' })),
    ).toBe(true)
  })
})

describe('senderAddress / contactRecipient', () => {
  it('resolves the test sender when AUTH_EMAIL_FROM is unset', () => {
    expect(senderAddress(parseMailConfig({}))).toEqual({
      name: 'Makeyev Finance',
      email: 'onboarding@resend.dev',
    })
  })

  it('prefers CONTACT_TO_EMAIL over the sender', () => {
    const config = parseMailConfig({
      AUTH_EMAIL_FROM: 'from@example.test',
      CONTACT_TO_EMAIL: 'inbox@example.test',
    })
    expect(contactRecipient(config)).toBe('inbox@example.test')
  })

  it("falls back to the site's own published inbox for a key-only setup", () => {
    // Never the sender: with the test sender that would address the mail to
    // onboarding@resend.dev, which cannot receive anything.
    expect(contactRecipient(parseMailConfig({ RESEND_API_KEY: 're_key' }))).toBe(
      DEFAULT_CONTACT_TO_EMAIL,
    )
    expect(DEFAULT_CONTACT_TO_EMAIL).toBe(SITE.emailMain)
  })
})
