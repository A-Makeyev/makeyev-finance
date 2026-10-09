import { describe, expect, it } from 'vitest'
import { missingAuthorIds } from '@/server/comments/repo'

/**
 * Which comment authors no longer have an account.
 *
 * The thread marks those comments "a deleted account" instead of dropping them
 * (or silently showing a live-looking name), so the rule that decides it gets
 * concrete cases. An id wrongly reported as missing publishes a false claim
 * about a live user; an id wrongly reported as present hides a dead account.
 */
describe('missingAuthorIds', () => {
  it('reports only the authors with no user row', () => {
    expect([...missingAuthorIds(['live', 'gone'], ['live'])]).toEqual(['gone'])
  })

  it('ignores the ObjectId vs string difference', () => {
    // Comments store the session's string id; the user collection keys on an
    // ObjectId whose string form is the same hex.
    expect([...missingAuthorIds(['6ac8bb8d563daa900309bec1'], [{ toString: () => '6ac8bb8d563daa900309bec1' }])]).toEqual(
      [],
    )
  })

  it('compares case-insensitively', () => {
    expect([...missingAuthorIds(['6AC8BB8D563DAA900309BEC1'], ['6ac8bb8d563daa900309bec1'])]).toEqual([])
  })

  it('reports everything when no author has an account', () => {
    expect([...missingAuthorIds(['a', 'b'], [])]).toEqual(['a', 'b'])
  })

  it('reports nothing for an empty thread', () => {
    expect([...missingAuthorIds([], ['a'])]).toEqual([])
  })
})
