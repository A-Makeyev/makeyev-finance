import { describe, expect, it } from 'vitest'
import { navStartsSolid, shouldHideFooter } from '@/lib/siteChrome'

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

describe('navStartsSolid', () => {
  it('starts solid on the profile page', () => {
    expect(navStartsSolid('/profile')).toBe(true)
  })

  it('keeps the transparent top everywhere else', () => {
    // The hero pages and the auth screens all have a dark first screen for the
    // glass to sit on; `/profiles` guards the exact-match rule.
    for (const pathname of ['/', '/calculators', '/services', '/articles', '/login', '/profiles']) {
      expect(navStartsSolid(pathname), pathname).toBe(false)
    }
  })
})


