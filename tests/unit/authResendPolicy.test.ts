/**
 * The password-reset "send a new code" policy: the cooldown that keeps it
 * from being one click per second, the countdown that explains it, and the
 * ceiling that eventually retires it.
 *
 * Pure arithmetic, so it is tested here against exact values and boundaries
 * rather than only through the browser: the failure that matters is a user
 * either locked out with a button that never unlocks, or able to mail one
 * address every few seconds.
 */
import { describe, expect, it } from 'vitest'
import { MAX_CODE_RESENDS, resendAvailability, resendSecondsLeft } from '@/features/auth/otp'
import { RESEND_COOLDOWN_MS } from '@/lib/timings'

/** A fixed instant, so nothing here depends on the wall clock. */
const NOW = 1_700_000_000_000

describe('resendAvailability', () => {
  it('is ready before anything has been sent', () => {
    expect(resendAvailability(NOW, null, 0)).toBe('ready')
  })

  it('locks the instant a code goes out, including the FIRST one', () => {
    // The initial request already put a code in the inbox, so the escape
    // hatch is not free the moment the boxes appear.
    expect(resendAvailability(NOW, NOW + RESEND_COOLDOWN_MS, 0)).toBe('waiting')
  })

  it('unlocks exactly when the cooldown is over, not a millisecond early', () => {
    expect(resendAvailability(NOW, NOW - 1, 0)).toBe('ready')
    // The last millisecond of the lock.
    expect(resendAvailability(NOW, NOW + 1, 0)).toBe('waiting')
  })

  it('retires the action at the ceiling, even once the cooldown has passed', () => {
    const after = NOW - RESEND_COOLDOWN_MS
    expect(resendAvailability(after, after, MAX_CODE_RESENDS)).toBe('exhausted')
    // Above the ceiling too: nothing frees it again within the flow.
    expect(resendAvailability(after, after, MAX_CODE_RESENDS + 5)).toBe('exhausted')
  })

  it('reports the ceiling ahead of a running cooldown', () => {
    // Both true at once: the ceiling wins, so the button cannot reappear the
    // instant the lock runs out.
    expect(resendAvailability(NOW, NOW + RESEND_COOLDOWN_MS, MAX_CODE_RESENDS)).toBe('exhausted')
  })

  it('keeps serving re-sends below the ceiling', () => {
    const past = NOW - 1
    for (let sends = 0; sends < MAX_CODE_RESENDS; sends++) {
      expect(resendAvailability(NOW, past, sends), `after ${sends} re-sends`).toBe('ready')
    }
  })
})

describe('resendSecondsLeft', () => {
  it('is zero before the first send', () => {
    expect(resendSecondsLeft(NOW, null)).toBe(0)
  })

  it('counts a full cooldown down', () => {
    expect(resendSecondsLeft(NOW, NOW + RESEND_COOLDOWN_MS)).toBe(30)
  })

  it('never shows zero while the action is still locked', () => {
    // 1ms left rounds UP to a visible 1s. A "0s" label next to a disabled
    // button reads as "ready now" and is a lie the user acts on.
    expect(resendSecondsLeft(NOW, NOW + 1)).toBe(1)
    expect(resendSecondsLeft(NOW, NOW + 999)).toBe(1)
  })

  it('rounds partial seconds up, so the lock is never shown as over early', () => {
    expect(resendSecondsLeft(NOW, NOW + 29_001)).toBe(30)
    expect(resendSecondsLeft(NOW, NOW + 28_500)).toBe(29)
  })

  it('clamps to zero once the cooldown is over', () => {
    expect(resendSecondsLeft(NOW, NOW)).toBe(0)
    expect(resendSecondsLeft(NOW, NOW - 5_000)).toBe(0)
  })
})

describe('the limits agree with the server', () => {
  it('cannot out-run the 3-per-minute server limit', () => {
    // src/server/auth allows 3 requests per minute per IP on the OTP request
    // endpoint. The client lock is a UX floor, so it has to be AT LEAST as
    // slow as that budget - a faster client cooldown just walks the user into
    // a 429 instead of a code.
    const perMinute = 60_000 / RESEND_COOLDOWN_MS
    expect(perMinute, 'client cooldown vs the server budget').toBeLessThanOrEqual(3)
    // And long enough that a lost mail is not a 10-second wait, which is the
    // whole reason the flow offers the escape hatch at all.
    expect(RESEND_COOLDOWN_MS).toBeGreaterThanOrEqual(30_000)
  })
})