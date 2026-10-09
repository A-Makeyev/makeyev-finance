import { describe, expect, it } from 'vitest'
import type { Db } from 'mongodb'
import {
  isSocialSignIn,
  knownUserIdForms,
  releaseOrphanedAccounts,
} from '@/server/auth/orphanedAccounts'

/**
 * Releasing orphaned account rows.
 *
 * A Google subject whose owner row was deleted used to block every later Google
 * sign-in with `unable_to_link_account`, even for a user whose own account was
 * fine. The release rule decides what may be deleted from the account
 * collection, so it gets concrete cases against a stub `Db` rather than only
 * being exercised against a live database.
 */

/** A stub `Db` that answers only the two queries this module makes. */
function fakeDb(users: unknown[], accounts: Array<{ _id: string; userId: unknown }>) {
  const state = { accounts: accounts.map((account) => ({ ...account })) }
  const db = {
    collection(name: string) {
      if (name === 'user') {
        return { find: () => ({ toArray: async () => users.map((_id) => ({ _id })) }) }
      }
      return {
        deleteMany: async (filter: { userId: { $nin: unknown[] } }) => {
          const known = new Set(filter.userId.$nin.map((id) => String(id)))
          const before = state.accounts.length
          state.accounts = state.accounts.filter((account) => known.has(String(account.userId)))
          return { deletedCount: before - state.accounts.length }
        },
      }
    },
  } as unknown as Db
  return { db, remaining: () => state.accounts }
}

describe('isSocialSignIn', () => {
  it('matches the endpoint that starts every social sign-in', () => {
    expect(isSocialSignIn({ path: '/sign-in/social' })).toBe(true)
  })

  it('ignores every other endpoint', () => {
    expect(isSocialSignIn({ path: '/sign-up/email' })).toBe(false)
    expect(isSocialSignIn({ path: '/sign-in/email' })).toBe(false)
    expect(isSocialSignIn({ path: '/callback/google' })).toBe(false)
    expect(isSocialSignIn({})).toBe(false)
  })
})

describe('knownUserIdForms', () => {
  it('carries both the raw id and its string form', () => {
    // The adapter stores userId as an ObjectId when the user's _id is one and
    // as a string otherwise; `$nin` does not coerce, so both forms are needed
    // or a live link would be deleted as orphaned.
    const id = { toString: () => 'u1' }
    expect(knownUserIdForms([id])).toEqual([id, 'u1'])
  })
})

describe('releaseOrphanedAccounts', () => {
  it('deletes only the rows whose user is gone', async () => {
    const { db, remaining } = fakeDb(
      ['u1', { toString: () => 'u2' }],
      [
        { _id: 'a1', userId: 'u1' },
        { _id: 'a2', userId: { toString: () => 'u2' } },
        { _id: 'a3', userId: 'gone' },
      ],
    )
    await expect(releaseOrphanedAccounts(db)).resolves.toBe(1)
    expect(remaining().map((account) => account._id)).toEqual(['a1', 'a2'])
  })

  it('keeps a live row whose id is stored in the other form', async () => {
    // ObjectId in the account row, string in the user projection (or the
    // reverse): comparing raw values would delete a working link.
    const { db, remaining } = fakeDb(['6ac8bb8d563daa900309bec1'], [
      { _id: 'a1', userId: { toString: () => '6ac8bb8d563daa900309bec1' } },
    ])
    await expect(releaseOrphanedAccounts(db)).resolves.toBe(0)
    expect(remaining()).toHaveLength(1)
  })

  it('touches nothing when there are no users at all', async () => {
    // A fresh database or a failed read must not be read as "every account is
    // orphaned", which would wipe the account collection.
    const { db, remaining } = fakeDb([], [{ _id: 'a1', userId: 'u1' }])
    await expect(releaseOrphanedAccounts(db)).resolves.toBe(0)
    expect(remaining()).toHaveLength(1)
  })
})
