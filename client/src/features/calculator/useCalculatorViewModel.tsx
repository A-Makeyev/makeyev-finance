import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import {
  formatCurrency,
  formatGroupedNumber,
  formatRatePercent,
  formatRatio,
  parseAmountText,
} from '@/lib/format'
import {
  DTI_THRESHOLD,
  FIRST_HOME_TAX_EXEMPTION_UP_TO,
  MIN_REAL_HOME_VALUE,
  PURPOSE_LIMITS,
  VAT_RATE,
  DEFAULT_APPRAISER_FEE,
  effectiveAnnualRatePercent,
  suggestedMortgagePayment,
  suggestedPropertyValue,
  isVariableType,
  type PaymentLabelKind,
  type PropertyPurpose,
} from '@/lib/amortization'

/** Line status for the summary notes: good news, bad news, or general info. */
export type NoteStatus = 'positive' | 'negative' | 'info'

const NOTE_ICONS: Record<NoteStatus, string> = {
  positive: '✔️',
  negative: '❌',
  info: '💡',
}

/** Sort order for grouping summary lines: good news first, then bad, then info. */
const STATUS_PRIORITY: Record<NoteStatus, number> = { positive: 0, negative: 1, info: 2 }

/**
 * Tags a summary line with its status and leads with the matching emoji. The
 * legacy "•" bullets were removed - a line carries exactly one marker
 * (feedback request).
 */
function mark(status: NoteStatus, node: ReactNode): { status: NoteStatus; node: ReactNode } {
  return {
    status,
    node: (
      <>
        <span className="note-icon">{NOTE_ICONS[status]}</span>
        {node}
      </>
    ),
  }
}

