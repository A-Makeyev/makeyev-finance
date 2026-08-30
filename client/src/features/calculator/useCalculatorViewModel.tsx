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
  effectiveAnnualRatePercent,
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
 * legacy "•" bullets were removed — a line carries exactly one marker
 * (feedback request).
 */
function mark(status: NoteStatus, node: ReactNode): { status: NoteStatus; node: ReactNode } {
  return {
    status,
    node: (
      <>
        {NOTE_ICONS[status]} {node}
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
  const scheduleExpanded = useCalculatorStore((s) => s.scheduleExpanded)
  const purpose = useCalculatorStore((s) => s.purpose)
  const propertyValueText = useCalculatorStore((s) => s.propertyValueText)
  const capitalText = useCalculatorStore((s) => s.capitalText)
  const incomeText = useCalculatorStore((s) => s.incomeText)
  const tracks = useCalculatorStore((s) => s.tracks)
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

  // Regulatory-limit messages: equity shortfall and LTV violations are "bad"
  // (red ❌); the DTI explanation is general info (ℹ️) — feedback request.
  const warningMessages: NoteLine[] = []
  // Entered equity below the required amount → tell the user how much more.
  // When the equity-percent line (below) already folds in the shortfall, the
  // standalone message is skipped — feedback request (mix together). With no
  // loan entered there is nothing to report, so skip the shortfall too.
  if (
    !snapshot.isEmpty &&
    snapshot.equityShortfall &&
    snapshot.suggestedEquity !== null &&
    !snapshot.equity
  ) {
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.equityShortfall"
          values={{
            required: formatCurrency(snapshot.suggestedEquity),
            requiredPercent: requiredEquityPercent,
          }}
          components={[<strong key="es-required" />, <strong key="es-pct" />]}
        />,
      ),
    )
  }
  if (snapshot.equity) {
    // Rendered separately under the inputs row (legacy #equity-note).
  }
  // Raw inputs needed to report a compliant LTV/DTI (the store only carries
  // the *violated* assessments — feedback request: when conditions are met,
  // show the same message as a green ✔️ positive line).
  const propertyValue = parseAmountText(propertyValueText)
  const capital = parseAmountText(capitalText)
  const income = parseAmountText(incomeText)
  const loanAmount = tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital

  if (snapshot.ltv) {
    // Precise ratio (e.g. 75.3%) so the warning never reads as
    // "75% exceeds 75%" when the true ratio is just above the limit.
    const ltvPercent = Number.isInteger(snapshot.ltv.percent)
      ? String(snapshot.ltv.percentRounded)
      : snapshot.ltv.percent.toFixed(1)
    // The violation and the "what the bank allows" follow-up read as one bad
    // line — feedback request (sum them together).
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
      const ltvPercent = Number.isInteger(percent) ? String(Math.round(percent)) : percent.toFixed(1)
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
    // one brief line — the shortfall is bad news (red ❌).
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
  // Each track gets its own table; the expand toggle reveals up to 30 rows
  // in every table at once.
  const visibleScheduleTracks = snapshot.scheduleTracks.map((track) => ({
    ...track,
    rows: track.rows.slice(0, rowsToShow),
  }))
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

  // Equity note lines: the actual/required equity share, the closing-cost
  // breakdown, then the totals — every number is bold. The closing-cost
  // subtotal (סה"כ עלויות נלוות ומיסים) always closes the list.
  const equityNoteLines: NoteLine[] = (() => {
    const lines: NoteLine[] = []
    // Below a real home value there is nothing meaningful to summarize — hide
    // the equity/closing-cost lines entirely (capital/income hints still work).
    if (propertyValue > 0 && propertyValue < MIN_REAL_HOME_VALUE) return lines
    // With no loan entered (track amounts empty) there is nothing meaningful
    // to summarize — hide the equity/closing-cost lines until a real
    // calculation exists.
    if (snapshot.isEmpty) return lines
    // The equity share (actual or required) leads the list — any share that
    // meets the requirement (good or neutral) is good news; only a share
    // below the required amount is bad. When it's below the required amount,
    // the shortfall folds into the same line.
    if (snapshot.equity) {
      if (snapshot.equityShortfall && snapshot.suggestedEquity !== null) {
        lines.push(
          mark(
            'negative',
            <Trans
              i18nKey="calculator.warnings.equityPercentRequired"
              values={{
                percent: snapshot.equity.percent,
                required: formatCurrency(snapshot.suggestedEquity),
                requiredPercent: requiredEquityPercent,
              }}
              components={[
                <strong key="equity-percent" />,
                <strong key="required" />,
                <strong key="requiredPercent" />,
              ]}
            />,
          ),
        )
      } else {
        const state = snapshot.equity.state
        lines.push(
          mark(
            state === 'bad' ? 'negative' : 'positive',
            <Trans
              i18nKey="calculator.warnings.equity"
              values={{ percent: snapshot.equity.percent }}
              components={[<strong key="equity-percent" />]}
            />,
          ),
        )
      }
    } else if (snapshot.suggestedEquity !== null) {
      // Requirement is general info, not good or bad news.
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.equityRequired"
            values={{
              required: formatCurrency(snapshot.suggestedEquity),
              requiredPercent: requiredEquityPercent,
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
    // Side costs (attorney, registration & surveyor) — general info.
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
    // Overall cash needed upfront (equity + all side costs & taxes) — the
    // two legacy totals merged into one line (feedback request). The total
    // reflects the *actual* equity entered; only when none is entered does
    // it fall back to the required (suggested) equity.
    if (snapshot.suggestedEquity !== null && snapshot.closingCosts !== null) {
      const equityForTotal = capital > 0 ? capital : snapshot.suggestedEquity
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.equityTotalRequired"
            values={{ total: formatCurrency(equityForTotal + snapshot.closingCosts.total) }}
            components={[<strong key="total" />]}
          />,
        ),
      )
    }
    return lines
  })()

  // Everything on one list, grouped by status: good → bad → info
  // (feedback request), with one uniform font size and no yellow tint.
  const summaryNotes: NoteLine[] = [...equityNoteLines, ...warningMessages].sort(
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
    effectiveRate: formatRatePercent(effectiveAnnualRatePercent(snapshot.avgInterestRate)),
    avgPayback: formatRatio(snapshot.avgPaybackRatio),
    trackPaybacks: snapshot.trackPaybacks,
    annualFirstYearPayment: formatCurrency(snapshot.annualFirstYearPayment),
    summaryTypes: snapshot.summaryTypes,
    summaryText: snapshot.summaryTypes
      .map((type) => t(`calculator.trackTypes.${type}`))
      .join(' · '),
    // Hints carry no ₪ — the MoneyInput already renders its own suffix symbol.
    incomePlaceholder:
      snapshot.incomePlaceholder !== null ? formatGroupedNumber(snapshot.incomePlaceholder) : undefined,
    capitalPlaceholder:
      snapshot.suggestedEquity !== null ? formatGroupedNumber(snapshot.suggestedEquity) : undefined,
    equityNoteLines,
    summaryNotes,
    allGood,
    equityState: snapshot.equity?.state ?? null,
    warningMessages,
    visibleScheduleRows,
    visibleScheduleTracks,
    showExpandButton,
    expandLabel,
    purposeLimits: PURPOSE_LIMITS,
  }
}
