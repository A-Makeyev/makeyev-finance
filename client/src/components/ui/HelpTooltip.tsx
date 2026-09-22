import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { HOVER_CLOSE_DELAY_MS, PANEL_EXIT_DURATION_MS } from '@/lib/timings'

export interface HelpTooltipProps {
  /** Screen-reader name for the icon button (e.g. "מידע נוסף על סוג המסלול"). */
  label: string
  /** The short explanation shown in the panel (1-3 sentences, not an article). */
  content: string
  /** Optional full-explanation link ("read more") rendered at the panel end. */
  linkTo?: string
  linkLabel?: string
  testId?: string
  className?: string
}

/**
 * Inline help tooltip: a small "?" icon next to a form label that opens a
 * short, styled explanation near the field - a condensed version of an
 * article, plus a link to the full text. Built for the calculator form
 * instead of reusing useTooltipClamp verbatim: that hook serves a chart's
 * mouse-following hover tooltip (different trigger and anchor), while this
 * is a static toggle tip. What IS reused is its edge-clamping approach -
 * after opening, measure the rendered panel and shift it rather than let it
 * overflow (here the binding container is the viewport, which is what
 * matters at phone widths).
 *
 * Interaction model - hover to peek, click to pin:
 * - Hovering the ICON opens the panel; the panel closes only after the
 *   pointer has been outside the widget (icon, gap bridge or panel) for a
 *   short grace period. Crossing the 7px gap or jittering at the edge can
 *   never flap the panel: every re-entry cancels the pending close, and the
 *   ::before bridge over the gap keeps the pointer inside the widget while
 *   it travels to the panel - so the read-more link is comfortably
 *   reachable, which a naive hover tooltip gets wrong. Hover is bound to
 *   the icon button itself, not a wrapper box: passing near the icon or
 *   over the neighbouring label text shows nothing and changes nothing.
 * - Clicking (or tapping, or Enter/Space) pins the panel: a pinned panel
 *   stays open until an explicit close (another click, Escape, an outside
 *   press, or focus leaving the widget), no matter where the mouse goes.
 *   This is also the touch path, where hover does not exist.
 * - Keyboard focus opens the panel (via :focus-visible) exactly like hover.
 *
 * Accessibility (toggle-tip pattern): the icon is a real button with
 * aria-expanded and an aria-label; the panel is linked via aria-describedby
 * so screen readers announce its content while it is open.
 */

