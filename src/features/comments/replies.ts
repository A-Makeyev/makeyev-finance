import type { CommentNode } from './tree'

/**
 * Reply pagination under a comment.
 *
 * Top-level comments already page (see COMMENT_PAGE_SIZE in CommentsSection);
 * replies used to render in full, so one popular comment could push the rest of
 * the thread off the page. A thread now draws its first REPLY_PAGE_SIZE replies
 * and a control to reveal a page at a time. Kept pure so the clamp (and the
 * off-by-one that would hide a reply or slice past the end) is unit tested here
 * rather than only through a browser.
 */

/** Replies drawn under a comment before the "show more replies" control. */
export const REPLY_PAGE_SIZE = 3

/**
 * How many of `total` replies to draw once the reader has asked to reveal
 * `revealed`. The first REPLY_PAGE_SIZE always show, each control press adds a
 * page, and the result is clamped to `total` so a thread that shrank (a reply
 * deleted in another tab) can never slice past its end.
 */
export function shownReplyCount(total: number, revealed: number): number {
  return Math.min(total, Math.max(REPLY_PAGE_SIZE, revealed))
}

/** Replies still behind the control: 0 once every reply is shown. */
export function hiddenReplyCount(total: number, revealed: number): number {
  return total - shownReplyCount(total, revealed)
}

/**
 * The reveal counts that make `path` (an outermost-to-innermost list of comment
 * ids from `ancestorPath`) visible: every ancestor along it must show at least
 * the position of the next step. Merged over `current`, so whatever the reader
 * already revealed is kept. Used when a `#comment-` link lands on a reply that
 * this pagination is hiding.
 */
export function withRevealedPath(
  current: Record<string, number>,
  roots: CommentNode[],
  path: string[],
): Record<string, number> {
  let next = current
  let level = roots
  for (let i = 0; i < path.length - 1; i += 1) {
    const parent = level.find((node) => node.comment.id === path[i])
    if (!parent) return next
    const childIndex = parent.children.findIndex((node) => node.comment.id === path[i + 1])
    if (childIndex < 0) return next
    const needed = childIndex + 1
    if ((next[path[i]] ?? REPLY_PAGE_SIZE) < needed) {
      if (next === current) next = { ...current }
      next[path[i]] = needed
    }
    level = parent.children
  }
  return next
}
