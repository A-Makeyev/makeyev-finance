import { describe, expect, it, vi } from 'vitest'
import {
  duplicateSignUpError,
  signUpAttemptEmail,
  signUpCollision,
} from '@/server/auth/duplicateSignUp'

/**
 * The sign-up collision rule.
 *
 * Better Auth's sign-up route answers a generic 200 (with a synthetic user) for
 * an address that already exists whenever `requireEmailVerification` is on, so
 * the form could not tell that apart from a real sign-up. The guard turns that
 * into either the explicit "already registered" error (verified account) or a
 * re-sent verification mail (unverified account, whose row exists but proves
 * nothing). The rule is exercised against a stub finder, not a live database.
 */
describe('signUpAttemptEmail', () => {
  it('returns the lower-cased address of an email sign-up', () => {
    expect(
      signUpAttemptEmail({ path: '/sign-up/email', body: { email: 'Dana@Example.TEST' } }),
    ).toBe('dana@example.test')
  })

  it('keeps plus and dot sub-addressing intact', () => {
    // Only case is normalized: trimming or stripping sub-addresses here would
    // look up a different account than Better Auth would have created.
    expect(
      signUpAttemptEmail({ path: '/sign-up/email', body: { email: 'a.b+test@example.test' } }),
    ).toBe('a.b+test@example.test')
  })

  it('ignores every other endpoint', () => {
    expect(
      signUpAttemptEmail({ path: '/sign-in/email', body: { email: 'a@example.test' } }),
    ).toBeNull()
    expect(
      signUpAttemptEmail({ path: '/sign-up/social', body: { email: 'a@example.test' } }),
    ).toBeNull()
    expect(signUpAttemptEmail({ body: { email: 'a@example.test' } })).toBeNull()
  })

  it('ignores a body without a usable address', () => {
    expect(signUpAttemptEmail({ path: '/sign-up/email', body: {} })).toBeNull()
    expect(signUpAttemptEmail({ path: '/sign-up/email', body: { email: '' } })).toBeNull()
    expect(signUpAttemptEmail({ path: '/sign-up/email', body: { email: 42 } })).toBeNull()
    expect(signUpAttemptEmail({ path: '/sign-up/email' })).toBeNull()
    expect(signUpAttemptEmail({ path: '/sign-up/email', body: null })).toBeNull()
  })
})

describe('signUpCollision', () => {
  it('flags a verified account as a real collision', async () => {
    const user = { id: 'u1', emailVerified: true }
    const findUserByEmail = vi.fn(async () => ({ user }))
    await expect(
      signUpCollision(
        { path: '/sign-up/email', body: { email: 'Dana@Example.test' } },
        findUserByEmail,
      ),
    ).resolves.toEqual({ email: 'dana@example.test', verified: true, user })
    // The lookup must use the same normalization Better Auth stores, or a row
    // differing only by case would be missed and a second user created.
    expect(findUserByEmail).toHaveBeenCalledWith('dana@example.test')
  })

  it('returns the existing user, unverified, so the mail can be re-sent', async () => {
    const user = { id: 'u2', emailVerified: false }
    await expect(
      signUpCollision(
        { path: '/sign-up/email', body: { email: 'new@example.test' } },
        vi.fn(async () => ({ user })),
      ),
    ).resolves.toEqual({ email: 'new@example.test', verified: false, user })
  })

  it('treats a missing or non-boolean flag as unverified', async () => {
    // An old row without the field must get the re-send, not a hard rejection.
    for (const emailVerified of [undefined, null, 0]) {
      const collision = await signUpCollision(
        { path: '/sign-up/email', body: { email: 'a@example.test' } },
        vi.fn(async () => ({ user: { id: 'u3', emailVerified } })),
      )
      expect(collision?.verified, String(emailVerified)).toBe(false)
    }
  })

  it('returns null when the address is free', async () => {
    await expect(
      signUpCollision(
        { path: '/sign-up/email', body: { email: 'new@example.test' } },
        vi.fn(async () => null),
      ),
    ).resolves.toBeNull()
  })

  it('does not touch the database for any other request', async () => {
    const findUserByEmail = vi.fn(async () => null)
    await expect(
      signUpCollision(
        { path: '/sign-in/email', body: { email: 'a@example.test' } },
        findUserByEmail,
      ),
    ).resolves.toBeNull()
    expect(findUserByEmail).not.toHaveBeenCalled()
  })
})

describe('duplicateSignUpError', () => {
  it('is the 422 the auth page renders as "already registered"', () => {
    const error = duplicateSignUpError()
    // The code, not the message, is what AuthPage.describeError switches on.
    expect((error.body as { code?: string }).code).toBe('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
    expect(error.statusCode).toBe(422)
  })
})
