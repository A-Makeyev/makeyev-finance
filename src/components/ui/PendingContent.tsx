'use client'

import type { ReactNode } from 'react'
import { FaSpinner } from 'react-icons/fa'

/**
 * The content of a submit button that shows a spinner while a request is in
 * flight, WITHOUT changing the button's box.
 *
 * The label is the widest state, so it stays in the flow and is only made
 * invisible; the spinner is laid over that same box (absolute, centred on the
 * button) instead of replacing the label. Swapping the label for a bare
 * spinner made the button shrink to its padding, which pulled the buttons
 * beside it in the row and moved the modal's action row (user-reported).
 *
 * The owning button must be `relative`, and must carry an `aria-label` while
 * pending: an invisible label is out of the accessibility tree, so the name
 * has to come from the button itself.
 */
export function PendingContent({
  pending,
  children,
  spinnerTestId,
}: {
  pending: boolean
  children: ReactNode
  spinnerTestId?: string
}) {
  return (
    <>
      <span className={pending ? 'invisible' : undefined}>{children}</span>
      {pending && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <FaSpinner
            aria-hidden="true"
            data-testid={spinnerTestId}
            className="animate-spin"
          />
        </span>
      )}
    </>
  )
}
