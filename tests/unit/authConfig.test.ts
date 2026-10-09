import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEPLOY_ORIGINS,
  buildBaseURLConfig,
  canSendAuthEmail,
  getAuthConfig,
  parseAuthConfig,
  publicOrigin,
} from '@/server/auth/config'

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

describe('getAuthConfig', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('treats empty and whitespace-only env values as unset instead of throwing', () => {
    // .env entries left as `KEY=` come through as empty strings (which fail
    // .min(1)/.url() and turn every auth request into "Invalid auth
    // configuration"). Blank means "not configured", same as absent.
    vi.stubEnv('BETTER_AUTH_URL', '')
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('AUTH_EMAIL_FROM', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '   ')

    const config = getAuthConfig()
    expect(config.BETTER_AUTH_URL).toBeUndefined()
    expect(config.RESEND_API_KEY).toBeUndefined()
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined()
    expect(config.GOOGLE_CLIENT_SECRET).toBeUndefined()
    expect(config.AUTH_EMAIL_FROM).toBe('Makeyev Finance <onboarding@resend.dev>')
  })

  it('still throws for a too-short BETTER_AUTH_SECRET', () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'too-short')
    expect(() => getAuthConfig()).toThrow(/BETTER_AUTH_SECRET/)
  })
})

describe('buildBaseURLConfig', () => {
  it('accepts loopback on any port and the compiled deploy origin with no env var', () => {
    // Zero env config: dev (3000) and e2e (3100) differ only by port, and the
    // deployed host is compiled in so Render needs no BETTER_AUTH_URL.
    const config = buildBaseURLConfig(undefined)
    expect(config.allowedHosts).toContain('localhost:*')
    expect(config.allowedHosts).toContain('127.0.0.1:*')
    expect(config.allowedHosts).toContain('[::1]:*')
    expect(config.allowedHosts).toContain('makeyev-finance.onrender.com')
    // Scheme is derived per request, not pinned, so one build serves https on
    // Render and http on loopback.
    expect(config.protocol).toBe('auto')
    expect(config.fallback).toBe('https://makeyev-finance.onrender.com')
  })

  it("adds an extra configured host and prefers it as the fallback", () => {
    const config = buildBaseURLConfig('https://preview.example.com')
    expect(config.allowedHosts).toContain('preview.example.com')
    expect(config.allowedHosts).toContain('makeyev-finance.onrender.com')
    // Still accepts localhost, so one build serves both dev and prod.
    expect(config.allowedHosts).toContain('localhost:*')
    // An unrecognised Host resolves to our origin instead of throwing, and
    // never to the host in the request.
    expect(config.fallback).toBe('https://preview.example.com')
  })

  it('keeps the port when the configured origin has one', () => {
    // The allowlist matches the full `host:port`, so dropping the port would
    // reject a legitimate origin.
    const config = buildBaseURLConfig('http://localhost:8080')
    expect(config.allowedHosts).toContain('localhost:8080')
  })
})

describe('publicOrigin', () => {
  it('prefers an explicitly configured origin', () => {
    expect(publicOrigin('https://preview.example.com')).toBe('https://preview.example.com')
  })

  it('falls back to the compiled deploy origin', () => {
    expect(publicOrigin(undefined)).toBe(DEPLOY_ORIGINS[0])
  })
})

describe('canSendAuthEmail', () => {
  it('reflects the presence of the Resend key', () => {
    expect(canSendAuthEmail(parseAuthConfig({}))).toBe(false)
    expect(canSendAuthEmail(parseAuthConfig({ RESEND_API_KEY: 're_test_key' }))).toBe(true)
  })
})
