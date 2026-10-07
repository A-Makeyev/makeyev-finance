import { describe, expect, it } from 'vitest'
import { buildAccountLinkingConfig } from '@/server/auth/config'

/**
 * The account-linking policy, pinned rather than left to a default.
 *
 * Two separate things matter here and both are easy to break later: that a
 * Google sign-in may join an existing account (the feature), and that it may
 * only do so for an address the account already verified (the guard). The
 * guard is the security half: without it, registering a stranger's address
 * with a password would hand that account over as soon as the real owner signs
 * in with Google.
 */
describe('buildAccountLinkingConfig', () => {
  it('links a Google sign-in into the account with the same address', () => {
    const config = buildAccountLinkingConfig()
    expect(config.enabled).toBe(true)
    expect(config.trustedProviders).toEqual(['google'])
    expect(config.updateUserInfoOnLink).toBe(true)
  })

  it('keeps the verified-email guard on', () => {
    // Load-bearing, not inherited from the library default. With this false,
    // an unverified password signup for someone else's address is inherited by
    // that account the moment the real owner signs in with Google.
    expect(buildAccountLinkingConfig().requireLocalEmailVerified).toBe(true)
  })

  it('does not leave implicit linking disabled', () => {
    // `disableImplicitLinking: true` would silently turn the feature back off.
    expect(buildAccountLinkingConfig()).not.toHaveProperty('disableImplicitLinking')
  })
})
