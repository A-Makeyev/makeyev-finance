import { FaSpinner } from 'react-icons/fa'

/** A quiet spinner with a translated screen-reader label and a stable slot. */
export function LoadingIndicator({ label, testId, className = '' }: {
  label: string
  testId?: string
  className?: string
}) {
  return (
    <span role="status" data-testid={testId} className={`inline-flex min-h-6 items-center justify-center text-ink-muted ${className}`}>
      <FaSpinner aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
