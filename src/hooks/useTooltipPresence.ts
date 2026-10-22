import { useEffect, useState } from 'react'

/**
 * How long a callout stays mounted after it closes, so its CSS exit transition
 * can run. Keep in step with `.chart-tooltip` in globals.css.
 */
export const TOOLTIP_FADE_MS = 160

/**
 * Keeps a hover callout mounted for its fade-out. Returns whether to render
 * it; the caller marks the element with `data-open` so CSS fades it in on
 * mount and out once it closes.
 *
 * The callout's content and position have to survive the fade, so callers keep
 * their hovered slice/period in state and only drop a separate "pointing"
 * flag. The element is rendered immediately when a hover opens (the state
 * update from the effect lands a frame later, too late to be the trigger).
 */
export function useTooltipPresence(open: boolean): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (open) {
      setHeld(true)
      return
    }
    // Not re-mounted on open: just stop holding once the fade has finished.
    const timer = window.setTimeout(() => setHeld(false), TOOLTIP_FADE_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  return open || held
}
