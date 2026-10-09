import { getAuth } from './index'
import { consumeRateLimit } from '../ratelimit'

/**
 * Setting a password on an account that has none.
 *
 * A Google sign-in creates a user with no credential account, so there is no
 * password to sign in with - and the sign-up form cannot help either, because
 * the address is already registered (`auth.errorEmailInUse`). Better Auth's own
 * `set-password` endpoint closes that gap: with a valid session it writes a
 * credential account for the signed-in user, after which the email+password
 * form works. It is declared `serverOnly`, so it is reachable from a Next
 * server action rather than from the browser client, which is what this module
 * wraps.
 *
 * Its rules, kept here so the action and its tests read the same values:
 *  - a session is required (Better Auth's `sensitiveSessionMiddleware`);
 *  - the password length mirrors the auth config's min/max (8..128, see
 *    src/server/auth/index.ts) so the form fails fast with a translated
 *    message instead of a raw API error;
 *  - an account that ALREADY has a password is refused by Better Auth
 *    (`PASSWORD_ALREADY_SET`): changing an existing password requires proving
 *    the current one, and that is the change-password flow, not this one;
 *  - a per-user budget bounds the hashing work an authenticated caller can ask
 *    for, the same abuse control the reset and comment endpoints carry.
 */

/** Mirrors `emailAndPassword.minPasswordLength` / `maxPasswordLength` in src/server/auth/index.ts. */
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128

/** One bucket per user: setting a password is a once-per-account action. */
export const SET_PASSWORD_RATE_LIMIT = { windowSeconds: 60, max: 10 } as const

export type SetPasswordResult =
  | { ok: true }
  | {
      ok: false
      reason: 'unauthenticated' | 'too_short' | 'too_long' | 'has_password' | 'rate_limited' | 'error'
    }

/**
 * Sets the password for the account behind `requestHeaders`.
 *
 * Takes the headers rather than reading them itself, so the rule is exercised
 * against a real request in tests; the server action is the only caller and
 * passes the request's own headers. Authorization is the session, looked up
 * server-side: nothing about the target account comes from the client.
 */
export async function setAccountPasswordFor(
  requestHeaders: Headers,
  newPassword: string,
): Promise<SetPasswordResult> {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null)
  if (!session) return { ok: false, reason: 'unauthenticated' }

  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'too_short' }
  if (newPassword.length > MAX_PASSWORD_LENGTH) return { ok: false, reason: 'too_long' }

  const allowed = await consumeRateLimit({
    bucket: 'set-password',
    key: session.user.id,
    ...SET_PASSWORD_RATE_LIMIT,
  })
  if (!allowed) return { ok: false, reason: 'rate_limited' }

  try {
    await auth.api.setPassword({ body: { newPassword }, headers: requestHeaders })
    return { ok: true }
  } catch (error) {
    const code = (error as { body?: { code?: string } })?.body?.code
    if (code === 'PASSWORD_ALREADY_SET') return { ok: false, reason: 'has_password' }
    // Never the password itself, and never the hash.
    console.error(
      `[auth] set-password failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
    return { ok: false, reason: 'error' }
  }
}
