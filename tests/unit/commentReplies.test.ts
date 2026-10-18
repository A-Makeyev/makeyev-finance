import { describe, expect, it } from 'vitest'
import {
  REPLY_PAGE_SIZE,
  hiddenReplyCount,
  shownReplyCount,
  withRevealedPath,
} from '@/features/comments/replies'
import type { CommentNode } from '@/features/comments/tree'

/**
 * Reply pagination is a pure calculation, so the boundaries that matter live
 * here: the first page, exactly one page, one more than a page (the off-by-one
 * that would hide a reply), and the clamp that stops a thread slicing past its
 * end when it shrank between renders.
 */

describe('shownReplyCount', () => {
  it('shows the whole thread when it fits in one page', () => {
    expect(shownReplyCount(0, REPLY_PAGE_SIZE)).toBe(0)
    expect(shownReplyCount(1, REPLY_PAGE_SIZE)).toBe(1)
    expect(shownReplyCount(REPLY_PAGE_SIZE, REPLY_PAGE_SIZE)).toBe(REPLY_PAGE_SIZE)
  })

  it('hides the rest by exactly one once past a page', () => {
    // The boundary that would otherwise drop a reply from the page.
    expect(shownReplyCount(REPLY_PAGE_SIZE + 1, REPLY_PAGE_SIZE)).toBe(REPLY_PAGE_SIZE)
    expect(hiddenReplyCount(REPLY_PAGE_SIZE + 1, REPLY_PAGE_SIZE)).toBe(1)
  })

  it('adds a page per reveal', () => {
    const total = REPLY_PAGE_SIZE * 3 + 2
    expect(shownReplyCount(total, REPLY_PAGE_SIZE * 2)).toBe(REPLY_PAGE_SIZE * 2)
    expect(hiddenReplyCount(total, REPLY_PAGE_SIZE * 2)).toBe(REPLY_PAGE_SIZE + 2)
    expect(shownReplyCount(total, REPLY_PAGE_SIZE * 3)).toBe(REPLY_PAGE_SIZE * 3)
  })

  it('never shows more than there are, however far the reader revealed', () => {
    // A reply deleted in another tab shrinks the thread under the count.
    expect(shownReplyCount(2, REPLY_PAGE_SIZE * 5)).toBe(2)
    expect(hiddenReplyCount(2, REPLY_PAGE_SIZE * 5)).toBe(0)
  })

  it('shrinks to the first page if the reveal count is somehow below it', () => {
    expect(shownReplyCount(10, 0)).toBe(REPLY_PAGE_SIZE)
    expect(shownReplyCount(10, -1)).toBe(REPLY_PAGE_SIZE)
  })

  it('is 0 hidden once every reply is shown', () => {
    expect(hiddenReplyCount(REPLY_PAGE_SIZE, REPLY_PAGE_SIZE)).toBe(0)
    expect(hiddenReplyCount(REPLY_PAGE_SIZE * 2, REPLY_PAGE_SIZE * 2)).toBe(0)
  })
})

/** A minimal node; only ids and children matter to the reveal arithmetic. */
function node(id: string, children: CommentNode[] = []): CommentNode {
  return {
    comment: {
      id,
      parentId: null,
      userName: id,
      userImage: null,
      authorDeleted: false,
      body: id,
      createdAt: '2026-01-01T00:00:00Z',
      editedAt: null,
      deleted: false,
      mine: false,
      canDelete: false,
    },
    children,
    depth: 0,
  }
}

describe('withRevealedPath', () => {
  // root -> a -> b -> c (c is the deepest reply), plus a sibling thread.
  const c = node('c')
  const b = node('b', [c])
  const a = node('a', [b])
  const rootA = node('rootA', [a])
  const rootOther = node('rootOther', [node('x')])
  const roots = [rootA, rootOther]

  it('reveals nothing when the path is already within the first page', () => {
    // Every step sits in reply position 1, which the default page of
    // REPLY_PAGE_SIZE already covers, so the map is untouched.
    const next = withRevealedPath({}, roots, ['rootA', 'a', 'b', 'c'])
    expect(next).toEqual({})
  })

  it('reveals up to the reply position when a step falls past the first page', () => {
    // c sits fourth under b: positions 1-3 are the default page, so b has to
    // be raised to 4 and no further.
    const b4 = node('b', [node('c1'), node('c2'), node('c3'), node('c')])
    const roots4 = [node('rootA', [node('a', [b4])])]
    const next = withRevealedPath({}, roots4, ['rootA', 'a', 'b', 'c'])
    expect(next).toEqual({ b: 4 })
  })

  it('keeps whatever the reader already revealed', () => {
    const next = withRevealedPath({ b: 9, unrelated: 2 }, roots, ['rootA', 'a', 'b', 'c'])
    expect(next.b).toBe(9)
    expect(next.unrelated).toBe(2)
    // Nothing else had to change: the rest of the path was already visible.
    expect(next.rootA).toBeUndefined()
  })

  it('does not lower a count that is already large enough', () => {
    const next = withRevealedPath({ rootA: 5 }, roots, ['rootA', 'a', 'b', 'c'])
    expect(next.rootA).toBe(5)
  })

  it('stops without inventing entries when the path leaves the tree', () => {
    expect(withRevealedPath({}, roots, ['rootA', 'ghost', 'c'])).toEqual({})
    // A single-id path (a top-level comment) reveals nothing.
    expect(withRevealedPath({}, roots, ['rootA'])).toEqual({})
  })

  it('returns the same object when nothing needs revealing', () => {
    // React bails out of a re-render when the reference is unchanged, which is
    // what stops the deep-link effect looping once the target is reachable.
    const current = { rootA: 1, a: 1, b: 1 }
    expect(withRevealedPath(current, roots, ['rootA', 'a', 'b', 'c'])).toBe(current)
  })
})
