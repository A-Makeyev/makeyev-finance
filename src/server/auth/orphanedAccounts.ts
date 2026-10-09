import type { Db } from 'mongodb'

/**
 * Orphaned account rows: an `account` row whose `user` is gone.
 *
 * Better Auth refuses to attach such a row to anyone else, so a Google subject
 * that was linked once and whose owner row has since been deleted dead-ends
 * every later Google sign-in with `?error=unable_to_link_account` - even though
 * the same person has a perfectly good account on that address. That is what
 * this module releases.
 *
 * Why it is safe to delete them: the row cannot authenticate anyone (its user
 * does not exist), and the only way the Google subject gets linked again is a
 * completed Google OAuth round trip for it, which proves ownership of the
 * Google account. Releasing it therefore cannot hand anything to a stranger.
 * The rule is exercised by the auth-doctor script too (`--repair`), so a manual
 * cleanup stays possible.
 *
 * Called before a social sign-in starts (see src/server/auth/index.ts): the
 * callback's own owner lookup happens later, so by the time it runs there is
 * nothing stale left to trip over.
 */

/** The endpoint that begins every social (OAuth) sign-in, Google included. */
export const SOCIAL_SIGN_IN_PATH = '/sign-in/social'

/** The request shape the hook reads. */
export type AuthRequest = { path?: string }

/** True when this request is starting a social sign-in. */
export function isSocialSignIn(request: AuthRequest): boolean {
  return request.path === SOCIAL_SIGN_IN_PATH
}

/**
 * Every form a user id can take when it is compared against an `account.userId`.
 *
 * Better Auth's Mongo adapter stores the id as an ObjectId when the user's `_id`
 * is one, and as a plain string when it is not (see src/server/mixes/repo.ts for
 * the same reasoning). `$nin` does not coerce, so a raw ObjectId would not match
 * its own string form and a live link would be deleted as if it were orphaned.
 * Carrying both forms keeps the comparison type-agnostic.
 */
export function knownUserIdForms(userIds: unknown[]): unknown[] {
  return userIds.flatMap((id) => [id, String(id)])
}

/**
 * Deletes every account row whose user no longer exists, and reports how many
 * were released. Runs against our own handle on the same database Better Auth
 * uses (src/server/auth/mongo.ts), reading the collections by their Better Auth
 * names, exactly as scripts/auth-doctor.mjs does.
 *
 * An empty user collection is treated as "nothing to do" rather than "every
 * account is orphaned": that state only appears on a fresh database or a failed
 * read, and neither is a reason to wipe the account collection.
 */
export async function releaseOrphanedAccounts(db: Db): Promise<number> {
  const users = await db.collection('user').find({}, { projection: { _id: 1 } }).toArray()
  if (users.length === 0) return 0
  const known = knownUserIdForms(users.map((user) => user._id))
  const result = await db.collection('account').deleteMany({ userId: { $nin: known } })
  return result.deletedCount ?? 0
}
