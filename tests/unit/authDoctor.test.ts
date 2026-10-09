import { describe, expect, it } from 'vitest'
import { duplicateEmails, orphanAccounts } from '../../scripts/auth-doctor.mjs'

/**
 * The auth doctor's selection rules. Both decide what the repair command is
 * allowed to delete (orphaned account rows only) or flag, so they get concrete
 * cases rather than being exercised only against a live database.
 */
describe('orphanAccounts', () => {
  it('selects only the rows whose user is gone', () => {
    const accounts = [
      { _id: 'a1', userId: 'u1', providerId: 'credential' },
      { _id: 'a2', userId: 'gone', providerId: 'google' },
      { _id: 'a3', userId: 42, providerId: 'google' },
    ]
    expect(orphanAccounts(accounts, ['u1', 42]).map((account) => account._id)).toEqual(['a2'])
  })

  it('matches ids across string and non-string forms', () => {
    // Mongo keeps the id as an ObjectId; the user list may hand back a string
    // or an object with toString(). Comparing raw values would report a live
    // account as orphaned and the repair would delete a working link.
    const accounts = [{ _id: 'a1', userId: { toString: () => 'u1' }, providerId: 'google' }]
    expect(orphanAccounts(accounts, ['u1'])).toEqual([])
  })

  it('reports nothing when every account has a user', () => {
    expect(orphanAccounts([{ _id: 'a1', userId: 'u1' }], ['u1'])).toEqual([])
  })
})

describe('duplicateEmails', () => {
  it('finds addresses carried by more than one user, case-insensitively', () => {
    const users = [
      { email: 'a@example.test' },
      { email: 'A@example.test' },
      { email: 'b@example.test' },
    ]
    expect(duplicateEmails(users)).toEqual([{ email: 'a@example.test', count: 2 }])
  })

  it('ignores missing addresses', () => {
    expect(duplicateEmails([{ email: null }, { email: '' }, {}])).toEqual([])
  })
})
