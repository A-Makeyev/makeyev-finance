import { useState } from 'react'

/**
 * Tracks where the pointer sits vertically inside a chart's plot box, as a
 * percentage of its height. Hover tooltips anchor to this value so the callout
 * always sits just above the cursor instead of at a fixed height (or above a
 * data line the cursor may be nowhere near).
 *
 * The value clamps to 0-100 so a drag slightly outside the SVG can never push
 * the tooltip's anchor out of the positioning box. `useTooltipClamp` still
 * pulls the rendered callout back inside the plot when it would overhang the
 * top or bottom edge.
 */
export function useTooltipPointer(): {
  pointerY: number
  trackPointer: (event: { clientY: number }, element: Element | null) => void
} {
  const [pointerY, setPointerY] = useState(0)

  const trackPointer = (event: { clientY: number }, element: Element | null) => {
    if (!element) return
    const bounds = element.getBoundingClientRect()
    if (bounds.height <= 0) return
    const percent = ((event.clientY - bounds.top) / bounds.height) * 100
    // Whole-percent steps: a mousemove per pixel would re-render the whole
    // SVG, while 1% is already a couple of pixels of tooltip movement.
    const next = Math.round(Math.max(0, Math.min(100, percent)))
    setPointerY((previous) => (previous === next ? previous : next))
  }

  return { pointerY, trackPointer }
}
