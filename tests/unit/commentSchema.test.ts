import { describe, expect, it } from 'vitest'
import {
  MAX_COMMENT_LENGTH,
  commentEditSchema,
  commentInputSchema,
} from '@/server/comments/schema'

/** Shape validation only: the moderation check is tested separately. */

describe('commentInputSchema', () => {
  it('accepts a plain comment', () => {
    expect(commentInputSchema.safeParse({ body: 'thanks!' }).success).toBe(true)
  })

  it('trims the body', () => {
    expect(commentInputSchema.parse({ body: '  hi  ' }).body).toBe('hi')
  })

  it('rejects an empty or whitespace-only body', () => {
    expect(commentInputSchema.safeParse({ body: '' }).success).toBe(false)
    expect(commentInputSchema.safeParse({ body: '   ' }).success).toBe(false)
  })

  it('bounds the body length', () => {
    expect(commentInputSchema.safeParse({ body: 'x'.repeat(MAX_COMMENT_LENGTH) }).success).toBe(true)
    expect(
      commentInputSchema.safeParse({ body: 'x'.repeat(MAX_COMMENT_LENGTH + 1) }).success,
    ).toBe(false)
  })

  it('accepts an absent, null or string parentId and rejects an oversized one', () => {
    expect(commentInputSchema.safeParse({ body: 'hi', parentId: null }).success).toBe(true)
    expect(commentInputSchema.safeParse({ body: 'hi', parentId: '507f1f77bcf86cd799439011' }).success).toBe(true)
    expect(commentInputSchema.safeParse({ body: 'hi', parentId: 'x'.repeat(65) }).success).toBe(false)
  })
})

describe('commentEditSchema', () => {
  it('validates the same body rules', () => {
    expect(commentEditSchema.safeParse({ body: 'fixed typo' }).success).toBe(true)
    expect(commentEditSchema.safeParse({ body: '   ' }).success).toBe(false)
  })
})
