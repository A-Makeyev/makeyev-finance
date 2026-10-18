import type { CommentDto } from './types'

/**
 * Turn the API's flat, oldest-first list into the threaded view.
 *
 * Pure so the ordering and the orphan handling are unit-tested rather than
 * only exercised through a rendered page.
 *
 * Ordering: top-level comments newest first (the usual default for this kind of
 * content), replies chronological inside their thread so a conversation reads
 * in the order it happened.
 *
 * Orphans: a reply whose parent is not in the list (a page of a paginated
 * thread, an unexpected deletion) is promoted to top level rather than dropped.
 * Losing a comment is worse than showing it in the wrong place.
 */

export interface CommentNode {
  comment: CommentDto
  children: CommentNode[]
  /** 0 for a top-level comment; used for the visual indentation cap. */
  depth: number
}

function byCreatedAtAscending(a: CommentNode, b: CommentNode): number {
  return Date.parse(a.comment.createdAt) - Date.parse(b.comment.createdAt)
}

export function buildCommentTree(comments: CommentDto[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  for (const comment of comments) {
    nodes.set(comment.id, { comment, children: [], depth: 0 })
  }

  const roots: CommentNode[] = []
  for (const comment of comments) {
    const node = nodes.get(comment.id)
    if (!node) continue
    const parent = comment.parentId ? nodes.get(comment.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const assignDepth = (node: CommentNode, depth: number): void => {
    node.depth = depth
    node.children.sort(byCreatedAtAscending)
    for (const child of node.children) assignDepth(child, depth + 1)
  }

  // Newest first at the top level only.
  roots.sort((a, b) => Date.parse(b.comment.createdAt) - Date.parse(a.comment.createdAt))
  for (const root of roots) assignDepth(root, 0)

  return roots
}

/**
 * The comments between the outermost one and `id`, outermost first (both ends
 * included), or null when `id` is not in the tree.
 *
 * A linked-to comment (the profile's reply cards link to /articles/<slug>
 * #comment-<id>) can be hidden twice over: its top-level comment may sit beyond
 * the page of comments, and any ancestor may be holding it behind that
 * comment's "show more replies" control. Walking this path is how both are
 * revealed before the scroll, without guessing where in the tree it lives.
 */
export function ancestorPath(nodes: CommentNode[], id: string): string[] | null {
  const walk = (list: CommentNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      const path = [...trail, node.comment.id]
      if (node.comment.id === id) return path
      const found = walk(node.children, path)
      if (found) return found
    }
    return null
  }
  return walk(nodes, [])
}

/**
 * Visual depth cap: replies deeper than this render at the cap instead of
 * indenting further, which keeps a long chain readable on a phone.
 */
export const MAX_VISUAL_DEPTH = 4

export function visualDepth(depth: number): number {
  return Math.min(depth, MAX_VISUAL_DEPTH)
}
