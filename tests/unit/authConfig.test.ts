import { describe, expect, it } from 'vitest'
import { buildBaseURLConfig, canSendAuthEmail, parseAuthConfig } from '@/server/auth/config'

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

describe('buildBaseURLConfig', () => {
  it('accepts loopback on any port when no public origin is configured', () => {
    // Zero env config locally: dev (3000) and e2e (3100) differ only by port.
    const config = buildBaseURLConfig(undefined)
    expect(config.allowedHosts).toEqual(['localhost:*', '127.0.0.1:*', '[::1]:*'])
    expect(config).not.toHaveProperty('fallback')
  })

  it("adds the deployment's own host and falls back to its origin", () => {
    const config = buildBaseURLConfig('https://makeyev-finance.onrender.com')
    expect(config.allowedHosts).toContain('makeyev-finance.onrender.com')
    // Still accepts localhost, so one build serves both dev and prod.
    expect(config.allowedHosts).toContain('localhost:*')
    // An unrecognised Host resolves to our origin instead of throwing, and
    // never to the host in the request.    expect(config.fallback).toBe('https://makeyev-finance.onrender.com')
  })

  it('keeps the port when the configured origin has one', () => {
    // The allowlist matches the full `host:port`, so dropping the port would
    // reject a legitimate origin.
    const config = buildBaseURLConfig('http://localhost:8080')
    expect(config.allowedHosts).toContain('localhost:8080')
  })
})

describe('canSendAuthEmail', () => {
  it('reflects the presence of the Resend key', () => {
    expect(canSendAuthEmail(parseAuthConfig({}))).toBe(false)
    expect(canSendAuthEmail(parseAuthConfig({ RESEND_API_KEY: 're_test_key' }))).toBe(true)
  })
})
