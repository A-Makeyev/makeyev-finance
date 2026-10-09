import { describe, expect, it } from 'vitest'
import { buildCommentTree, visualDepth } from '@/features/comments/tree'
import type { CommentDto } from '@/features/comments/types'

/**
 * Threading is a pure transform, so it is tested here rather than only through
 * a rendered page: ordering, depth and the orphan case.
 */

function comment(id: string, parentId: string | null, createdAt: string): CommentDto {
  return {
    id,
    parentId,
    userName: `user-${id}`,
    userImage: null,
    authorDeleted: false,
    body: `body-${id}`,
    createdAt,
    editedAt: null,
    deleted: false,
    mine: false,
    canDelete: false,
  }
}

describe('buildCommentTree', () => {
  it('returns nothing for no comments', () => {
    expect(buildCommentTree([])).toEqual([])
  })

  it('nests replies under their parent and assigns depth', () => {
    const tree = buildCommentTree([
      comment('a', null, '2026-01-01T10:00:00Z'),
      comment('b', 'a', '2026-01-01T11:00:00Z'),
      comment('c', 'b', '2026-01-01T12:00:00Z'),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].comment.id).toBe('a')
    expect(tree[0].depth).toBe(0)
    expect(tree[0].children[0].comment.id).toBe('b')
    expect(tree[0].children[0].depth).toBe(1)
    expect(tree[0].children[0].children[0].comment.id).toBe('c')
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('shows top-level comments newest first and replies oldest first', () => {
    const tree = buildCommentTree([
      comment('old', null, '2026-01-01T08:00:00Z'),
      comment('new', null, '2026-01-01T09:00:00Z'),
      comment('reply-late', 'old', '2026-01-01T11:00:00Z'),
      comment('reply-early', 'old', '2026-01-01T10:00:00Z'),
    ])

    expect(tree.map((node) => node.comment.id)).toEqual(['new', 'old'])
    // Replies read in the order the conversation happened.
    expect(tree[1].children.map((node) => node.comment.id)).toEqual(['reply-early', 'reply-late'])
  })

  it('promotes an orphan to top level instead of dropping it', () => {
    // A reply whose parent is missing must still be shown: losing a comment is
    // worse than showing it in the wrong place.
    const tree = buildCommentTree([comment('orphan', 'gone', '2026-01-01T10:00:00Z')])
    expect(tree).toHaveLength(1)
    expect(tree[0].comment.id).toBe('orphan')
    expect(tree[0].depth).toBe(0)
  })
})

describe('visualDepth', () => {
  it('caps indentation for deep chains', () => {
    expect(visualDepth(0)).toBe(0)
    expect(visualDepth(3)).toBe(3)
    expect(visualDepth(4)).toBe(4)
    expect(visualDepth(50)).toBe(4)
  })
})
