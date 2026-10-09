import { getDb } from './mongo'

/**
 * What deleting an account removes beyond the user row itself.
 *
 * Better Auth's own delete already removes the user, their sessions and their
 * linked account rows (see `internalAdapter.deleteUser`), and it clears the
 * session cookie. Everything the rest of the app keys by user id is ours to
 * clean up, and this is the whole list of it:
 *
 *  - `saved_mixes`: private data. Nobody else could have read it, but "delete
 *    my account" has to mean the mixes go too.
 *
 * `article_comments` is deliberately NOT on the list. A comment is part of a
 * public thread other people replied to, so deleting the account keeps it under
 * the name it was posted with, and the thread shows it as coming from a deleted
 * account (see src/server/comments/repo.ts). That is a product decision rather
 * than a technical one: say the word and the alternative (delete the comments
 * too, or blank the name) is a one-line change here plus the marker in the
 * thread.
 */
export const ACCOUNT_OWNED_COLLECTIONS = ['saved_mixes'] as const

/**
 * Removes every row owned by `userId` in the collections above and reports how
 * many were deleted. Each query is scoped by `userId`, so it can never reach
 * another user's data.
 */
export async function purgeUserData(userId: string): Promise<number> {
  if (!userId) return 0
  const db = await getDb()
  let removed = 0
  for (const name of ACCOUNT_OWNED_COLLECTIONS) {
    const result = await db.collection(name).deleteMany({ userId })
    removed += result.deletedCount ?? 0
  }
  return removed
}