export function HelpTooltip({
  label,
  content,
  linkTo,
  linkLabel,
  testId,
  className,
}: HelpTooltipProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  // `pinned` = opened by click/tap/keyboard toggle (ignores hover-out);
  // `hoverOpen` = opened by the pointer, closed only after the grace delay.
  const [pinned, setPinned] = useState(false)
  const [hoverOpen, setHoverOpen] = useState(false)
  const open = pinned || hoverOpen
  const [panelMounted, setPanelMounted] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const panelUnmountTimer = useRef<number | null>(null)

  const cancelHoverClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  /** Close after the grace period unless the pointer comes back first. */
  const scheduleHoverClose = () => {
    if (closeTimer.current !== null) return
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setHoverOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  // Clear any pending hover close on unmount.
  useEffect(() => cancelHoverClose, [])

  // Keep the panel mounted briefly after closing so its exit animation can
  // finish without keeping it interactive or affecting layout.
  useEffect(() => {
    if (panelUnmountTimer.current !== null) {
      window.clearTimeout(panelUnmountTimer.current)
      panelUnmountTimer.current = null
    }

    if (open) {
      setPanelMounted(true)
      return
    }

    if (!panelMounted) return
    panelUnmountTimer.current = window.setTimeout(() => {
      panelUnmountTimer.current = null
      setPanelMounted(false)
    }, PANEL_EXIT_DURATION_MS)

    return () => {
      if (panelUnmountTimer.current !== null) {
        window.clearTimeout(panelUnmountTimer.current)
        panelUnmountTimer.current = null
      }
    }
  }, [open, panelMounted])

  // Viewport edge clamping, reuse of the useTooltipClamp approach: measure
  // from the centered base transform (idempotent, no drift), then shift just
  // clear of the edge when the panel does not fit. Vertically: the panel
  // opens below the icon, but flips above it when the bottom would overflow
  // the viewport (a panel hanging past the fold is unreachable - neither
  // hoverable nor clickable) and the space above fits.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const trigger = triggerRef.current
    if (!panel || !trigger) return
    const compute = () => {
      panel.style.transform = 'translateX(-50%)'
      const margin = 8
      // Vertical placement first: below the icon by default, above it when
      // the below-side bottom would cross the viewport edge while the
      // above-side fits. (When neither side fully fits, keep below - the
      // horizontal clamp still keeps it usable.)
      const triggerRect = trigger.getBoundingClientRect()
      const height = panel.getBoundingClientRect().height
      const gap = 7
      const belowOverflows = triggerRect.bottom + gap + height > window.innerHeight - margin
      const aboveFits = triggerRect.top - gap - height >= margin
      panel.classList.toggle('is-above', belowOverflows && aboveFits)
      // Horizontal clamp, measured after the vertical placement settled.
      const rect = panel.getBoundingClientRect()
      const overStart = margin - rect.left
      const overEnd = rect.right - (window.innerWidth - margin)
      if (overStart > 0) {
        panel.style.transform = `translateX(calc(-50% + ${overStart}px))`
      } else if (overEnd > 0) {
        panel.style.transform = `translateX(calc(-50% - ${overEnd}px))`
      }
    }
    compute()
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', compute)
    }
  }, [open, panelMounted])

  // While open: Escape closes (refocusing the trigger when the focus was
  // inside the widget, e.g. on the read-more link), and pressing outside
  // closes - the touch equivalent of click-outside.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus()
      setPinned(false)
      setHoverOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPinned(false)
        setHoverOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <span
      ref={rootRef}
      className={cn('help-tooltip', className)}
      data-open={open ? 'true' : undefined}
    >
      <button
        ref={triggerRef}
        type="button"
        className="help-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={open ? panelId : undefined}
        data-testid={testId}
        onMouseEnter={() => {
          // Hover OVER the icon opens the panel. Bound to the button itself,
          // so merely passing near the icon or over the label text does
          // nothing - no text, no border change.
          cancelHoverClose()
          setHoverOpen(true)
        }}
        onMouseLeave={() => {
          cancelHoverClose()
          if (pinned) {
            // Pinned panels ignore the mouse: drop the hover flag (the pin
            // holds the panel open) so unpinning later closes fully.
            setHoverOpen(false)
          } else {
            // Unpinned: the panel stays open through the grace window, so
            // jitter at the edge or a detour across the gap cannot flap it.
            scheduleHoverClose()
          }
        }}
        onFocus={(event) => {
          // Open for keyboard users only: a pointer click focuses the button
          // too, and the click handler owns that path (opening here as well
          // would make the click immediately toggle the panel back closed).
          if (event.currentTarget.matches(':focus-visible')) setPinned(true)
        }}
        onBlur={(event) => {
          // Focus moved out of the whole widget (button or read-more link):
          // close, so tabbing on is never trapped next to an open panel.
          if (
            !event.currentTarget.closest('.help-tooltip')?.contains(event.relatedTarget as Node)
          ) {
            setPinned(false)
            setHoverOpen(false)
          }
        }}
        onClick={() => {
          // Toggle the pin. Unpinning closes outright even under the pointer
          // (click means close), while pinning keeps the hover-open alive.
          cancelHoverClose()
          if (pinned) {
            setPinned(false)
            setHoverOpen(false)
          } else {
            setPinned(true)
          }
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      {/* Rendered only while open: no hidden box can block the form controls
          underneath or push the page's scrollable overflow around. The panel
          is a DOM child of this span, so the pointer sitting on it counts as
          being inside the widget and the hover close stays cancelled. */}
      {panelMounted && (
        <div
          ref={panelRef}
          id={panelId}
          className={cn('help-tooltip-panel', !open && 'is-closing')}
          aria-hidden={!open}
          data-testid={testId ? `${testId}-panel` : undefined}
          // The open panel keeps itself alive: entering it (or its ::before
          // gap bridge) cancels the pending close, leaving it restarts the
          // countdown - unless pinned, which ignores the mouse entirely.
          onMouseEnter={cancelHoverClose}
          onMouseLeave={() => {
            if (!pinned) scheduleHoverClose()
          }}
        >
          {content}
          {linkTo && linkLabel && (
            <Link className="help-tooltip-link" to={linkTo}>
              {linkLabel}
            </Link>
          )}
        </div>
      )}
    </span>
  )
}
