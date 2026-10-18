'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { applyCodeInput } from '@/lib/codeInput'

/**
 * A code field drawn as one square box per character, shared by the
 * password-reset code (four digits) and the account-deletion code (six letters
 * and digits) so the two cannot drift apart.
 *
 * Typing advances to the next box, backspace on an empty box and the arrow keys
 * walk back, a paste (or the OS one-time-code autofill) spreads across the
 * boxes, and only characters the caller's `sanitize` allows ever land in one.
 * The editing rules themselves live in src/lib/codeInput and are unit tested
 * there; this only applies them and moves focus.
 *
 * Every box carries the same `data-testid`, so a spec addresses the group, and
 * the group is labelled once while each box announces its own position
 * ("Code 2"), so it reads as one field rather than a run of unnamed inputs.
 */

/** One square box: big centred character on a themed field. */
const BOX_CLASS =
  'h-12 w-12 rounded-lg border border-line-strong bg-surface-page text-center text-xl font-semibold text-ink outline-none transition-colors hover:border-ink focus:border-ink focus-visible:ring-2 focus-visible:ring-soft-blue'

export function CodeInput({
  value,
  onChange,
  length,
  sanitize,
  ariaLabel,
  testId,
  invalid = false,
  inputMode = 'text',
  pattern,
  autoComplete = false,
  autoCapitalize,
  namePrefix = 'code',
  boxClassName,
  focusRequest,
}: {
  /** One entry per box; keep it exactly `length` long (see emptyCodeSlots). */
  value: string[]
  /** Receives the boxes after every edit (focus is managed here). */
  onChange: (slots: string[]) => void
  length: number
  /** Keeps only the characters a box may hold (digits, or letters and digits). */
  sanitize: (raw: string) => string
  /** The group's name; each box appends its 1-based position. */
  ariaLabel: string
  /** Shared by every box, so a spec can address the group or `nth()` a box. */
  testId: string
  /** Marks every box invalid (the caller owns the message). */
  invalid?: boolean
  /** `numeric` opens a digits keypad; `text` is the default for letters + digits. */
  inputMode?: 'numeric' | 'text'
  /** Sent to the browser only when it is meaningful (defaults from inputMode). */
  pattern?: string
  /** `one-time-code` on the FIRST box lets the OS deliver the whole code at once. */
  autoComplete?: boolean
  autoCapitalize?: 'off' | 'none' | 'characters'
  /** Box names are `code-1`, `code-2`, ... unless a caller needs a prefix. */
  namePrefix?: string
  /** Appended to each box's class. */
  boxClassName?: string
  /**
   * A caller that refills the field from outside (a freshly re-sent code can
   * ask for this) bumps this number to put the caret back in the first box.
   */
  focusRequest?: number
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const lastFocusRequest = useRef(focusRequest)

  useEffect(() => {
    if (focusRequest !== undefined && focusRequest !== lastFocusRequest.current) {
      refs.current[0]?.focus()
    }
    lastFocusRequest.current = focusRequest
  }, [focusRequest])

  function onInput(index: number, raw: string) {
    const edit = applyCodeInput(value, index, raw, length, sanitize)
    onChange(edit.slots)
    refs.current[edit.focusIndex]?.focus()
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !value[index]) {
      refs.current[Math.max(index - 1, 0)]?.focus()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      refs.current[Math.max(index - 1, 0)]?.focus()
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      refs.current[Math.min(index + 1, length - 1)]?.focus()
    }
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap justify-center gap-2" dir="ltr">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="text"
          dir="ltr"
          required
          name={`${namePrefix}-${index + 1}`}
          inputMode={inputMode}
          pattern={pattern ?? (inputMode === 'numeric' ? '[0-9]*' : undefined)}
          autoComplete={autoComplete && index === 0 ? 'one-time-code' : 'off'}
          autoCapitalize={autoCapitalize}
          spellCheck={false}
          aria-label={`${ariaLabel} ${index + 1}`}
          aria-invalid={invalid || undefined}
          data-testid={testId}
          data-code-index={index}
          className={boxClassName ? `${BOX_CLASS} ${boxClassName}` : BOX_CLASS}
          value={value[index] ?? ''}
          onChange={(event) => onInput(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  )
}
