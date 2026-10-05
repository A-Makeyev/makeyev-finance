import { describe, expect, it } from 'vitest'
import { shouldHideFooter } from '@/lib/siteChrome'

describe('shouldHideFooter', () => {
  it('hides the footer on the sign-in and profile surfaces', () => {
    expect(shouldHideFooter('/login')).toBe(true)
    expect(shouldHideFooter('/profile')).toBe(true)
  })

  it('keeps the footer everywhere else', () => {
    // Spot checks for the pages around them, including ones whose names start
    // with the same prefix (a startsWith bug would show here).
    for (const pathname of ['/', '/calculators', '/services', '/articles', '/logins', '/profiles']) {
      expect(shouldHideFooter(pathname), pathname).toBe(false)
    }
  })
})


