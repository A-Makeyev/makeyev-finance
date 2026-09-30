import { describe, expect, it } from 'vitest'
import { parseSocialProviders } from '@/server/auth/config'

describe('parseSocialProviders', () => {
  it('enables nothing when the env carries no provider credentials', () => {
    expect(parseSocialProviders({})).toEqual([])
  })

  it('ignores unrelated env keys', () => {
    expect(
      parseSocialProviders({
        RESEND_API_KEY: 're_test_key',
        MONGODB_URI: 'mongodb://localhost:27017/makeyev',
      }),
    ).toEqual([])
  })

  it('enables Google only when BOTH its id and secret are present', () => {
    expect(parseSocialProviders({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toEqual([
      'google',
    ])
  })

  it('ignores a partial Google credential pair', () => {
    // The e2e/CI environment has no credentials at all, but a partial tuple is
    // the realistic misconfiguration: without both vars Better Auth would
    // register the provider and die at the token exchange, so it stays off.
    expect(parseSocialProviders({ GOOGLE_CLIENT_ID: 'id' })).toEqual([])
    expect(parseSocialProviders({ GOOGLE_CLIENT_SECRET: 'secret' })).toEqual([])
  })

  it('treats an empty-string credential as absent', () => {
    expect(parseSocialProviders({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: 'secret' })).toEqual([])
  })

  it('returns the fixed display order (google)', () => {
    // The buttons render in this order regardless of which env keys appear
    // first, so the login card looks the same on every deployment.
    const enabled = parseSocialProviders({
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    })
    expect(enabled).toEqual(['google'])
  })

  it('ignores removed providers (facebook, apple) even if their env keys linger', () => {
    // The deployment dropped Facebook and Apple sign-in; leftover keys in a
    // stray .env or CI cache must not bring the providers back.
    expect(
      parseSocialProviders({
        FACEBOOK_CLIENT_ID: 'fb-id',
        FACEBOOK_CLIENT_SECRET: 'fb-secret',
        APPLE_CLIENT_ID: 'apple-id',
        APPLE_CLIENT_SECRET: 'apple-secret',
      }),
    ).toEqual([])
    expect(
      parseSocialProviders({
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        FACEBOOK_CLIENT_ID: 'fb-id',
        FACEBOOK_CLIENT_SECRET: 'fb-secret',
        APPLE_CLIENT_ID: 'apple-id',
        APPLE_CLIENT_SECRET: 'apple-secret',
      }),
    ).toEqual(['google'])
  })
})
