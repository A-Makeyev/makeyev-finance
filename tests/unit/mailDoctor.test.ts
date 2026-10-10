import { describe, expect, it } from 'vitest'
import { domainOf, senderVerdict } from '../../scripts/mail-doctor.mjs'

/**
 * The mail doctor's rules. Getting these wrong sends someone hunting through
 * Resend's dashboard for a problem that is really a one-line .env fix, so they
 * get concrete cases rather than only a live run.
 */
describe('domainOf', () => {
  it('reads the domain from Name <email> and from a bare address', () => {
    expect(domainOf('Makeyev Finance <no-reply@makeyev-finance.com>')).toBe('makeyev-finance.com')
    expect(domainOf('no-reply@makeyev-finance.com')).toBe('makeyev-finance.com')
  })

  it('lowercases, so a verdict cannot hinge on letter case', () => {
    expect(domainOf('Someone@Gmail.COM')).toBe('gmail.com')
  })

  it('returns an empty string for a missing or unusable value', () => {
    expect(domainOf(undefined)).toBe('')
    expect(domainOf('   ')).toBe('')
    expect(domainOf('not-an-address')).toBe('')
  })
})

describe('senderVerdict', () => {
  it('passes a verified domain', () => {
    expect(
      senderVerdict({ fromDomain: 'makeyev-finance.com', verifiedDomains: ['makeyev-finance.com'] }),
    ).toMatchObject({ level: 'ok' })
  })

  it('flags a consumer domain, which Resend can never verify', () => {
    // The real failure this whole check exists for: a Gmail address in
    // AUTH_EMAIL_FROM makes every send fail with validation_error (403).
    const verdict = senderVerdict({ fromDomain: 'gmail.com', verifiedDomains: [] })
    expect(verdict.level).toBe('error')
    expect(verdict.text).toContain('validation_error')
  })

  it('flags a domain that is not on the account at all', () => {
    const verdict = senderVerdict({ fromDomain: 'makeyev-finance.com', verifiedDomains: [] })
    expect(verdict.level).toBe('error')
    expect(verdict.text).toContain('not on this Resend account')
  })

  it('flags a domain that is on the account but not verified yet', () => {
    // Being listed is not being verified: this exact case (status `not_started`)
    // would otherwise report "ready" while every send is rejected.
    const verdict = senderVerdict({
      fromDomain: 'makeyev-finance.com',
      verifiedDomains: [],
      domainStatus: 'not_started',
    })
    expect(verdict.level).toBe('error')
    expect(verdict.text).toContain('not_started')
  })

  it('flags a partially verified domain, which still cannot send', () => {
    expect(
      senderVerdict({
        fromDomain: 'makeyev-finance.com',
        verifiedDomains: [],
        domainStatus: 'partially_verified',
      }),
    ).toMatchObject({ level: 'error' })
  })

  it('warns for the test sender instead of failing it', () => {
    expect(senderVerdict({ fromDomain: 'resend.dev' })).toMatchObject({ level: 'warn' })
  })

  it('does not claim a domain is ready when the account could not be read', () => {
    // A send-only API key cannot list domains: unknown must not read as "ok".
    expect(
      senderVerdict({ fromDomain: 'makeyev-finance.com', verifiedDomains: null }),
    ).toMatchObject({ level: 'warn' })
  })

  it('reports an unusable address', () => {
    expect(senderVerdict({ fromDomain: '' })).toMatchObject({ level: 'error' })
  })
})
