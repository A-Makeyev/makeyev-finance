import { describe, expect, it } from 'vitest'
import { maskEmail } from '@/lib/mask'

/**
 * The address shown on the sign-up confirmation. It has to stay recognisable to
 * its owner while not being readable in full, so the exact split matters.
 */
describe('maskEmail', () => {
  it('keeps the first half of the local part and hides the rest', () => {
    expect(maskEmail('user@example.test')).toBe('us••@example.test')
  })

  it('hides the smaller half of an odd-length local part', () => {
    // 5 characters: 3 visible, 2 hidden.
    expect(maskEmail('dana1@example.test')).toBe('dan••@example.test')
  })

  it('keeps the domain and a dotted local part readable', () => {
    expect(maskEmail('anatoly.makeyev@gmail.com')).toBe('anatoly.•••••••@gmail.com')
  })

  it('leaves an address with nothing to hide unchanged', () => {
    // One character before the @ cannot be half-hidden; mangling it would make
    // the address unrecognisable instead of private.
    expect(maskEmail('a@b.com')).toBe('a@b.com')
    expect(maskEmail('@example.test')).toBe('@example.test')
    expect(maskEmail('not-an-email')).toBe('not-an-email')
    expect(maskEmail('')).toBe('')
  })
})
