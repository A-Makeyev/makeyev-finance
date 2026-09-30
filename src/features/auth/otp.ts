/**
 * Pure editing rules for the password-reset code: four square inputs, one
 * digit each, all sharing a single value.
 *
 * Kept out of the component (and free of React) so the rules that are easy to
 * get wrong - which box a change belongs to, what a paste or the OS
 * one-time-code autofill does, what a non-digit does - are unit tested with
 * concrete slots instead of only through a browser.
 */

/** The reset code is 4 digits, one square input per digit. */
export const OTP_LENGTH = 4

/** Four empty boxes. A fresh array each call, so it is always safe to edit. */
export function emptyOtpSlots(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => '')
}

export interface OtpEdit {
  /** The slots after the edit, always exactly OTP_LENGTH long. */
  slots: string[]
  /** The box focus should land on once the edit is applied. */
  focusIndex: number
}

/**
 * Applies one change coming from box `index` to `slots`.
 *
 * - A single digit overwrites that one box; an emptied change clears it.
 * - More than one digit spreads from `index` onward: that is a paste, or the
 *   OS one-time-code autofill dropping the whole code into the first box.
 * - Non-digits never reach a slot.
 * - The result is always OTP_LENGTH slots, so boxes that were not touched stay
 *   empty instead of collapsing: typing into the fourth box keeps the digit
 *   there rather than sliding it to the first.
 */
export function applyOtpInput(slots: readonly string[], index: number, raw: string): OtpEdit {
  const digits = raw.replace(/\D/g, '')
  const next = [...slots]

  if (!digits) {
    next[index] = ''
    return { slots: next, focusIndex: index }
  }

  // Typing into a filled box overwrites its digit instead of being swallowed.
  // The last box can only take the final digit of a spread.
  const write = index < OTP_LENGTH - 1 && digits.length > 1 ? digits : digits.slice(-1)
  for (let i = 0; i < write.length && index + i < OTP_LENGTH; i++) {
    next[index + i] = write[i]
  }

  // Move focus to the box after the last digit just written.
  return { slots: next, focusIndex: Math.min(index + write.length, OTP_LENGTH - 1) }
}
