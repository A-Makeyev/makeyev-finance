'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { FiCalendar } from 'react-icons/fi'
import { cn } from '@/lib/cn'
import { editDateText, formatDateInput, isoFromDateInput } from '@/lib/dateInput'

export interface DateFieldProps {
  id?: string
  /** Date-only 'YYYY-MM-DD', or '' for an empty field. */
  value: string
  onChange: (value: string) => void
  /** Localized pattern shown while empty, e.g. dd/mm/yyyy. */
  placeholder: string
  /** id of the visually hidden format hint linked as the field's description. */
  describedBy?: string
  testId?: string
  className?: string
}

/**
 * The shared אישור עקרוני approval-date control.
 *
 * This is deliberately a masked text field, not `<input type="date">`. The
 * native control renders its segments in the browser's own locale, and while
 * a year is being typed Chrome rewrites the day and month (03/03/20 landed as
 * 03/03/0002). Here the text is exactly dd/mm/yyyy in every browser and
 * language, `isoFromDateInput` decides whether it is a real date, and only a
 * real date is reported upward; the stored value stays date-only ISO.
 *
 * Editing is slot-based (`editDateText`): the day, month and year keep their
 * own digits, so deleting the year continues into the month instead of
 * stopping, and typing inside the month never pushes digits into the year.
 * The caret is restored after every edit, because a controlled input otherwise
 * jumps to the end when React rewrites the value.
 *
 * A two-digit year is completed on blur (03/03/20 -> 03/03/2020) rather than
 * mid-typing, so the field never jumps while the visitor is still entering
 * the year. Impossible dates stay visible and marked invalid instead of being
 * silently accepted or rolled over.
 *
 * The trailing calendar mark is the affordance the native control used to
 * draw: it is decorative here (the value is typed), so it is hidden from
 * assistive tech and takes the same colour as the field's other suffixes.
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  testId,
  className,
}: DateFieldProps) {
  const [text, setText] = useState(() => formatDateInput(value))
  const [invalid, setInvalid] = useState(false)
  const [caretVersion, setCaretVersion] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)
  /** The last value this field reported, so an external change (reset, saved
      offer, duplicated scenario) can be told apart from its own echo. */
  const lastReported = useRef(value)

  useEffect(() => {
    if (value === lastReported.current) return
    lastReported.current = value
    setText(formatDateInput(value))
    setInvalid(false)
  }, [value])

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return
    const caret = pendingCaret.current
    pendingCaret.current = null
    const input = inputRef.current
    if (!input || document.activeElement !== input) return
    input.setSelectionRange(caret, caret)
  }, [text, caretVersion])

  const report = (iso: string) => {
    if (lastReported.current === iso) return
    lastReported.current = iso
    onChange(iso)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const result = editDateText(text, event.target.value, event.target.selectionStart)
    setText(result.text)
    setInvalid(false)
    pendingCaret.current = result.caret
    setCaretVersion((version) => version + 1)
    report(isoFromDateInput(result.text) ?? '')
  }

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') {
      setText('')
      setInvalid(false)
      report('')
      return
    }
    const iso = isoFromDateInput(trimmed)
    if (iso === null) {
      setInvalid(true)
      report('')
      return
    }
    setText(formatDateInput(iso))
    setInvalid(false)
    report(iso)
  }

  return (
    <>
      <input
        id={id}
        ref={inputRef}
        type="text"
        className={cn('date-field', className)}
        value={text}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            // Commit, but never submit the calculator form from a date field.
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            setText(formatDateInput(lastReported.current))
            setInvalid(false)
            event.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        data-invalid={invalid ? 'true' : undefined}
        data-testid={testId}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
      />
      <FiCalendar
        className="date-field-icon"
        data-testid="date-field-icon"
        aria-hidden="true"
      />
    </>
  )
}
