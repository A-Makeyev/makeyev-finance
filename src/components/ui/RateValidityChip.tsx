import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { rateValidityStatus, rateValidityText } from '@/lib/rateValidity'

export interface RateValidityChipProps {
  /** אישור עקרוני approval date, date-only 'YYYY-MM-DD' ('' renders nothing). */
  approvalDate: string
  /** Injectable "today" for tests; production callers omit it. */
  now?: Date
  testId?: string
  className?: string
}

/**
 * The rate-validity status for an אישור עקרוני date: how long the rate quoted
 * in the pre-approval still holds (see `src/lib/rateValidity.ts`). Renders
 * nothing when no real date is set, so callers can drop it in
 * unconditionally; `data-status` carries valid | expiring | expired for tests
 * and for CSS, since the rendered date string is locale-dependent.
 */
export function RateValidityChip({
  approvalDate,
  now,
  testId,
  className,
}: RateValidityChipProps) {
  const { t, i18n } = useTranslation()
  const validity = rateValidityStatus(approvalDate, now ?? new Date())
  if (!validity) return null

  return (
    <p
      className={cn('rate-validity-chip', validity.status, className)}
      data-testid={testId}
      data-status={validity.status}
    >
      {rateValidityText(validity, t, i18n.language)}
    </p>
  )
}
