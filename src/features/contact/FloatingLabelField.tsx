import { useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { cn } from '@/lib/cn'

export interface FloatingLabelFieldProps {
  label: string
  addColonOnFocus?: boolean
  status: 'neutral' | 'valid' | 'invalid'
  id: string
  registration: {
    name: string
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => unknown
    onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => unknown
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => void
    value?: string
  }
  testId?: string
  textarea?: boolean
  inputDir?: 'rtl' | 'ltr'
  formDir?: 'rtl' | 'ltr'
  maxLength?: number
  rows?: number
}

export function FloatingLabelField({
  label,
  addColonOnFocus = false,
  status,
  id,
  registration,
  testId,
  textarea = false,
  inputDir = 'ltr',
  formDir = 'ltr',
  maxLength,
  rows = 5,
}: FloatingLabelFieldProps) {
  const [focused, setFocused] = useState(false)
  const hasValue = Boolean(registration.value)
  // Labels and text follow the form's direction (RTL → right, same for every
  // field, exactly like the name field). `dir` on the input keeps digits and
  // emails reading LTR even inside an RTL form.
  const isRtl = formDir === 'rtl'
  const isFloating = focused || hasValue
  const displayLabel = addColonOnFocus && focused && !label.endsWith(':') ? `${label}:` : label

  const fieldClasses = cn(
    'peer w-full rounded-[5px] border bg-white outline-none transition-all duration-200 font-medium text-soft-black',
    'focus:ring-2 focus:ring-soft-blue/30 focus:border-soft-blue',
    // Equal 13px padding + a 22px line box exactly fill the 50px input,
    // so typed text sits dead-center vertically.
    textarea
      ? 'px-3 pt-6 pb-2 text-[17px] resize-none overflow-auto min-h-[120px]'
      : 'px-3 py-[13px] leading-[22px] text-[17px] h-[50px]',
    status === 'invalid' && 'border-soft-red shadow-red',
    status === 'valid' && 'border-soft-blue shadow-blue',
    status === 'neutral' && 'border-soft-black shadow-black',
    isRtl ? 'text-right' : 'text-left',
  )

  return (
    <div className="relative mb-5 w-full pt-4" data-testid={testId} data-status={status}>
      {/* Floating label — starts inside input, moves above input border on focus/filled */}
      <label
        htmlFor={id}
        className={cn(
          'absolute pointer-events-none transition-all duration-300 ease-in-out font-semibold z-10',
          // Floating label hugs the input's text start (px-3) and gains a bit
          // more air below it (-top-1); the resting label keeps the legacy
          // position, with +8px compensating the wrapper's pt-4 so it stays
          // centered on the input box itself.
          isRtl ? (isFloating ? 'right-3' : 'right-4') : isFloating ? 'left-3' : 'left-4',
          isFloating
            ? '-top-1 text-[16px] text-soft-blue/80'
            : textarea
              // Textarea label sits where the first typed line lands: wrapper
              // pt-4 (16px) + textarea border (1px) + textarea pt-6 (24px).
              ? 'top-[41px] text-[17px] text-soft-dark-grey'
              : 'top-[calc(50%_+_8px)] -translate-y-1/2 text-[17px] text-soft-dark-grey',
        )}
      >
        {displayLabel}
      </label>

      {textarea ? (
        <textarea
          id={id}
          dir={inputDir}
          rows={rows}
          maxLength={maxLength}
          spellCheck
          data-status={status}
          className={fieldClasses}
          {...registration}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false)
            registration.onBlur(event)
          }}
          onChange={(event) => {
            registration.onChange(event)
          }}
        />
      ) : (
        <input
          id={id}
          type="text"
          dir={inputDir}
          maxLength={maxLength}
          autoComplete="on"
          data-status={status}
          className={fieldClasses}
          {...registration}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false)
            registration.onBlur(event)
          }}
          onChange={(event) => {
            registration.onChange(event)
          }}
        />
      )}
    </div>
  )
}
