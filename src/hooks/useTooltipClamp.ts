import { useEffect } from 'react'

/**
 * Keeps a chart tooltip fully inside its plot container. The tooltip is
 * absolutely positioned and centered on the hovered point (`left` in
 * percent + `translateX(-50%)`) and raised above it with the `translate`
 * property; near a plot edge the overhanging half gets clipped (the page
 * clips overflow site-wide), so this measures the rendered tooltip against
 * the container's box and adjusts the transform to pull it back: centered
 * when it fits, shifted just clear of the edge when it does not. A high
 * point leaves no room above, so the same pass pushes the tooltip back down
 * inside the plot. Owned imperatively (no React state) so it can never feed
 * back into its own measurement; re-runs whenever the hovered point or the
 * tooltip/container sizes change. The tooltip must render inside a
 * `position: relative` container and own no other transform.
 */
export function useTooltipClamp(
  /** The tooltip element. */
  tooltipRef: React.RefObject<HTMLElement | null>,
  /** The positioning anchor (the relative plot container). */
  containerRef: React.RefObject<HTMLElement | null>,
  /** Changes whenever the tooltip re-anchors or resizes - re-clamps then. */
  activeKey: string | number | null,
): void {
  useEffect(() => {
    const tooltip = tooltipRef.current
    const container = containerRef.current
    if (!tooltip || !container) return

    const compute = () => {
      // Measure from the centered position so the clamp is independent of
      // the transform a previous pass left behind (idempotent, no drift). The
      // tooltip's own `translate` (it sits above the point) is a separate
      // property, so it stays applied to this measurement.
      tooltip.style.transform = 'translateX(-50%)'
      const tipRect = tooltip.getBoundingClientRect()
      const boxRect = container.getBoundingClientRect()
      const overStart = boxRect.left - tipRect.left // >0: pokes out left
      const overEnd = tipRect.right - boxRect.right // >0: pokes out right
      const shiftX = overStart > 0 ? overStart : overEnd > 0 ? -overEnd : 0
      // Vertically the callout hangs above the data point. A point near the
      // plot's top edge has no room above it, so pull the tooltip back inside
      // rather than letting it escape the chart.
      const overTop = boxRect.top - tipRect.top // >0: pokes out above
      const overBottom = tipRect.bottom - boxRect.bottom // >0: pokes out below
      const shiftY = overTop > 0 ? overTop : overBottom > 0 ? -overBottom : 0
      tooltip.style.transform =
        shiftX === 0 && shiftY === 0
          ? 'translateX(-50%)'
          : `translate(calc(-50% + ${shiftX}px), ${shiftY}px)`
    }

    // Layout (fonts, content width) can land after the first paint.
    compute()
    const raf = requestAnimationFrame(compute)
    const observer = new ResizeObserver(compute)
    observer.observe(tooltip)
    observer.observe(container)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [tooltipRef, containerRef, activeKey])
}
