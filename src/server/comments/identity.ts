import { createHmac } from 'node:crypto'

/**
 * The comment author's link to an address, which is what lets a re-registered
 * account pick up the comments a deleted account left behind.
 *
 * A comment stores the address as an HMAC, never as plaintext: the link only
 * ever needs equality between two addresses, and the public comments
 * collection must not become a list of people's emails.
 *
 * Keyed with the deployment's auth secret. If that is missing in production
 * (where Better Auth would otherwise let the server start) no hash is stored,
 * so nothing can be linked: failing closed is the only safe answer, because an
 * unkeyed hash of an email is guessable offline.
 */

const DEV_FALLBACK_SECRET = 'comments-email-link-development-only'

/** Trim and lower-case, the same normalization the auth layer applies. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Pure: the stored link for an address. Exported so the rule is unit-tested. */
export function emailLinkHash(email: string, secret: string): string {
  return createHmac('sha256', secret).update(normalizeEmail(email)).digest('hex')
}

/**
 * The hash to store on a new comment, or null when this deployment has no
 * stable server secret to key it with. Better Auth auto-generates a secret in
 * development, so local runs fall back to a fixed value; production without a
 * configured secret gets null.
 */
export function commentEmailHash(email: string | null | undefined): string | null {
  const normalized = email ? normalizeEmail(email) : ''
  if (!normalized) return null

  const configured = process.env.BETTER_AUTH_SECRET?.trim()
  if (configured && configured.length >= 32) return emailLinkHash(normalized, configured)
  if (process.env.NODE_ENV === 'production') return null
  return emailLinkHash(normalized, DEV_FALLBACK_SECRET)
}
