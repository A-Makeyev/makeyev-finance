'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

/**
 * A password field with a show/hide toggle, shared by the auth flows and the
 * profile's change-password modal.
 *
 * The toggle is a real button, so it works on touch and from the keyboard
 * (never hover-only), and its name comes from i18n. It is `type="button"` so
 * it can never submit the form around it, and it stops the click from reaching
 * a wrapping `<label>` (which would otherwise re-activate the field and, on
 * some browsers, steal the toggle's click).
 */
export function PasswordInput({
  value,
  onChange,
  testId,
  name,
  autoComplete = 'current-password',
  inputClassName,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  testId: string
  /**
   * Form field name, so the browser can autofill the field. Defaults to the
   * test id, which every call site already makes unique.
   */
  name?: string
  autoComplete?: string
  /** The surrounding form's field class (each surface has its own tokens). */
  inputClassName: string
  ariaLabel?: string
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative block">
      <input
        type={visible ? 'text' : 'password'}
        required
        autoComplete={autoComplete}
        name={name ?? testId}
        data-testid={testId}
        aria-label={ariaLabel}
        // No `dir` override: the field inherits the page's direction, so typed
        // text starts at the page's start edge (right in Hebrew, left in
        // English) and the `pe-11` padding clears exactly the toggle's own
        // inline-end corner. Hard-coding LTR used to put the padding on the
        // opposite side from the toggle.
        className={`${inputClassName} pe-11 text-start`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        onClick={(event) => {
          event.stopPropagation()
          setVisible((current) => !current)
        }}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-blue"
      >
        {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      </button>
    </span>
  )
}
