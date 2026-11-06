import { useEffect, type RefObject } from 'react'

/**
 * Keeps a donut callout inside the viewport.
 *
 * The callout is placed with `left`/`top` percentages plus a side-specific
 * `transform` (see .mix-slice-tooltip[data-side]), so the clamp writes to the
 * separate `translate` property instead of overwriting that transform: the two
 * compose, and the arrow keeps pointing at its slice. Near an edge the body is
 * pulled back just far enough to stay on screen, which is better than letting
 * the page clip it away.
 *
 * `activeKey` changes whenever the callout re-anchors (a different slice, or
 * the same one reopened), because a translate left from the previous placement
 * would then be wrong.
 */
export function useDonutTooltipClamp(
  tooltipRef: RefObject<HTMLElement | null>,
  activeKey: string | number | null,
  margin = 8,
): void {
  useEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip) return

    const clamp = () => {
      // Always measure from the unshifted position, so repeated passes cannot
      // accumulate drift.
      tooltip.style.translate = ''
      const rect = tooltip.getBoundingClientRect()
      const overflowStart = margin - rect.left
      const overflowEnd = rect.right - (window.innerWidth - margin)
      const overflowTop = margin - rect.top
      const overflowBottom = rect.bottom - (window.innerHeight - margin)
      const shiftX =
        overflowStart > 0 ? overflowStart : overflowEnd > 0 ? -overflowEnd : 0
      const shiftY =
        overflowTop > 0 ? overflowTop : overflowBottom > 0 ? -overflowBottom : 0
      if (shiftX !== 0 || shiftY !== 0) {
        tooltip.style.translate = `${Math.round(shiftX)}px ${Math.round(shiftY)}px`
      }
    }

    // Fonts and content width can settle after the first paint.
    clamp()
    const raf = requestAnimationFrame(clamp)
    const observer = new ResizeObserver(clamp)
    observer.observe(tooltip)
    window.addEventListener('resize', clamp)
    window.addEventListener('scroll', clamp, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', clamp)
      window.removeEventListener('scroll', clamp, { capture: true })
    }
  }, [tooltipRef, activeKey, margin])
}
