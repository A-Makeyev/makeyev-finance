import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * IntersectionObserver scroll fade-in - the exact legacy mechanism
 * (loader.js:13-24 + main.css): element carries `.fade-in`; when it enters
 * the viewport `.faded-in` is added once and never removed. The transition
 * itself (500ms ease-in-out) comes from the element's own class
 * (e.g. `.course-col`), and the stagger delays come from the legacy
 * `.faded-in:nth-child()` rules.
 */
interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger index (0-based); mirrors nth-child(1..3) delays of the legacy CSS. */
  order?: number
  testId?: string
}

export function Reveal({ children, className, order = 0, testId }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // One-way: once visible, never hidden again (matches legacy).
        if (entry.isIntersecting) setVisible(true)
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-testid={testId}
      data-order={order}
      className={cn('fade-in', visible && 'faded-in', className)}
    >
      {children}
    </div>
  )
}