export type NoteLine = { status: NoteStatus; node: ReactNode }

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
  const purpose = useCalculatorStore((s) => s.purpose)
  const propertyValueText = useCalculatorStore((s) => s.propertyValueText)
  const capitalText = useCalculatorStore((s) => s.capitalText)
  const renovationText = useCalculatorStore((s) => s.renovationAmountText)
  const incomeText = useCalculatorStore((s) => s.incomeText)
  const otherExpenses = useCalculatorStore((s) => s.otherExpenses)
  const ptiThresholdPercent = useCalculatorStore((s) => s.ptiThresholdPercent)
  const tracks = useCalculatorStore((s) => s.tracks)
  const requiredCapitalPercent = 100 - PURPOSE_LIMITS[purpose].limit

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

  // Regulatory-limit messages: capital shortfall and LTV violations are "bad"
  // (red ❌); the DTI explanation is general info (ℹ️) - feedback request.
  const warningMessages: NoteLine[] = []
  // Entered capital below the required amount → tell the user how much more.
  // When the capital-percent line (below) already folds in the shortfall, the
  // standalone message is skipped - feedback request (mix together). With no
  // loan entered there is nothing to report, so skip the shortfall too.
  if (
    !snapshot.isEmpty &&
    snapshot.capitalShortfall &&
    snapshot.suggestedCapital !== null &&
    !snapshot.capitalAssessment
  ) {
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.capitalShortfall"
          values={{
            required: formatCurrency(snapshot.suggestedCapital),
            requiredPercent: requiredCapitalPercent,
          }}
          components={[<strong key="es-required" />, <strong key="es-pct" />]}
        />,
      ),
    )
  }
  if (snapshot.capitalAssessment) {
    // Rendered separately under the inputs row (legacy #equity-note).
  }
  // Raw inputs needed to report a compliant LTV/DTI (the store only carries
  // the *violated* assessments - feedback request: when conditions are met,
  // show the same message as a green ✔️ positive line).
  const propertyValue = parseAmountText(propertyValueText)
  const capital = parseAmountText(capitalText)
  // Renovations (שיפוצים) eat into the capital - the down-payment equity left
  // is what the LTV ratio reflects, mirroring the store's loan derivation.
  const capitalForLoan = Math.max(0, capital - parseAmountText(renovationText))
  const income = parseAmountText(incomeText)
  const loanAmount = tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capitalForLoan
  const incomeValue = parseAmountText(incomeText)
  const otherTotal = otherExpenses.reduce(
    (sum, expense) => sum + parseAmountText(expense.amountText),
    0,
  )
  const recommendedMortgagePayment =
    incomeValue > 0
      ? formatCurrency(suggestedMortgagePayment(incomeValue, otherTotal, ptiThresholdPercent))
      : null

  if (snapshot.ltv) {
    // Precise ratio (e.g. 75.3%) so the warning never reads as
    // "75% exceeds 75%" when the true ratio is just above the limit.
    const ltvPercent = Number.isInteger(snapshot.ltv.percent)
      ? String(snapshot.ltv.percentRounded)
      : snapshot.ltv.percent.toFixed(1)
    // The violation and the "what the bank allows" follow-up read as one bad
    // line - feedback request (sum them together).
    warningMessages.push(
      mark(
        'negative',
        <>
          <Trans
            i18nKey="calculator.warnings.ltv"
            values={{
              percent: ltvPercent,
              purpose: purposeLabels[snapshot.ltv.purpose],
              limit: snapshot.ltv.limit,
            }}
            components={[<strong key="ltv-percent" />, <strong key="ltv-limit" />]}
          />
          {' ~ '}
          <Trans
            i18nKey="calculator.warnings.ltvMaxLoan"
            values={{ maxLoan: formatCurrency(snapshot.ltv.maxLoan) }}
            components={[<strong key="ltv-maxloan" />]}
          />
        </>,
      ),
    )
  } else if (!snapshot.isEmpty && effectiveValue >= MIN_REAL_HOME_VALUE && loanAmount > 0) {
    // Compliant financing ratio → green ✔️ mirror of the violation line.
    const percent = (loanAmount / effectiveValue) * 100
    const limit = PURPOSE_LIMITS[purpose].limit
    if (percent <= limit + 0.01) {
      const ltvPercent = Number.isInteger(percent)
        ? String(Math.round(percent))
        : percent.toFixed(1)
      warningMessages.push(
        mark(
          'positive',
          <Trans
            i18nKey="calculator.warnings.ltvOk"
            values={{ percent: ltvPercent, purpose: purposeLabels[purpose], limit }}
            components={[<strong key="ltv-percent" />, <strong key="ltv-limit" />]}
          />,
        ),
      )
    }
  }
  if (snapshot.dti) {
    // The payment shortfall and the bank's income requirement combine into
    // one brief line - the shortfall is bad news (red ❌).
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.dti"
          values={{
            shortfall: snapshot.dti.shortfallPercent,
            minIncome: formatCurrency(snapshot.dti.minIncome),
          }}
          components={[<strong key="dti-shortfall" />, <strong key="dti-minincome" />]}
        />,
      ),
    )
  } else if (!snapshot.isEmpty && snapshot.totals.firstPayment > 0 && income > 0) {
    // Payment within the 50% ceiling → green ✔️ mirror of the violation line.
    if (snapshot.totals.firstPayment / income <= DTI_THRESHOLD) {
      warningMessages.push(
        mark(
          'positive',
          <Trans
            i18nKey="calculator.warnings.dtiOk"
            values={{ payment: formatCurrency(snapshot.totals.firstPayment) }}
            components={[<strong key="dti-ok-payment" />]}
          />,
        ),
      )
    }
  }

  if (snapshot.pti) {
    // Soft payment-to-income guidance: the outflow (mortgage + listed
    // recurring expenses) exceeds the user-adjusted ceiling. Other
    // expenses are folded into the payment; the suggestion is the income
    // at which the same outflow meets the ceiling.
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.pti"
          values={{
            payment: formatCurrency(snapshot.pti.payment),
            threshold: ptiThresholdPercent,
            minIncome: formatCurrency(snapshot.pti.minIncome),
          }}
          components={[<strong key="pti-payment" />, <strong key="pti-minincome" />]}
        />,
      ),
    )
    if (otherTotal <= 0) {
      // No listed expenses: the ceiling hit came from the mortgage payment
      // alone - the reminder is unnecessary noise, skip it.
    } else if (otherExpenses.length === 1) {
      warningMessages.push(
        mark(
          'info',
          t('calculator.warnings.ptiExpenseNote', {
            amount: formatCurrency(otherTotal),
          }),
        ),
      )
    } else {
      warningMessages.push(
        mark(
          'info',
          t('calculator.warnings.ptiExpenseNotePlural', {
            count: otherExpenses.length,
            amount: formatCurrency(otherTotal),
          }),
        ),
      )
    }
  }

  // The recommended-payment guidance (החזר משכנתא מומלץ) joins the summary
  // list - its status mirrors the ceiling check above: green when the entered
  // outflow fits the ceiling, red when it doesn't, neutral info while no
  // mortgage payment is entered yet. The suggestion is the same number as
  // the income hint (income × threshold − other expenses).
  const ptiSuggestedValue = suggestedMortgagePayment(incomeValue, otherTotal, ptiThresholdPercent)
  if (incomeValue > 0 && ptiSuggestedValue > 0) {
    const outflow = snapshot.totals.firstPayment + otherTotal
    const ptiCeiling = ptiSuggestedValue + otherTotal
    const ptiStatus: NoteStatus =
      outflow > 0 && outflow > ptiCeiling ? 'negative' : outflow > 0 ? 'positive' : 'info'
    warningMessages.push(
      mark(
        ptiStatus,
        <Trans
          i18nKey="calculator.ptiSuggestedPayment"
          values={{
            amount: formatCurrency(ptiSuggestedValue),
            threshold: ptiThresholdPercent,
          }}
          components={[<strong key="pti-amount" />]}
        />,
      ),
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

  // Full schedule for both granularities - the tables are scrollable, so
  // there is no expand/pagination control anymore.
  const visibleScheduleRows = snapshot.scheduleRows
  // Monthly view: same horizon as the yearly view, at month granularity.
  const visibleMonthlyRows = snapshot.scheduleMonthlyRows
  // Each track gets its own table, showing its full horizon.
  const visibleScheduleTracks = snapshot.scheduleTracks.map((track) => ({
    ...track,
    rows: track.rows,
    monthlyRows: track.monthlyRows,
  }))

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

  // Capital note lines: the actual/required capital share, the closing-cost
  // breakdown, then the totals - every number is bold. The closing-cost
  // subtotal (סה"כ עלויות נלוות ומיסים) always closes the list.
  const capitalNoteLines: NoteLine[] = (() => {
    const lines: NoteLine[] = []
    // Below a real home value there is nothing meaningful to summarize - hide
    // the capital/closing-cost lines entirely (capital/income hints still work).
    if (propertyValue > 0 && propertyValue < MIN_REAL_HOME_VALUE) return lines
    // With no loan entered (track amounts empty) there is nothing meaningful
    // to summarize - hide the capital/closing-cost lines until a real
    // calculation exists.
    if (snapshot.isEmpty) return lines
    // The capital share (actual or required) leads the list - any share that
    // meets the requirement (good or neutral) is good news; only a share
    // below the required amount is bad. When it's below the required amount,
    // the shortfall folds into the same line.
    if (snapshot.capitalAssessment) {
      if (snapshot.capitalShortfall && snapshot.suggestedCapital !== null) {
        lines.push(
          mark(
            'negative',
            <Trans
              i18nKey="calculator.warnings.capitalPercentRequired"
              values={{
                percent: snapshot.capitalAssessment.percent,
                required: formatCurrency(snapshot.suggestedCapital),
                requiredPercent: requiredCapitalPercent,
              }}
              components={[
                <strong key="capital-percent" />,
                <strong key="required" />,
                <strong key="requiredPercent" />,
              ]}
            />,
          ),
        )
      } else {
        const state = snapshot.capitalAssessment.state
        lines.push(
          mark(
            state === 'bad' ? 'negative' : 'positive',
            <Trans
              i18nKey="calculator.warnings.capital"
              values={{ percent: snapshot.capitalAssessment.percent }}
              components={[<strong key="capital-percent" />]}
            />,
          ),
        )
      }
    } else if (snapshot.suggestedCapital !== null) {
      // Requirement is general info, not good or bad news.
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.capitalRequired"
            values={{
              required: formatCurrency(snapshot.suggestedCapital),
              requiredPercent: requiredCapitalPercent,
            }}
            components={[<strong key="required" />, <strong key="requiredPercent" />]}
          />,
        ),
      )
    }

    if (snapshot.closingCosts !== null) {
      if (snapshot.closingCosts.purchaseTax === 0) {
        lines.push(
          mark(
            'positive',
            <Trans
              i18nKey="calculator.warnings.purchaseTaxNone"
              values={{
                purpose: purchaseTaxPurposeLabels[purpose],
                threshold: formatCurrency(FIRST_HOME_TAX_EXEMPTION_UP_TO),
              }}
              components={[<strong key="threshold" />]}
            />,
          ),
        )
      } else {
        lines.push(
          mark(
            'info',
            <Trans
              i18nKey="calculator.warnings.purchaseTax"
              values={{
                purpose: purchaseTaxPurposeLabels[purpose],
                amount: formatCurrency(snapshot.closingCosts.purchaseTax),
                percent: formatRatePercent(snapshot.closingCosts.purchaseTaxPercent),
              }}
              components={[<strong key="taxAmount" />, <strong key="taxPercent" />]}
            />,
          ),
        )
      }
    }
    // Side costs (attorney, registration & surveyor) - general info.
    if (snapshot.closingCosts !== null) {
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.closingCosts"
            values={{
              amount: formatCurrency(snapshot.closingCosts.sideCosts),
              percent: snapshot.closingCosts.sideCostsPercent,
            }}
            components={[<strong key="sideAmount" />, <strong key="sidePercent" />]}
          />,
        ),
      )
    }
    // Overall cash needed upfront (capital + all side costs & taxes) - the
    // two legacy totals merged into one line (feedback request). The total
    // reflects the *actual* capital entered; only when none is entered does
    // it fall back to the required (suggested) capital.
    if (snapshot.suggestedCapital !== null && snapshot.closingCosts !== null) {
      const capitalForTotal = capital > 0 ? capital : snapshot.suggestedCapital
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.capitalTotalRequired"
            values={{ total: formatCurrency(capitalForTotal + snapshot.closingCosts.total) }}
            components={[<strong key="total" />]}
          />,
        ),
      )
    }
    // Transaction fees (realtor / lawyer / appraiser) plus the planned
    // renovation budget - market norms with VAT, general info. One line per
    // fee plus a subtotal, only when a fee basis exists (property price or
    // loan + capital fallback). The renovations slice appears on the line
    // only when an amount was entered, so a blank field adds no noise.
    const tx = snapshot.transactionCosts
    if (tx !== null) {
      const vatPercent = Math.round(VAT_RATE * 100)
      lines.push(
        mark(
          'info',
          tx.renovations > 0 ? (
            <Trans
              i18nKey="calculator.warnings.transactionCostsWithRenovations"
              values={{
                realtor: formatCurrency(tx.realtor),
                lawyer: formatCurrency(tx.lawyer),
                appraiser: formatCurrency(tx.appraiser),
                renovations: formatCurrency(tx.renovations),
                total: formatCurrency(tx.total),
                vatPercent,
              }}
              components={[
                <strong key="tx-realtor" />,
                <strong key="tx-lawyer" />,
                <strong key="tx-appraiser" />,
                <strong key="tx-renovations" />,
                <strong key="tx-total" />,
              ]}
            />
          ) : (
            <Trans
              i18nKey="calculator.warnings.transactionCosts"
              values={{
                realtor: formatCurrency(tx.realtor),
                lawyer: formatCurrency(tx.lawyer),
                appraiser: formatCurrency(tx.appraiser),
                total: formatCurrency(tx.total),
                vatPercent,
              }}
              components={[
                <strong key="tx-realtor" />,
                <strong key="tx-lawyer" />,
                <strong key="tx-appraiser" />,
                <strong key="tx-total" />,
              ]}
            />
          ),
        ),
      )
    }
    // Grand upfront total: required/entered capital + closing costs + fees,
    // rounded to ₪500 - the single "how much cash do I need" number.
    if (snapshot.upfrontTotal !== null) {
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.upfrontTotal"
            values={{ total: formatCurrency(snapshot.upfrontTotal) }}
            components={[<strong key="upfront-total" />]}
          />,
        ),
      )
    }
    return lines
  })()

  // Everything on one list, grouped by status: good → bad → info
  // (feedback request), with one uniform font size and no yellow tint.
  const summaryNotes: NoteLine[] = [...capitalNoteLines, ...warningMessages].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status],
  )
  // When nothing is wrong (no red ❌ lines), the whole summary reads green.
  const allGood = summaryNotes.every((line) => line.status !== 'negative')

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
    avgRate: formatRatePercent(snapshot.avgInterestRate),
    weightedAvgRate: formatRatePercent(snapshot.weightedAvgInterestRate),
    totalLoanAmount: formatCurrency(
      snapshot.trackPaybacks.reduce((sum, entry) => sum + entry.amount, 0),
    ),
    overpayPercent: formatRatePercent(snapshot.overpayPercent),
    avgMonthlyPayment: formatCurrency(snapshot.avgMonthlyPayment),
    hasVariableTrack: snapshot.summaryTypes.some(isVariableType),
    paymentRateUp1: formatCurrency(snapshot.firstPaymentRateUp1),
    paymentRateUp1Delta: formatRatePercent(
      snapshot.totals.firstPayment > 0
        ? (snapshot.firstPaymentRateUp1 / snapshot.totals.firstPayment - 1) * 100
        : 0,
    ),
    paymentRateDown1: formatCurrency(snapshot.firstPaymentRateDown1),
    paymentRateDown1Delta: formatRatePercent(
      snapshot.totals.firstPayment > 0
        ? (snapshot.firstPaymentRateDown1 / snapshot.totals.firstPayment - 1) * 100
        : 0,
    ),
    first5yInterestShare: formatRatePercent(snapshot.first5yInterestShare),
    paymentPer100k: formatCurrency(snapshot.paymentPer100k),
    firstPaymentInterestShare: formatRatePercent(snapshot.firstPaymentInterestShare),
    balanceAfter5y: formatCurrency(snapshot.balanceAfter5y),
    effectiveRate: formatRatePercent(effectiveAnnualRatePercent(snapshot.avgInterestRate)),
    avgPayback: formatRatio(snapshot.avgPaybackRatio),
    trackPaybacks: snapshot.trackPaybacks,
    annualFirstYearPayment: formatCurrency(snapshot.annualFirstYearPayment),
    summaryTypes: snapshot.summaryTypes,
    summaryText: snapshot.summaryTypes
      .map((type) => t(`calculator.trackTypes.${type}`))
      .join(' · '),
    // Hints carry no ₪ - the MoneyInput already renders its own suffix symbol.
    incomePlaceholder:
      snapshot.incomePlaceholder !== null
        ? formatGroupedNumber(snapshot.incomePlaceholder)
        : undefined,
    capitalPlaceholder:
      snapshot.suggestedCapital !== null
        ? formatGroupedNumber(snapshot.suggestedCapital)
        : undefined,
    // שווי הנכס hint - the smallest value satisfying both the purpose's
    // financing limit and the ₪100k minimum-equity rule. Only while the
    // property-value field is blank and a meaningful mortgage is entered.
    propertyValuePlaceholder: (() => {
      if (propertyValue > 0) return undefined
      const hint = suggestedPropertyValue(loanAmount, purpose)
      return hint !== null ? formatGroupedNumber(hint) : undefined
    })(),
    appraiserPlaceholder: formatGroupedNumber(DEFAULT_APPRAISER_FEE),
    // The realtor/lawyer ₪ fee fields only make sense once a fee basis
    // exists (property value, or the loan + capital fallback).
    feeAmountsVisible: snapshot.transactionCosts !== null,
    recommendedMortgagePayment,
    capitalNoteLines,
    summaryNotes,
    allGood,
    capitalState: snapshot.capitalAssessment?.state ?? null,
    warningMessages,
    visibleScheduleRows,
    visibleMonthlyRows,
    visibleScheduleTracks,
    purposeLimits: PURPOSE_LIMITS,
    otherExpenses,
    ptiThresholdPercent,
  }
}
