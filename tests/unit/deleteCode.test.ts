import { describe, expect, it, vi } from 'vitest'
import { generateDeleteCode } from '@/server/auth/deleteCode'
import {
  DELETE_CODE_ALPHABET,
  DELETE_CODE_LENGTH,
  DELETE_CODE_TTL_SECONDS,
  deleteAccountIdentifier,
  normalizeDeleteCode,
  sanitizeDeleteCodeInput,
} from '@/lib/deleteCode'

describe('the delete code shape', () => {
  it('uses an alphabet with none of the pairs that get misread', () => {
    // I/1 and O/0 are exactly what a person reading a code off a phone gets
    // wrong, so neither member of either pair is allowed.
    expect(DELETE_CODE_ALPHABET).not.toContain('I')
    expect(DELETE_CODE_ALPHABET).not.toContain('O')
    expect(DELETE_CODE_ALPHABET).not.toContain('0')
    expect(DELETE_CODE_ALPHABET).not.toContain('1')
  })

  it('has no repeated character, so the draw stays uniform', () => {
    expect(new Set(DELETE_CODE_ALPHABET).size).toBe(DELETE_CODE_ALPHABET.length)
  })

  it('expires in 30 minutes, matching the copy the mail carries', () => {
    expect(DELETE_CODE_TTL_SECONDS).toBe(30 * 60)
  })
})

describe('normalizeDeleteCode', () => {
  it('uppercases and strips the spacing a client or a person may add', () => {
    expect(normalizeDeleteCode('ab-12 cd')).toBe('AB12CD')
    expect(normalizeDeleteCode('  a b 1 2 c d ')).toBe('AB12CD')
  })

  it('leaves an already-clean code untouched', () => {
    expect(normalizeDeleteCode('AB12CD')).toBe('AB12CD')
  })

  it('does not invent characters', () => {
    expect(normalizeDeleteCode('')).toBe('')
    expect(normalizeDeleteCode('---')).toBe('')
  })
})

describe('sanitizeDeleteCodeInput', () => {
  it('uppercases letters and keeps digits, one code box at a time', () => {
    expect(sanitizeDeleteCodeInput('a')).toBe('A')
    expect(sanitizeDeleteCodeInput('7')).toBe('7')
  })

  it('strips whatever a paste from a mail client drags along', () => {
    // Spaces, hyphens, and the mail's own punctuation never reach a box.
    expect(sanitizeDeleteCodeInput('ab 12-cd')).toBe('AB12CD')
    expect(sanitizeDeleteCodeInput('ab, 12.cd!')).toBe('AB12CD')
  })

  it('leaves an already-clean code untouched', () => {
    expect(sanitizeDeleteCodeInput('AB12CD')).toBe('AB12CD')
  })

  it('drops a change with nothing usable in it', () => {
    expect(sanitizeDeleteCodeInput('')).toBe('')
    expect(sanitizeDeleteCodeInput('-- --')).toBe('')
  })
})

describe('deleteAccountIdentifier', () => {
  it("uses the prefix Better Auth's own /delete-user consumes", () => {
    // The library looks the code up as `delete-account-${token}` and the modal
    // hands the code back as `token`, so the two prefixes must match exactly.
    expect(deleteAccountIdentifier('AB12CD')).toBe('delete-account-AB12CD')
  })
})

describe('generateDeleteCode', () => {
  it('draws one character per position from the alphabet', () => {
    const picks = [0, 1, 2, 3, 4, 5]
    const pick = vi.fn((maxExclusive: number) => {
      expect(maxExclusive).toBe(DELETE_CODE_ALPHABET.length)
      return picks.shift()!
    })

    expect(generateDeleteCode(pick)).toBe('234567')
    expect(pick).toHaveBeenCalledTimes(DELETE_CODE_LENGTH)
  })

  it('always returns a code of the right length from the alphabet', () => {
    for (let run = 0; run < 200; run += 1) {
      const code = generateDeleteCode()
      expect(code).toHaveLength(DELETE_CODE_LENGTH)
      expect([...code].every((char) => DELETE_CODE_ALPHABET.includes(char))).toBe(true)
    }
  })
})
