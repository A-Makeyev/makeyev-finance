'use client'

/**
 * Remembers that a signed-out visitor asked to sign in so their comparison
 * can be saved. The compare page reads it once after the session appears and
 * opens the save dialog, so the visitor does not have to find the save control
 * again after authenticating.
 *
 * sessionStorage rather than the Zustand store: the login page may be a full
 * navigation (social sign-in), and a module-level flag would not survive that
 * while sessionStorage does, per tab.
 */

const KEY = 'comparison_save_pending'

export function markPendingComparisonSave(): void {
  try {
    window.sessionStorage.setItem(KEY, '1')
  } catch {
    // Private mode or a blocked storage API: the sign-in still works, only the
    // automatic re-open after returning is lost.
  }
}

/** Reads and clears the flag, so it can only trigger one save dialog. */
export function takePendingComparisonSave(): boolean {
  try {
    const pending = window.sessionStorage.getItem(KEY) === '1'
    window.sessionStorage.removeItem(KEY)
    return pending
  } catch {
    return false
  }
}
