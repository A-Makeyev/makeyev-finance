import { describe, expect, it } from 'vitest'
import { isWithinLimit, windowStartSeconds } from '@/server/ratelimit'

/**
 * The pure parts of the route-handler rate limiter. Better Auth only limits
 * its own /api/auth/* endpoints, so this is what throttles /api/mixes and
 * /api/comments - the window math and the boundary are the bug-prone bits.
 */

describe('windowStartSeconds', () => {
  it('floors to the start of the fixed window', () => {
    expect(windowStartSeconds(0, 60)).toBe(0)
    expect(windowStartSeconds(59_999, 60)).toBe(0)
    expect(windowStartSeconds(60_000, 60)).toBe(60)
    expect(windowStartSeconds(125_000, 60)).toBe(120)
  })

  it('supports a window that is not a whole minute', () => {
    expect(windowStartSeconds(10_000, 10)).toBe(10)
    expect(windowStartSeconds(19_999, 10)).toBe(10)
    expect(windowStartSeconds(20_000, 10)).toBe(20)
  })
})

describe('isWithinLimit', () => {
  it('allows exactly max requests, not one more', () => {
    expect(isWithinLimit(1, 5)).toBe(true)
    expect(isWithinLimit(5, 5)).toBe(true)
    expect(isWithinLimit(6, 5)).toBe(false)
  })

  it('rejects everything when the max is zero', () => {
    expect(isWithinLimit(1, 0)).toBe(false)
  })
})
