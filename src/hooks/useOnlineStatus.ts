import { useEffect, useState } from 'react'

/**
 * Mirrors the legacy online/offline event listeners (navigation.js:30-45).
 *
 * The first render is always ONLINE and the real value is read in the effect.
 * Reading `navigator` during render cannot be trusted here: under server
 * rendering Node exposes its own `navigator` global, whose `onLine` is
 * `undefined`, so the server rendered the banner visible while the client
 * (where onLine is true) rendered it hidden. React reports that as an
 * attribute hydration mismatch and does NOT patch it, which left "no internet
 * connection" stuck on screen for a visitor who was online. Starting from
 * `true` keeps both renders identical; an actually-offline visitor gets the
 * banner a frame later, when the effect has read the real value.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Only an explicit `false` means offline: a missing/undefined onLine (an
    // environment that does not implement it) must not show the banner.
    setOnline(navigator.onLine !== false)
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
