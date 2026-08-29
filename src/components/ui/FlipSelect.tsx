import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FlipSelectProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
  testId?: string
  ariaLabel?: string
}

/**
 * Legacy select with the mousedown chevron flip (calculator.js
 * bindSelectFlip): the wrapper gets `.open` on mousedown (rotating the
 * chevron) and loses it on blur/change.
 */
export function FlipSelect({
  value,
  onChange,
  children,
  className,
  testId,
  ariaLabel,
}: FlipSelectProps) {
  const [open, setOpen] = useState(false)
  return (
    <span className={cn('select-wrap', open && 'open')}>
      <select
        className={className}
        value={value}
        aria-label={ariaLabel}
        data-testid={testId}
        onMouseDown={() => setOpen((prev) => !prev)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setOpen(false)
          onChange(event.target.value)
        }}
      >
        {children}
      </select>
      <span className="select-chevron" />
    </span>
  )
}
