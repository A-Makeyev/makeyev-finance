/**
 * Cross-tab signal for a deleted account.
 *
 * Deletion is confirmed in one place (the page the mailed link opens), but the
 * account's other open tabs keep rendering a page that was server-rendered
 * while it still existed. Cookies are shared, so those tabs are already signed
 * out server-side; without a signal they just sit there showing the identity of
 * an account that is gone (user-reported).
 *
 * localStorage is the transport: writing a key fires `storage` in every OTHER
 * tab of the same origin (never in the writer) with no extra connection or
 * handshake. The value is a timestamp, so a repeated write still counts as a
 * new value and a double announcement is harmless.
 */

const ACCOUNT_DELETED_KEY = 'account_deleted_at'

/** Tells the other open tabs the account is gone. The caller navigates itself. */
export function announceAccountDeleted(): void {
  try {
    window.localStorage.setItem(ACCOUNT_DELETED_KEY, String(Date.now()))
  } catch {
    // Storage unavailable (private mode, quota): the other tabs still hit the
    // gate on their next navigation, they just do not leave on their own.
  }
}

/**
 * Runs `handler` when another tab announces a deletion, and returns the
 * unsubscribe. Never fires in the tab that announced it.
 */
export function onAccountDeleted(handler: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key !== ACCOUNT_DELETED_KEY || !event.newValue) return
    handler()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
