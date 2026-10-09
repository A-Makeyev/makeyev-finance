import { describe, expect, it } from 'vitest'
import { safeNextPath } from '@/lib/safeNextPath'

/**
 * The sign-in page follows `?next=` after a successful sign-in, so a value the
 * URL can set must never be able to leave this app.
 */
describe('safeNextPath', () => {
  it('keeps an in-app path', () => {
    expect(safeNextPath('/profile')).toBe('/profile')
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath('/en/profile')).toBe('/en/profile')
    expect(safeNextPath('/articles/mortgage-decisions')).toBe('/articles/mortgage-decisions')
  })

  it('keeps a query that belongs to the path', () => {
    // The deletion link's token travels this way, so it must survive.
    expect(safeNextPath('/profile?delete=tok123')).toBe('/profile?delete=tok123')
    expect(safeNextPath('/en/profile?delete=tok123')).toBe('/en/profile?delete=tok123')
  })

  it('falls back to the home page for an absolute URL', () => {
    expect(safeNextPath('https://evil.test')).toBe('/')
    expect(safeNextPath('http://evil.test/login')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })

  it('falls back for a protocol-relative or backslash target', () => {
    // `//host` and `/\host` are read as an origin by browsers, so a leading
    // slash alone is not proof that the target is local.
    expect(safeNextPath('//evil.test')).toBe('/')
    expect(safeNextPath('/\\evil.test')).toBe('/')
    expect(safeNextPath('\\\\evil.test')).toBe('/')
  })

  it('falls back for a relative path, which the router would resolve elsewhere', () => {
    expect(safeNextPath('profile')).toBe('/')
    expect(safeNextPath('?delete=1')).toBe('/')
  })

  it('falls back when there is no target at all', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })
})
