import { useCallback, useEffect, useRef, useState } from 'react'

export interface TermSliderProps {
  min: number
  max: number
  value: number
  onValueChange: (value: number) => void
  labelLow: string
  labelHigh: string
  ariaLabel: string
  testId?: string
}

const THUMB_SIZE = 22

/**
 * Native range input preserving the legacy custom fill technique
 * (calculator.js:176-194): CSS custom properties position a gradient so the
 * filled segment starts/ends inside the thumb radius. The RTL gradient
 * direction comes from the stylesheet (legacy `to left`). All visuals come
 * from the verbatim calculators.css port (.term-slider-wrap).
 *
 * On top of the legacy fill, a small bubble just below the thumb shows the
 * current value (the selected term in years) so the slider always reads its
 * own state - feedback request.
 */
export function TermSlider({
  min,
  max,
  value,
  onValueChange,
  labelLow,
  labelHigh,
  ariaLabel,
  testId,
}: TermSliderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [thumbPos, setThumbPos] = useState(50)

  const paint = useCallback(() => {
    const element = inputRef.current
    if (!element) return
    const ratio = (Number(element.value) - min) / (max - min)
    const width = element.offsetWidth || 0
    const thumbShare = width > 0 ? Math.min(1, THUMB_SIZE / width) : 0
    const start = (thumbShare / 2) * 100
    const end = (1 - thumbShare / 2) * 100
    const fill = Math.min(end, Math.max(start, (ratio * (1 - thumbShare) + thumbShare / 2) * 100))
    element.style.setProperty('--slider-start', `${start}%`)
    element.style.setProperty('--slider-fill', `${fill}%`)
    element.style.setProperty('--slider-end', `${end}%`)
  }, [min, max])

  /**
   * Positions the current-value bubble over the thumb, mirroring the ratio for
   * RTL so it matches the visual thumb position regardless of direction.
   */
  const positionBubble = useCallback(() => {
    const element = inputRef.current
    if (!element) return
    const trackWidth = element.clientWidth || 0
    if (!trackWidth) return
    const ratio = (value - min) / (max - min)
    const centerFromMin = ratio * Math.max(0, trackWidth - THUMB_SIZE) + THUMB_SIZE / 2
    const isRtl = getComputedStyle(element).direction === 'rtl'
    const center = isRtl ? trackWidth - centerFromMin : centerFromMin
    setThumbPos((center / trackWidth) * 100)
  }, [value, min, max])

  useEffect(() => {
    paint()
    positionBubble()
    const element = inputRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      paint()
      positionBubble()
    })
    observer.observe(element)
    // Switching language flips documentElement dir (RTL <-> LTR), which
    // mirrors the bubble's visual position - re-run the layout on that.
    const dirObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            paint()
            positionBubble()
          })
    dirObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
    })
    return () => {
      observer.disconnect()
      dirObserver?.disconnect()
    }
  }, [paint, positionBubble])

  return (
    <div className="term-slider-wrap">
      <span className="slider-label">{labelLow}</span>
      <div className="term-slider-track">
        <input
          ref={inputRef}
          id="term-years"
          type="range"
          min={min}
          max={max}
          value={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={ariaLabel}
          data-testid={testId}
          onChange={(event) => onValueChange(Number(event.target.value))}
        />
        <output
          className="slider-current"
          style={{ left: `${thumbPos}%` }}
          aria-hidden="true"
          data-testid={testId ? `${testId}-value` : undefined}
        >
          {value}
        </output>
      </div>
      <span className="slider-label">{labelHigh}</span>
    </div>
  )
}

/** Re-exported for tests that need the exact fill math. */
export function computeSliderFill(value: number, min: number, max: number, width: number): number {
  const ratio = (value - min) / (max - min)
  const thumbShare = width > 0 ? Math.min(1, THUMB_SIZE / width) : 0
  const start = (thumbShare / 2) * 100
  const end = (1 - thumbShare / 2) * 100
  return Math.min(end, Math.max(start, (ratio * (1 - thumbShare) + thumbShare / 2) * 100))
}
