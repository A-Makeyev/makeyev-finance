import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import type { QuestionWishlistItem } from '@/stores/questionWishlistStore'
import type { PaymentLabelKind } from '@/lib/amortization'

/**
 * Canonical text for the results-card explanation topics, shared by the save
 * side (ResultsCards) and every surface that shows saved topics (floating
 * panel, contact chips, email).
 *
 * A topic is identified by its stable id only; its title and summary are
 * re-derived from the live translations at display time. That is what makes
 * saved questions follow the site language - switching Hebrew ⇄ English
 * retranslates topics that were saved earlier, instead of keeping the
 * language they happened to be added in.
 */
export const RESULTS_TOPIC_IDS = [
  'firstPayment',
  'totalInterest',
  'totalPayment',
  'rateUp',
  'rateDown',
  'highestPayment',
  'avgPayment',
  'overpayPercent',
  'avgPayback',
  'avgRate',
  'effRate',
  'interestShare',
  'fiveYInterest',
  'balance5y',
  'per100k',
] as const

export type ResultsTopicId = (typeof RESULTS_TOPIC_IDS)[number]

/** Two titles compose scenario data into their text; the rest are plain labels. */
type PlainTopicId = Exclude<ResultsTopicId, 'totalPayment' | 'highestPayment'>

export function isResultsTopicId(value: string): value is ResultsTopicId {
  return (RESULTS_TOPIC_IDS as readonly string[]).includes(value)
}

/** Translation key of each plain card label, keyed by topic id. */
const CARD_LABEL_KEYS: Record<PlainTopicId, string> = {
  firstPayment: 'calculator.results.firstPaymentCard',
  totalInterest: 'calculator.results.totalInterestCard',
  rateUp: 'calculator.results.rateUpCard',
  rateDown: 'calculator.results.rateDownCard',
  avgPayment: 'calculator.results.avgPaymentCard',
  overpayPercent: 'calculator.results.overpayCard',
  avgPayback: 'calculator.results.avgPaybackCard',
  avgRate: 'calculator.results.avgRateCard',
  effRate: 'calculator.results.effRateCard',
  interestShare: 'calculator.results.interestShareCard',
  fiveYInterest: 'calculator.results.fiveYInterestCard',
  balance5y: 'calculator.results.balance5yCard',
  per100k: 'calculator.results.per100kCard',
}

/** Dynamic "highest payment" label by track composition (mirror of the view model). */
const HIGHEST_PAYMENT_LABEL_KEYS: Record<PaymentLabelKind, string> = {
  indexed: 'calculator.dynamicNotes.indexedLabel',
  equalPrincipal: 'calculator.dynamicNotes.equalPrincipalLabel',
  variable: 'calculator.dynamicNotes.variableLabel',
  fixed: 'calculator.dynamicNotes.fixedLabel',
}

/** Scenario values the two composite titles read (kept from the calculator store). */
export interface ResultsTopicContext {
  termYears: number
  highestLabelKind: PaymentLabelKind | null
}

/**
 * The topic header exactly as its results-card dialog shows it, in the given
 * language. Two cards embed scenario data in their title - the total-payment
 * term years and the highest-payment dynamic label - so the caller passes the
 * same calculator-store values the dialog renders with.
 */
export function resultsTopicTitle(
  t: TFunction,
  id: ResultsTopicId,
  { termYears, highestLabelKind }: ResultsTopicContext,
): string {
  switch (id) {
    case 'totalPayment':
      // The dialog's label concatenates prefix + years + suffix with no
      // inserted space (the EN prefix already ends with one) - mirror it.
      return termYears === 1
        ? t('calculator.results.totalOneYear')
        : `${t('calculator.results.totalForYearsPrefix')}${termYears}${t('calculator.results.totalForYearsSuffix')}`
    case 'highestPayment':
      return highestLabelKind !== null
        ? t(HIGHEST_PAYMENT_LABEL_KEYS[highestLabelKind])
        : t('calculator.results.highestPaymentDefault')
    default:
      return t(CARD_LABEL_KEYS[id])
  }
}

/**
 * The wishlist keeps a compact blurb, not the full explanation - the first
 * sentence when it's a reasonable length, otherwise a hard cut at 120 chars.
 */
export function briefSummary(text: string): string {
  const BRIEF_MAX = 120
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0]
  if (firstSentence.length > 12 && firstSentence.length <= BRIEF_MAX) return firstSentence
  return text.length > BRIEF_MAX ? `${text.slice(0, BRIEF_MAX).trimEnd()}…` : text
}

/** The compact plain-language summary of a topic, in the given language. */
export function resultsTopicSummary(t: TFunction, id: ResultsTopicId): string {
  return briefSummary(t(`calculator.results.details.${id}`))
}

export interface LocalizedWishlistTopic {
  item: QuestionWishlistItem
  title: string
  summary: string
}

/**
 * Maps saved wishlist items to their current-language title and summary.
 * Known results topics are re-derived from the live translations (a language
 * switch retranslates already-saved questions); unknown ids - nothing in the
 * app saves one today - fall back to their stored snapshot.
 */
export function useLocalizedResultsTopics(items: QuestionWishlistItem[]): LocalizedWishlistTopic[] {
  const { t } = useTranslation()
  const termYears = useCalculatorStore((s) => s.termYears)
  const highestLabelKind = useCalculatorStore((s) => s.snapshot.highestLabel?.kind ?? null)
  const context: ResultsTopicContext = { termYears, highestLabelKind }
  return items.map((item) =>
    isResultsTopicId(item.id)
      ? {
          item,
          title: resultsTopicTitle(t, item.id, context),
          summary: resultsTopicSummary(t, item.id),
        }
      : { item, title: item.title, summary: item.summary },
  )
}
