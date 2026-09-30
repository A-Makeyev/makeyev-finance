import { describe, expect, it } from 'vitest'
import { canSendAuthEmail, parseAuthConfig } from '@/server/auth/config'

describe('parseAuthConfig', () => {
  it('applies the default From address and keeps secrets optional (so next build works)', () => {
    const config = parseAuthConfig({})
    expect(config.AUTH_EMAIL_FROM).toBe('Makeyev Finance <onboarding@resend.dev>')
    expect(config.MONGODB_URI).toBeUndefined()
    expect(config.RESEND_API_KEY).toBeUndefined()
    expect(config.BETTER_AUTH_SECRET).toBeUndefined()
    expect(config.BETTER_AUTH_URL).toBeUndefined()
  })

  it('reads the values it is given', () => {
    const config = parseAuthConfig({
      MONGODB_URI: 'mongodb://localhost:27017/makeyev',
      RESEND_API_KEY: 're_test_key',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'https://example.com',
    })
    expect(config.MONGODB_URI).toBe('mongodb://localhost:27017/makeyev')
    expect(config.RESEND_API_KEY).toBe('re_test_key')
    expect(config.BETTER_AUTH_URL).toBe('https://example.com')
  })

  it('rejects a secret shorter than 32 characters', () => {
    expect(() => parseAuthConfig({ BETTER_AUTH_SECRET: 'too-short' })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('rejects an explicitly empty MONGODB_URI', () => {
    expect(() => parseAuthConfig({ MONGODB_URI: '' })).toThrow(/MONGODB_URI/)
  })

  it('rejects a malformed BETTER_AUTH_URL', () => {
    expect(() => parseAuthConfig({ BETTER_AUTH_URL: 'not-a-url' })).toThrow(/BETTER_AUTH_URL/)
  })
})

describe('canSendAuthEmail', () => {
  it('reflects the presence of the Resend key', () => {
    expect(canSendAuthEmail(parseAuthConfig({}))).toBe(false)
    expect(canSendAuthEmail(parseAuthConfig({ RESEND_API_KEY: 're_test_key' }))).toBe(true)
  })
})
