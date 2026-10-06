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

/* ---------------------------------------------------------------------------
   Re-sending the code

   The escape hatch under the code boxes (a mail that never arrived, an expired
   code) needs a policy of its own, or it becomes one click per second of mail
   at a real inbox. Three rules, all pure and unit tested here so the arithmetic
   (which of them applies at a given moment, and the countdown boundary) cannot
   only be observed through a browser:

     - a cooldown after every send, including the FIRST request that put the
       code in the inbox (RESEND_COOLDOWN_MS, see lib/timings), so the action is
       never available the instant a code went out;
     - a ceiling on how many times the code may be re-sent in one flow, after
       which the action is gone and the copy points back at starting over - the
       user who genuinely lost three mails restarts the whole flow rather than
       sitting in front of a dead button;
     - a countdown that reads from the clock, so it cannot drift away from the
       lock.
   --------------------------------------------------------------------------- */

/**
 * Re-sends allowed per reset flow. Past this the action stops being offered:
 * three codes to one address is already one mailbox too many, and the user
 * still has the sign-in form to request a fresh one from.
 */
export const MAX_CODE_RESENDS = 3

export type ResendAvailability =
  /** The action can be used now. */
  | 'ready'
  /** A cooldown is still running; the label counts it down. */
  | 'waiting'
  /** The flow's re-send ceiling is reached; the action is gone. */
  | 'exhausted'

/**
 * Which state the re-send action is in.
 *
 * @param now current time in ms
 * @param readyAt when the cooldown ends (null when no send has been made yet,
 *   or once it has passed)
 * @param sends how many times the code has already been re-sent in this flow
 *
 * The order matters and is not just a code smell: the ceiling is checked
 * before the cooldown, so a user who used up their re-sends never gets a
 * "cooldown expired" moment and then sees the action offered again - it stays
 * gone for the rest of the flow.
 */
export function resendAvailability(
  now: number,
  readyAt: number | null,
  sends: number,
): ResendAvailability {
  if (sends >= MAX_CODE_RESENDS) return 'exhausted'
  if (readyAt !== null && readyAt > now) return 'waiting'
  return 'ready'
}

/**
 * Whole seconds left on the cooldown, rounded UP, so a lock 1ms in the future
 * still shows "1s" and never "0s" - a visible zero would read as "ready now"
 * while the button is still disabled. Zero once the cooldown is over.
 */
export function resendSecondsLeft(now: number, readyAt: number | null): number {
  if (readyAt === null) return 0
  return Math.max(0, Math.ceil((readyAt - now) / 1000))
}

/**
 * True once every box holds one digit. The reset step reveals the password
 * fields at that point, so it is a completeness check, not a validity one:
 * the code is only actually verified server-side on submit.
 */
export function isOtpComplete(slots: readonly string[]): boolean {
  return slots.length === OTP_LENGTH && slots.every((slot) => /^\d$/.test(slot))
}

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
