import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { formatCurrency, formatRatePercent } from '@/lib/format'
import {
  FIRST_HOME_TAX_EXEMPTION_UP_TO,
  PURPOSE_LIMITS,
  type PaymentLabelKind,
  type PropertyPurpose,
} from '@/lib/amortization'

/**
 * Maps the raw calculation snapshot to localized display strings, preserving
 * the legacy dynamic-label priority chain and message compositions.
 */
export function useCalculatorViewModel() {
  const { t } = useTranslation()
  const snapshot = useCalculatorStore((s) => s.snapshot)
  const error = useCalculatorStore((s) => s.error)
  const flaggedTrackIds = useCalculatorStore((s) => s.flaggedTrackIds)
  const termYears = useCalculatorStore((s) => s.termYears)
  const scheduleExpanded = useCalculatorStore((s) => s.scheduleExpanded)
  const purpose = useCalculatorStore((s) => s.purpose)
  const requiredEquityPercent = 100 - PURPOSE_LIMITS[purpose].limit

  const countText =
    snapshot.enteredCount === 1
      ? t('calculator.counts.one')
      : snapshot.enteredCount === 2
        ? t('calculator.counts.two')
        : snapshot.enteredCount === 3
          ? t('calculator.counts.three')
          : t('calculator.counts.many', { count: snapshot.enteredCount })

  let highestLabelText = t('calculator.results.highestPaymentDefault')
  let dynamicNote = ''
  const label = snapshot.highestLabel
  if (label) {
    switch (label.kind satisfies PaymentLabelKind) {
      case 'indexed':
        highestLabelText = t('calculator.dynamicNotes.indexedLabel')
        dynamicNote = t('calculator.dynamicNotes.indexedNote')
        break
      case 'equalPrincipal':
        highestLabelText = t('calculator.dynamicNotes.equalPrincipalLabel')
        dynamicNote = t('calculator.dynamicNotes.equalPrincipalNote')
        break
      case 'variable':
        highestLabelText = t('calculator.dynamicNotes.variableLabel')
        dynamicNote = label.hasFiveYearVariable
          ? t('calculator.dynamicNotes.variableFiveYearNote')
          : t('calculator.dynamicNotes.variableNote')
        break
      case 'fixed':
        highestLabelText = t('calculator.dynamicNotes.fixedLabel')
        dynamicNote = t('calculator.dynamicNotes.fixedNote')
        break
    }
  }

  const paymentNote = snapshot.isEmpty ? t('calculator.emptyNote') : `${countText} · ${dynamicNote}`

  const purposeLabels: Record<PropertyPurpose, string> = {
    first: t('calculator.warnings.purposeFirst'),
    upgrade: t('calculator.warnings.purposeUpgrade'),
    investment: t('calculator.warnings.purposeInvestment'),
  }
  const purchaseTaxPurposeLabels: Record<PropertyPurpose, string> = {
    first: t('calculator.warnings.purchaseTaxFirst'),
    upgrade: t('calculator.warnings.purchaseTaxUpgrade'),
    investment: t('calculator.warnings.purchaseTaxInvestment'),
  }

  const warningMessages: string[] = []
  // Entered equity below the required amount → tell the user how much more.
  if (snapshot.equityShortfall && snapshot.suggestedEquity !== null) {
    warningMessages.push(
      t('calculator.warnings.equityShortfall', {
        required: formatCurrency(snapshot.suggestedEquity),
        requiredPercent: requiredEquityPercent,
      }),
    )
  }
  if (snapshot.equity) {
    // Rendered separately under the inputs row (legacy #equity-note).
  }
  if (snapshot.ltv) {
    // Precise ratio (e.g. 75.3%) so the warning never reads as
    // "75% exceeds 75%" when the true ratio is just above the limit.
    const ltvPercent = Number.isInteger(snapshot.ltv.percent)
      ? String(snapshot.ltv.percentRounded)
      : snapshot.ltv.percent.toFixed(1)
    warningMessages.push(
      t('calculator.warnings.ltv', {
        percent: ltvPercent,
        purpose: purposeLabels[snapshot.ltv.purpose],
        limit: snapshot.ltv.limit,
        value: formatCurrency(snapshot.ltv.effectiveValue),
        maxLoan: formatCurrency(snapshot.ltv.maxLoan),
      }),
    )
  }
  if (snapshot.dti) {
    warningMessages.push(
      t('calculator.warnings.dti', {
        payment: formatCurrency(snapshot.dti.payment),
        minIncome: formatCurrency(snapshot.dti.minIncome),
        shortfall: snapshot.dti.shortfallPercent,
      }),
    )
  }

  const errorMessage = (() => {
    if (!error) return ''
    switch (error.kind) {
      case 'term':
        return t('calculator.errors.termRange')
      case 'positive':
        return t('calculator.errors.positiveAmounts')
      case 'variableCap':
        return `${t('calculator.errors.variableCapLine1')}<br />${t('calculator.errors.variableCapLine2')}`
    }
  })()

  const rowsToShow = scheduleExpanded ? 30 : 15
  const visibleScheduleRows = snapshot.scheduleRows.slice(0, rowsToShow)
  const showExpandButton = snapshot.scheduleYearCount > 15
  const expandLabel = scheduleExpanded
    ? t('calculator.schedule.collapseToFifteen')
    : t('calculator.schedule.expandToYears', { years: snapshot.maxEnteredYears })

  /** Legacy #total-payment-label innerHTML: years number wrapped in a span. */
  const totalPaymentLabelParts =
    termYears === 1 ? (
      t('calculator.results.totalOneYear')
    ) : (
      <>
        {t('calculator.results.totalForYearsPrefix')}
        <span className="term-years-value">{termYears}</span>
        {t('calculator.results.totalForYearsSuffix')}
      </>
    )

  return {
    snapshot,
    error,
    errorMessage,
    errorMessageIsHtml: error?.kind === 'variableCap',
    flaggedTrackIds,
    monthlyPayment: formatCurrency(snapshot.totals.firstPayment),
    highestPayment: formatCurrency(snapshot.totals.highestPayment),
    highestLabelText,
    totalInterest: formatCurrency(snapshot.totals.totalInterest),
    totalPayment: formatCurrency(snapshot.totals.totalPaid),
    totalPaymentLabelParts,
    paymentNote,
    annualFirstYearPayment: formatCurrency(snapshot.annualFirstYearPayment),
    summaryTypes: snapshot.summaryTypes,
    summaryText: snapshot.summaryTypes
      .map((type) => t(`calculator.trackTypes.${type}`))
      .join(' · '),
    incomePlaceholder:
      snapshot.incomePlaceholder !== null ? formatCurrency(snapshot.incomePlaceholder) : undefined,
    capitalPlaceholder:
      snapshot.suggestedEquity !== null ? formatCurrency(snapshot.suggestedEquity) : undefined,
    // Equity note lines: the actual/required equity share, the closing-cost
    // breakdown, then the totals — every number is bold. The closing-cost
    // subtotal (סה"כ עלויות נלוות ומיסים) always closes the list.
    equityNoteLines: (() => {
      const lines: ReactNode[] = []
      // Purchase tax first — "not applicable up to the exemption" for a first
      // home, otherwise the amount for a second home and beyond.
      if (snapshot.closingCosts !== null) {
        if (snapshot.closingCosts.purchaseTax === 0) {
          lines.push(
            <Trans
              i18nKey="calculator.warnings.purchaseTaxNone"
              values={{
                purpose: purchaseTaxPurposeLabels[purpose],
                threshold: formatCurrency(FIRST_HOME_TAX_EXEMPTION_UP_TO),
              }}
              components={[<strong key="threshold" />]}
            />,
          )
        } else {
          lines.push(
            <Trans
              i18nKey="calculator.warnings.purchaseTax"
              values={{
                purpose: purchaseTaxPurposeLabels[purpose],
                amount: formatCurrency(snapshot.closingCosts.purchaseTax),
                percent: formatRatePercent(snapshot.closingCosts.purchaseTaxPercent),
              }}
              components={[<strong key="taxAmount" />, <strong key="taxPercent" />]}
            />,
          )
        }
      }
      // The equity share (actual or required).
      if (snapshot.equity) {
        lines.push(
          <Trans
            i18nKey="calculator.warnings.equity"
            values={{ percent: snapshot.equity.percent }}
            components={[<strong key="equity-percent" />]}
          />,
        )
      } else if (snapshot.suggestedEquity !== null) {
        lines.push(
          <Trans
            i18nKey="calculator.warnings.equityRequired"
            values={{
              required: formatCurrency(snapshot.suggestedEquity),
              requiredPercent: requiredEquityPercent,
            }}
            components={[<strong key="required" />, <strong key="requiredPercent" />]}
          />,
        )
      }
      // Side costs (attorney, registration & surveyor).
      if (snapshot.closingCosts !== null) {
        lines.push(
          <Trans
            i18nKey="calculator.warnings.closingCosts"
            values={{
              amount: formatCurrency(snapshot.closingCosts.sideCosts),
              percent: snapshot.closingCosts.sideCostsPercent,
            }}
            components={[<strong key="sideAmount" />, <strong key="sidePercent" />]}
          />,
        )
      }
      // Overall cash needed upfront (equity + all closing costs).
      if (snapshot.suggestedEquity !== null && snapshot.closingCosts !== null) {
        lines.push(
          <>
            {t('calculator.warnings.equityTotalPrefix')}
            <strong>
              {formatCurrency(snapshot.suggestedEquity + snapshot.closingCosts.total)}
            </strong>
          </>,
        )
      }
      // Closing-cost subtotal — always the last line when it applies.
      if (snapshot.closingCosts !== null && snapshot.closingCosts.purchaseTax !== 0) {
        lines.push(
          <Trans
            i18nKey="calculator.warnings.closingCostsTotal"
            values={{ total: formatCurrency(snapshot.closingCosts.total) }}
            components={[<strong key="total" />]}
          />,
        )
      }
      return lines
    })(),
    equityState: snapshot.equity?.state ?? null,
    warningMessages,
    visibleScheduleRows,
    showExpandButton,
    expandLabel,
    purposeLimits: PURPOSE_LIMITS,
  }
}
