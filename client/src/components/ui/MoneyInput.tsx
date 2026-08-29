import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

export interface MoneyInputProps {
  /** Store-held display text. */
  value: string
  /**
   * Called with the raw DOM text + caret; returns the formatted text and new
   * caret position (pure port of legacy formatAmountInput).
   */
  onChange: (raw: string, caret: number | null) => { text: string; caret: number | null }
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  suffix?: string
  ariaLabel?: string
  testId?: string
  className?: string
}

/**
 * Money input with live thousand-separator formatting and caret stability
 * while typing (legacy calculator.js:66-90).
 */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  suffix,
  ariaLabel,
  testId,
  className,
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleInput = () => {
    const element = inputRef.current
    if (!element) return
    const result = onChange(element.value, element.selectionStart)
    element.value = result.text
    if (
      result.caret !== null &&
      document.activeElement === element &&
      element.selectionStart !== null
    ) {
      element.setSelectionRange(result.caret, result.caret)
    }
  }

  // Keep the DOM in sync with store-driven rewrites (presets/resets/scales).
  useEffect(() => {
    const element = inputRef.current
    if (element && element.value !== value) element.value = value
  }, [value])

  return (
    <div className={cn('input-wrap', className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        defaultValue={value}
        onInput={handleInput}
        onBlur={() => {
          const element = inputRef.current
          if (element) element.value = onChange(element.value, null).text
          onBlur?.()
        }}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={testId}
      />
      {suffix !== undefined ? <span aria-hidden="true">{suffix}</span> : null}
    </div>
  )
}
