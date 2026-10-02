import { describe, expect, it } from 'vitest'
import { applyOtpInput, emptyOtpSlots, isOtpComplete, OTP_LENGTH } from '@/features/auth/otp'

/** The value the reset panel submits: the filled boxes, in order. */
function code(slots: readonly string[]): string {
  return slots.join('')
}

describe('applyOtpInput', () => {
  it('starts as four empty boxes', () => {
    expect(emptyOtpSlots()).toEqual(['', '', '', ''])
    expect(OTP_LENGTH).toBe(4)
  })

  it('writes a single digit into the box it came from, and moves on', () => {
    const edit = applyOtpInput(emptyOtpSlots(), 0, '1')
    expect(edit.slots).toEqual(['1', '', '', ''])
    expect(edit.focusIndex).toBe(1)
  })

  it('keeps a digit typed into a later box in that box', () => {
    // Regression: the boxes used to be one string, so an untouched box
    // collapsed and a digit typed into the fourth box slid to the first.
    const edit = applyOtpInput(emptyOtpSlots(), 3, '7')
    expect(edit.slots).toEqual(['', '', '', '7'])
    expect(code(edit.slots)).toBe('7')
    expect(edit.focusIndex).toBe(3)
  })

  it('builds the code across the boxes, one digit at a time', () => {
    let slots = emptyOtpSlots()
    for (const [index, digit] of ['1', '2', '3', '4'].entries()) {
      slots = applyOtpInput(slots, index, digit).slots
    }
    expect(slots).toEqual(['1', '2', '3', '4'])
    expect(code(slots)).toBe('1234')
  })

  it('spreads a pasted code from the box it was pasted into', () => {
    const fromFirst = applyOtpInput(emptyOtpSlots(), 0, '1234')
    expect(fromFirst.slots).toEqual(['1', '2', '3', '4'])
    expect(fromFirst.focusIndex).toBe(3)

    // Pasted into the third box, only what fits is written.
    const fromThird = applyOtpInput(emptyOtpSlots(), 2, '1234')
    expect(fromThird.slots).toEqual(['', '', '1', '2'])
  })

  it('drops the overflowing digits of a too-long paste', () => {
    expect(applyOtpInput(emptyOtpSlots(), 0, '123456').slots).toEqual(['1', '2', '3', '4'])
    expect(applyOtpInput(['1', '2', '3', '4'], 0, '98765').slots).toEqual(['9', '8', '7', '6'])
  })

  it('ignores non-digits, keeping the digits that came with them', () => {
    expect(applyOtpInput(emptyOtpSlots(), 0, 'a').slots).toEqual(['', '', '', ''])
    expect(applyOtpInput(emptyOtpSlots(), 0, '1 2-3.4').slots).toEqual(['1', '2', '3', '4'])
    // A change with no digits at all clears the box it came from.
    expect(applyOtpInput(['1', '2', '3', '4'], 2, '-').slots).toEqual(['1', '2', '', '4'])
  })

  it('overwrites the digit of a filled box instead of appending', () => {
    const edit = applyOtpInput(['1', '2', '3', '4'], 1, '9')
    expect(edit.slots).toEqual(['1', '9', '3', '4'])
    expect(edit.focusIndex).toBe(2)
  })

  it('clears a box when its digit is deleted', () => {
    const edit = applyOtpInput(['1', '2', '3', '4'], 1, '')
    expect(edit.slots).toEqual(['1', '', '3', '4'])
    // Backspace keeps the caret in the box it emptied, so the next keystroke
    // refills it rather than jumping.
    expect(edit.focusIndex).toBe(1)
  })

  it('leaves the slots it was given untouched', () => {
    const original = ['1', '2', '3', '4']
    applyOtpInput(original, 0, '9')
    expect(original).toEqual(['1', '2', '3', '4'])
  })
})

describe('isOtpComplete', () => {
  it('is false until the last box is filled', () => {
    // The reset panel reveals the password fields on this flip, so every
    // prefix has to stay false.
    expect(isOtpComplete(emptyOtpSlots())).toBe(false)
    expect(isOtpComplete(['1', '', '', ''])).toBe(false)
    expect(isOtpComplete(['1', '2', '', ''])).toBe(false)
    expect(isOtpComplete(['1', '2', '3', ''])).toBe(false)
    expect(isOtpComplete(['1', '2', '3', '4'])).toBe(true)
  })

  it('is false again when a digit is cleared', () => {
    expect(isOtpComplete(['1', '', '3', '4'])).toBe(false)
  })

  it('rejects a slot that is not exactly one digit', () => {
    expect(isOtpComplete(['1', '2', '3', '44'])).toBe(false)
    expect(isOtpComplete(['1', '2', '3', 'x'])).toBe(false)
    expect(isOtpComplete(['1', '2', '3', ' 4'])).toBe(false)
  })

  it('rejects the wrong number of boxes', () => {
    expect(isOtpComplete([])).toBe(false)
    expect(isOtpComplete(['1', '2', '3'])).toBe(false)
    expect(isOtpComplete(['1', '2', '3', '4', '5'])).toBe(false)
  })
})
