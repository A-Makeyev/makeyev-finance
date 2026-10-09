import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { HOVER_CLOSE_DELAY_MS, PANEL_EXIT_DURATION_MS } from '@/lib/timings'

export interface HoverTooltipProps extends HTMLAttributes<HTMLElement> {
  /**
   * The hint text - what a native `title` used to carry (e.g. the full feed
   * name, an index-points note). Empty/undefined renders a plain element with
   * no tooltip behaviour at all.
   */
  content?: string
  children: ReactNode
  /**
   * The element to render; the tooltip wraps it rather than nesting inside.
   * `a` lets the anchor BE the link (the Indexes strip rows are anchors), so
   * their class, `order` and flex position survive - a wrapper span would
   * change the strip's layout.
   */
  as?: 'span' | 'tr' | 'a'
  /**
   * Whether to render the hint as visually-hidden text inside the element.
   * Off for a `<tr>`, which may only contain cells.
   */
  srText?: boolean
  /** Anchor attributes; meaningful only when `as="a"`. */
  href?: string
  target?: string
  rel?: string
}

/**
 * A hover tooltip for elements that used to carry a native `title`: hovering
 * (or focusing) the element itself opens a short, styled panel right under it.
 *
 * Unlike the calculator's HelpTooltip this has no "?" trigger and no
 * read-more link - it is the styled replacement for the browser's little
 * yellow box, so it claims the same hover gesture. The element it wraps keeps
 * its own class and DOM position (it IS the anchor), which is why the strips
 * and table cells can use it without a wrapper.
 *
 * The panel is PORTALED to <body> and positioned fixed. That is not
 * incidental: the Indexes/Markets strips clip their overflow (marquee tiers)
 * and are fixed bars, and a `<tr>` cannot legally hold a panel child, so an
 * in-flow absolutely-positioned panel would be clipped or hoisted away. The
 * placement pass measures the anchor after paint and clamps the panel into
 * the viewport, flipping it above when the below-side would overflow - the
 * same approach as HelpTooltip.
 *
 * Accessibility: the content is also rendered as visually-hidden text inside
 * the anchor, so screen readers get the hint whether or not the panel is
 * open, and the open panel is linked through aria-describedby. Touch users
 * get the hint on the first tap (which is swallowed instead of activating the
 * element) and the real action on the second.
 */
/**
 * Every open tooltip, so opening one closes the others outright. Without it,
 * moving along the Markets/Indexes strips leaves the previous row's panel on
 * screen for the whole close grace, and two panels overlap.
 */
const openTooltips = new Set<() => void>()

export function HoverTooltip({
  content,
  children,
  className,
  as,
  srText = true,
  ...rest
}: HoverTooltipProps) {
  const Tag: ElementType = as ?? 'span'
  const panelId = useId()
  const anchorRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLSpanElement | null>(null)
  const closeTimer = useRef<number | null>(null)
  const unmountTimer = useRef<number | null>(null)
  // Set on the touch-open tap so the click that follows is swallowed rather
  // than activating the link/button the tooltip is attached to.
  const swallowClick = useRef(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  /** Close after the grace period unless the pointer comes back first. */
  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) return
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }, [])

  /** Close now, no grace - used when another tooltip opens and for dismissals. */
  const closeNow = useCallback(() => {
    cancelClose()
    setOpen(false)
  }, [cancelClose])

  useEffect(() => cancelClose, [cancelClose])

  // One tooltip at a time: registering as the open one dismisses any other. */
  useEffect(() => {
    if (!open) {
      openTooltips.delete(closeNow)
      return
    }
    openTooltips.forEach((close) => close())
    openTooltips.add(closeNow)
    return () => {
      openTooltips.delete(closeNow)
    }
  }, [open, closeNow])

  // Keep the panel mounted briefly after closing so its exit animation can
  // finish (the same contract as HelpTooltip).
  useEffect(() => {
    if (!content) return
    if (unmountTimer.current !== null) {
      window.clearTimeout(unmountTimer.current)
      unmountTimer.current = null
    }
    if (open) {
      setMounted(true)
      return
    }
    if (!mounted) return
    unmountTimer.current = window.setTimeout(() => {
      unmountTimer.current = null
      setMounted(false)
    }, PANEL_EXIT_DURATION_MS)
    return () => {
      if (unmountTimer.current !== null) {
        window.clearTimeout(unmountTimer.current)
        unmountTimer.current = null
      }
    }
  }, [open, mounted, content])

  /** Fixed-viewport placement: centred under the anchor, clamped, flipped up. */
  const place = useCallback(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const gap = 7
    const margin = 8
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const below = rect.bottom + gap
    const above = rect.top - gap - height
    const top = below + height > window.innerHeight - margin && above >= margin ? above : below
    const centered = rect.left + rect.width / 2 - width / 2
    const left = Math.max(margin, Math.min(centered, window.innerWidth - margin - width))
    setCoords({ top, left })
  }, [])

  // Re-place while open: the anchor itself may move (page scroll) or the
  // viewport may resize. Scroll is captured so a scrolling ancestor counts.
  useEffect(() => {
    if (!open || !mounted) return
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    // Passive: the handler only reads the layout and writes a style, so it
    // must never make the browser wait on it mid-scroll.
    const scrollOptions = { capture: true, passive: true } as const
    window.addEventListener('scroll', place, scrollOptions)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, scrollOptions)
    }
  }, [open, mounted, place])

  // Escape closes; a press outside both the anchor and the panel closes.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      closeNow()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closeNow()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, closeNow])

  const openNow = content
    ? () => {
        cancelClose()
        setOpen(true)
      }
    : undefined

  return (
    <Tag
      {...rest}
      ref={(node: HTMLElement | null) => {
        anchorRef.current = node
      }}
      className={cn(className)}
      data-tooltip-anchor={content ? 'true' : undefined}
      aria-describedby={content && open ? panelId : undefined}
      onMouseEnter={openNow}
      onMouseLeave={
        content
          ? () => {
              cancelClose()
              scheduleClose()
            }
          : undefined
      }
      onFocus={openNow}
      onBlur={
        content
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) closeNow()
            }
          : undefined
      }
      onPointerUp={
        content
          ? (event) => {
              // Touch has no hover: the first tap opens the hint and is
              // swallowed so it does not also press the underlying control;
              // the next tap goes through.
              if (event.pointerType !== 'touch' || open) return
              event.preventDefault()
              event.stopPropagation()
              setOpen(true)
              swallowClick.current = true
            }
          : undefined
      }
      onClickCapture={
        content
          ? (event) => {
              if (!swallowClick.current) return
              swallowClick.current = false
              event.preventDefault()
              event.stopPropagation()
            }
          : undefined
      }
    >
      {children}
      {content && srText ? <span className="visually-hidden">{content}</span> : null}
      {content && mounted && typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={panelRef}
              id={panelId}
              role="tooltip"
              className={cn('hover-tooltip-panel', !open && 'is-closing')}
              aria-hidden={!open}
              style={
                coords
                  ? { top: coords.top, left: coords.left }
                  : { top: 0, left: 0, visibility: 'hidden' }
              }
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </Tag>
  )
}
