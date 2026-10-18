import { describe, expect, it } from 'vitest'
import { applyCodeInput, emptyCodeSlots, isCodeComplete } from '@/lib/codeInput'
import { sanitizeDeleteCodeInput } from '@/lib/deleteCode'

/**
 * The rules the reset code and the delete code share. The reset code's own
 * suite (authOtpInput.test.ts) covers the 4-digit case through applyOtpInput;
 * this one pins the generic rules, including the 6-character alphanumeric case
 * the delete code uses.
 */

const LENGTH = 6
const digitsOnly = (raw: string) => raw.replace(/\D/g, '')

describe('emptyCodeSlots', () => {
  it('is `length` empty boxes', () => {
    expect(emptyCodeSlots(0)).toEqual([])
    expect(emptyCodeSlots(4)).toEqual(['', '', '', ''])
    expect(emptyCodeSlots(LENGTH)).toHaveLength(LENGTH)
  })

  it('hands back a fresh array each call, so editing one cannot leak', () => {
    const first = emptyCodeSlots(LENGTH)
    first[0] = 'A'
    expect(emptyCodeSlots(LENGTH)).toEqual(['', '', '', '', '', ''])
  })
})

describe('isCodeComplete', () => {
  it('is false for an empty array or a gap, true once every box is filled', () => {
    expect(isCodeComplete([])).toBe(false)
    expect(isCodeComplete(['A', '', '', '', '', ''])).toBe(false)
    expect(isCodeComplete(['A', 'B', 'C', 'D', 'E', ''])).toBe(false)
    expect(isCodeComplete(['A', 'B', 'C', 'D', 'E', 'F'])).toBe(true)
  })

  it('rejects a box that holds more than one character', () => {
    expect(isCodeComplete(['A', 'B', 'C', 'D', 'E', 'FF'])).toBe(false)
  })

  it('only checks the box count, not what a box holds', () => {
    // Keeping the character class out is the sanitizer's job (see
    // sanitizeDeleteCodeInput); a space can never reach a box through the
    // component, so this stays a count-only check on purpose.
    expect(isCodeComplete(['A', 'B', 'C', 'D', 'E', ' '])).toBe(true)
  })
})

describe('applyCodeInput', () => {
  const sanitize = sanitizeDeleteCodeInput

  it('writes one character into the box it came from, and moves on', () => {
    const edit = applyCodeInput(emptyCodeSlots(LENGTH), 0, 'a', LENGTH, sanitize)
    expect(edit.slots).toEqual(['A', '', '', '', '', ''])
    expect(edit.focusIndex).toBe(1)
  })

  it('keeps a character typed into a later box in that box', () => {
    // Regression: with a single string the untouched boxes collapsed and a
    // character typed into the last box slid to the first.
    const edit = applyCodeInput(emptyCodeSlots(LENGTH), 5, 'z', LENGTH, sanitize)
    expect(edit.slots).toEqual(['', '', '', '', '', 'Z'])
    expect(edit.focusIndex).toBe(5)
  })

  it('spreads a pasted code from the box it was pasted into', () => {
    const fromFirst = applyCodeInput(emptyCodeSlots(LENGTH), 0, 'ab12cd', LENGTH, sanitize)
    expect(fromFirst.slots).toEqual(['A', 'B', '1', '2', 'C', 'D'])
    expect(fromFirst.focusIndex).toBe(5)

    // Pasted into the third box, only what fits is written.
    const fromThird = applyCodeInput(emptyCodeSlots(LENGTH), 2, 'ab12cd', LENGTH, sanitize)
    expect(fromThird.slots).toEqual(['', '', 'A', 'B', '1', '2'])
    expect(fromThird.focusIndex).toBe(5)
  })

  it('drops the overflow of a too-long paste, keeping what fits', () => {
    expect(applyCodeInput(emptyCodeSlots(LENGTH), 0, 'abcdefgh', LENGTH, sanitize).slots).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ])
    // A filled field is overwritten from the start, not appended to.
    const filled = ['A', 'B', 'C', 'D', 'E', 'F']
    expect(applyCodeInput(filled, 0, '12345678', LENGTH, sanitize).slots).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
  })

  it('overwrites the character of a filled box instead of appending', () => {
    const edit = applyCodeInput(['A', 'B', 'C', 'D', 'E', 'F'], 1, '9', LENGTH, sanitize)
    expect(edit.slots).toEqual(['A', '9', 'C', 'D', 'E', 'F'])
    expect(edit.focusIndex).toBe(2)
  })

  it('clears a box when its character is deleted', () => {
    const edit = applyCodeInput(['A', 'B', 'C', 'D', 'E', 'F'], 1, '', LENGTH, sanitize)
    expect(edit.slots).toEqual(['A', '', 'C', 'D', 'E', 'F'])
    // Backspace keeps the caret in the box it emptied, so the next keystroke
    // refills it rather than jumping.
    expect(edit.focusIndex).toBe(1)
  })

  it('never lets a disallowed character reach a box', () => {
    // A whole change the sanitizer rejects clears the box it came from.
    expect(applyCodeInput(['A', 'B', 'C', 'D', 'E', 'F'], 2, '-', LENGTH, sanitize).slots).toEqual([
      'A',
      'B',
      '',
      'D',
      'E',
      'F',
    ])
    // The digits-only sanitizer keeps the digits that came with the junk.
    expect(applyCodeInput(emptyCodeSlots(4), 0, '1 2-3.4', 4, digitsOnly).slots).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })

  it('leaves the slots it was given untouched', () => {
    const original = ['A', 'B', 'C', 'D', 'E', 'F']
    applyCodeInput(original, 0, '9', LENGTH, sanitize)
    expect(original).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })
})
