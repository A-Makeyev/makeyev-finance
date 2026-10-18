/**
 * Pure editing rules for a code field drawn as "one square box per character":
 * the 4-digit password-reset code and the 6-character account-deletion code are
 * the same widget, so the rules live here once and both use them.
 *
 * Kept free of React so the parts that are easy to get wrong ~ which box a
 * change belongs to, what a paste or the OS one-time-code autofill does, what a
 * disallowed character does ~ are unit tested with concrete slots instead of
 * only through a browser. A field is always exactly `length` slots, so a box
 * left untouched stays empty instead of collapsing into its neighbour on the
 * next edit.
 */

export interface CodeEdit {
  /** The slots after the edit, always exactly `length` long. */
  slots: string[]
  /** The box focus should land on once the edit is applied. */
  focusIndex: number
}

/** `length` empty boxes. A fresh array each call, so it is always safe to edit. */
export function emptyCodeSlots(length: number): string[] {
  return Array.from({ length }, () => '')
}

/**
 * True once every box holds exactly one character, and there is at least one
 * box. This is a completeness check, not a validity one: whether the code is
 * actually accepted is only decided server-side on submit.
 */
export function isCodeComplete(slots: readonly string[]): boolean {
  return slots.length > 0 && slots.every((slot) => slot.length === 1)
}

/**
 * Applies one change coming from box `index` to `slots`.
 *
 * - A single allowed character overwrites that one box; an emptied change clears it.
 * - More than one character spreads from `index` onward: that is a paste, or the
 *   OS one-time-code autofill dropping the whole code into the first box.
 * - `sanitize` decides what a box may hold (digits only, or letters and digits);
 *   characters it strips never reach a slot.
 * - The result is always `length` slots, so boxes that were not touched stay
 *   empty instead of collapsing: typing into the last box keeps the character
 *   there rather than sliding it to the first.
 */
export function applyCodeInput(
  slots: readonly string[],
  index: number,
  raw: string,
  length: number,
  sanitize: (raw: string) => string,
): CodeEdit {
  const chars = sanitize(raw)
  const next = [...slots]

  if (!chars) {
    next[index] = ''
    return { slots: next, focusIndex: index }
  }

  // Typing into a filled box overwrites its character instead of being
  // swallowed. The last box can only take the final character of a spread.
  const write = index < length - 1 && chars.length > 1 ? chars : chars.slice(-1)
  for (let i = 0; i < write.length && index + i < length; i++) {
    next[index + i] = write[i]
  }

  // Move focus to the box after the last character just written.
  return { slots: next, focusIndex: Math.min(index + write.length, length - 1) }
}
