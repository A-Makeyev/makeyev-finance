/**
 * The shape of the account-deletion code, shared by the server that mints it
 * and the modal that collects it. Nothing here touches node:crypto, so it is
 * safe to import from a client component (the generator lives in
 * src/server/auth/deleteCode.ts).
 *
 * Alphabet: uppercase letters and digits, minus the pairs that get misread
 * (I/1, O/0). Six characters is ~1e9 combinations, far beyond what the
 * endpoint's rate limit (10 requests per minute) could walk, and a code is only
 * accepted for the session that asked for it.
 */
export const DELETE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const DELETE_CODE_LENGTH = 6

/** How long a mailed code is accepted. */
export const DELETE_CODE_TTL_SECONDS = 30 * 60

/**
 * What the user typed -> what is looked up. Case and stray spacing are not
 * secrets: someone reading "abc 123" off a phone should not fail because the
 * mail showed capitals or a client inserted a space.
 */
export function normalizeDeleteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

/**
 * What a single box of the delete-code input may hold: letters and digits only,
 * uppercased. The alphabet has no lowercase, so a code typed or pasted in any
 * case lands as the capital the mail showed, and punctuation or spaces (from a
 * paste out of a mail client) never reach a box.
 */
export function sanitizeDeleteCodeInput(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

/**
 * The prefix every deletion verification row shares (both a mailed code and
 * Better Auth's own unused token). Exported so a caller can sweep a user's
 * outstanding codes, keyed by this prefix plus the user id.
 */
export const DELETE_ACCOUNT_PREFIX = 'delete-account-'

/**
 * The verification identifier a code is stored under. Better Auth's own
 * deletion token lives under the same `delete-account-` prefix, which is what
 * lets its `/delete-user` endpoint consume a code stored here when the code is
 * handed back as `token`.
 */
export function deleteAccountIdentifier(code: string): string {
  return `${DELETE_ACCOUNT_PREFIX}${code}`
}
