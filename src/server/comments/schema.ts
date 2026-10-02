import { z } from 'zod'

/**
 * Article comment validation. Every field arrives from the client and is
 * re-validated here; the moderation check runs in the route handler, after
 * this passes.
 */

export const MAX_COMMENT_LENGTH = 600

/**
 * Its own budget, separate from the auth rules and from saved mixes. Better
 * Auth's own limiter never sees these routes, so without this a comment loop
 * would be entirely unthrottled.
 */
export const COMMENT_RATE_LIMIT = { windowSeconds: 60, max: 5 } as const

export const commentInputSchema = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
  /** A reply target; the server verifies it belongs to the same article. */
  parentId: z.string().max(64).nullish(),
})

export type CommentInput = z.infer<typeof commentInputSchema>

/** Editing reuses the body rules; the target cannot be changed. */
export const commentEditSchema = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
})

export type CommentEditInput = z.infer<typeof commentEditSchema>
