import { APIError, BASE_ERROR_CODES } from 'better-auth'

/**
 * A sign-up on an address that already has an account.
 *
 * Why this exists at all: Better Auth's sign-up route only returns the
 * `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` error when email verification is off.
 * With `requireEmailVerification: true` (any deployment that can send mail) it
 * deliberately answers a generic 200 with a synthetic user instead, to stop the
 * endpoint being used to enumerate addresses. That generic response is
 * indistinguishable from a real sign-up, so the form showed "Account created,
 * we sent a verification email" for an address that already existed and sent no
 * mail.
 *
 * The collision is resolved by verification state, not just existence:
 *
 *  - VERIFIED account: the address is taken. Reject explicitly with
 *    `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, the code the auth page renders as
 *    `auth.errorEmailInUse`.
 *  - UNVERIFIED account: the row was created at sign-up but nobody has ever
 *    proved ownership of the address, so it cannot be used (and, with account
 *    linking, cannot claim the address). Rejecting would strand the person with
 *    an address that is "taken" but unreachable, so the verification mail is
 *    re-sent instead and the form shows the confirmation panel (see
 *    src/server/auth/index.ts).
 *
 * The rule is split from its wiring so it is unit-tested against a stub: the
 * request shape, the collision lookup, and the error code the client maps.
 */

/** The endpoint that creates an email+password account. */
export const SIGN_UP_EMAIL_PATH = '/sign-up/email'

/** The request shape the rule reads: the router path and the parsed body. */
export type SignUpRequest = { path?: string; body?: unknown }

/**
 * Pure: the address a request is trying to register, or null when the request
 * is not an email sign-up or carries no usable address.
 *
 * Lower-casing (and nothing else) mirrors what Better Auth's own sign-up route
 * stores, so the lookup cannot miss a row that differs only by case.
 */
export function signUpAttemptEmail(request: SignUpRequest): string | null {
  if (request.path !== SIGN_UP_EMAIL_PATH) return null
  const body = request.body as { email?: unknown } | null | undefined
  if (!body || typeof body.email !== 'string') return null
  const email = body.email.toLowerCase()
  return email || null
}

/** What the sign-up collides with, and whether that account is verified. */
export type SignUpCollision<User> = {
  email: string
  verified: boolean
  user: User
}

type FindUserByEmail<User> = (
  email: string,
) => Promise<{ user?: User } | null | undefined>

/**
 * The existing account a sign-up collides with, or null when the address is
 * free. `findUserByEmail` is injected so the decision is tested against a stub
 * as well as against the live adapter; the found user is returned because the
 * unverified path needs it to re-send the verification mail.
 */
export async function signUpCollision<User extends { emailVerified?: unknown }>(
  request: SignUpRequest,
  findUserByEmail: FindUserByEmail<User>,
): Promise<SignUpCollision<User> | null> {
  const email = signUpAttemptEmail(request)
  if (!email) return null
  const existing = await findUserByEmail(email)
  if (!existing?.user) return null
  // Better Auth 1.7 stores emailVerified as a boolean; anything else (a null or
  // a missing field on an old row) counts as not verified, so the account gets
  // the re-send rather than a hard rejection.
  return { email, verified: existing.user.emailVerified === true, user: existing.user }
}

/**
 * The rejection for a sign-up on a VERIFIED address: Better Auth's own
 * USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL as a 422, which is the code the auth
 * page renders as `auth.errorEmailInUse`.
 */
export function duplicateSignUpError(): APIError {
  return APIError.from(
    'UNPROCESSABLE_ENTITY',
    BASE_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL,
  )
}
