import { useTranslation } from 'react-i18next'

/**
 * The four confirmed facts, in the order they should read: which tracks are
 * exempt, where the penalty-free exit points are, where the penalty can still
 * apply, and the loyalty discount schedule.
 */
const FACT_KEYS = ['prime', 'reset', 'fixed', 'loyalty'] as const

/**
 * The confirmed prepayment-penalty facts (Bank of Israel rules plus the
 * loyalty discount schedule). Shared by the calculator's collapsible note and
 * the article page, so both surfaces state the same four things and read them
 * from a single set of translation keys per language.
 *
 * General educational content only: no calculation feeds into it and nothing
 * here is derived from the user's figures.
 */
export function PrepaymentPenaltyFacts({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <ul className={className} data-testid="prepayment-penalty-facts">
      {FACT_KEYS.map((key) => (
        <li key={key}>
          <h4>{t(`education.prepaymentPenalty.facts.${key}.title`)}</h4>
          <p>{t(`education.prepaymentPenalty.facts.${key}.text`)}</p>
        </li>
      ))}
    </ul>
  )
}
