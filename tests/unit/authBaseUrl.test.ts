import { describe, expect, it } from 'vitest'
import { resolveBaseURL } from 'better-auth'
import { buildBaseURLConfig } from '@/server/auth/config'

/**
 * Where auth redirects point. Better Auth builds every magic link and the
 * Google OAuth `redirect_uri` from its resolved base URL, so a Host-header
 * derived origin would hand the callback to whoever sent the request.
 *
 * Resolution runs through Better Auth's own `resolveBaseURL`: our config is the
 * input, the redirect is the output. `trustedProxyHeaders` mirrors
 * `advanced.trustedProxyHeaders` in src/server/auth/index.ts.
 */
const BASE_PATH = '/api/auth'
const PRODUCTION_URL = 'https://makeyev-finance.onrender.com'

describe('auth base URL resolution', () => {
  it('resolves loopback with no BETTER_AUTH_URL configured', () => {
    // dev (3000) and e2e (3100) differ only by port; both must work unset.
    expect(
      resolveBaseURL(
        buildBaseURLConfig(undefined),
        BASE_PATH,
        new Request('http://localhost:3000/api/auth/session', {
          headers: { host: 'localhost:3000' },
        }),
        undefined,
        false,
      ),
    ).toBe('http://localhost:3000/api/auth')

    expect(
      resolveBaseURL(
        buildBaseURLConfig(undefined),
        BASE_PATH,
        new Request('http://localhost:3100/api/auth/session', {
          headers: { host: 'localhost:3100' },
        }),
        undefined,
        false,
      ),
    ).toBe('http://localhost:3100/api/auth')
  })

  it('resolves the public https origin through the proxy', () => {
    // What Render forwards: internal URL and Host, real origin in x-forwarded-*.
    const request = new Request('http://10.0.0.7:10000/api/auth/callback/google', {
      headers: {
        host: '10.0.0.7:10000',
        'x-forwarded-host': 'makeyev-finance.onrender.com',
        'x-forwarded-proto': 'https',
      },
    })
    expect(
      resolveBaseURL(buildBaseURLConfig(PRODUCTION_URL), BASE_PATH, request, undefined, true),
    ).toBe('https://makeyev-finance.onrender.com/api/auth')
  })

  it('falls back to the public origin when the proxy exposes an internal host', () => {
    // Without trusting proxy headers the container's own host still fails the
    // allowlist, so the redirect leaves for the real domain over https.
    const request = new Request('http://10.0.0.7:10000/api/auth/callback/google', {
      headers: { host: '10.0.0.7:10000' },
    })
    expect(
      resolveBaseURL(buildBaseURLConfig(PRODUCTION_URL), BASE_PATH, request, undefined, false),
    ).toBe('https://makeyev-finance.onrender.com/api/auth')
  })

  it('rejects a spoofed Host header instead of reflecting it', () => {
    // No configured origin means no fallback, so an unknown host must fail
    // rather than be answered with the attacker's own origin.
    expect(() =>
      resolveBaseURL(
        buildBaseURLConfig(undefined),
        BASE_PATH,
        new Request('http://evil.example/api/auth/session', {
          headers: { host: 'evil.example' },
        }),
        undefined,
        true,
      ),
    ).toThrow(/allowed hosts/i)
  })

  it('sends a spoofed x-forwarded-host to our origin, not the attacker', () => {
    // Trusting proxy headers is only safe because the allowlist re-checks the
    // host; without that gate this would emit evil.example.
    const request = new Request('http://10.0.0.7:10000/api/auth/callback/google', {
      headers: {
        host: '10.0.0.7:10000',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'https',
      },
    })
    expect(
      resolveBaseURL(buildBaseURLConfig(PRODUCTION_URL), BASE_PATH, request, undefined, true),
    ).toBe('https://makeyev-finance.onrender.com/api/auth')
  })
})
