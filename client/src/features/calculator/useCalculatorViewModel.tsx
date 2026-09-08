import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import {
  formatCurrency,
  formatGroupedNumber,
  formatRatePercent,
  formatRatio,
  FEE_NORM_PERCENT,
  isFeeAboveNorm,
  parseAmountText,
} from '@/lib/format'
import {
  FIRST_HOME_TAX_EXEMPTION_UP_TO,
  LAWYER_MINIMUM_FEE,
  MAX_YEARS,
  MIN_REAL_HOME_VALUE,
  PURPOSE_LIMITS,
  VAT_RATE,
  allowedMonthlyPayment,
  effectiveAnnualRatePercent,
  paymentExceedsAllowed,
  suggestedIncomeForAllowance,
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
 * (feedback request). `order` optionally ranks lines within their status
 * group (lower first); lines without it keep insertion order after ranked
 * ones.
 */
function mark(status: NoteStatus, node: ReactNode, order?: number): NoteLine {
  return {
    status,
    node: (
      <>
        <span className="note-icon">{NOTE_ICONS[status]}</span>
        {node}
      </>
    ),
    order,
  }
}

export type NoteLine = { status: NoteStatus; node: ReactNode; order?: number }

/** The lawyer minimum as the user sees it: VAT-inclusive whole shekels. */
const LAWYER_FLOOR_WITH_VAT = formatGroupedNumber(Math.round(LAWYER_MINIMUM_FEE * (1 + VAT_RATE)))

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
  const realtorPercentText = useCalculatorStore((s) => s.realtorPercentText)
  const lawyerPercentText = useCalculatorStore((s) => s.lawyerPercentText)
  const renovationText = useCalculatorStore((s) => s.renovationAmountText)
  const incomeText = useCalculatorStore((s) => s.incomeText)
  const otherExpenses = useCalculatorStore((s) => s.otherExpenses)
  const ptiThresholdPercent = useCalculatorStore((s) => s.ptiThresholdPercent)
  const realtorPercentHint = useCalculatorStore((s) => s.realtorPercentHint)
  const lawyerPercentHint = useCalculatorStore((s) => s.lawyerPercentHint)
  const realtorAmountHint = useCalculatorStore((s) => s.realtorAmountHint)
  const lawyerAmountHint = useCalculatorStore((s) => s.lawyerAmountHint)
  const lawyerFloorApplied = useCalculatorStore((s) => s.lawyerFloorApplied)
  const realtorNormAmount = useCalculatorStore((s) => s.realtorNormAmount)
  const lawyerNormAmount = useCalculatorStore((s) => s.lawyerNormAmount)
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

  // The bank's required equity - shown in full everywhere (line, shortfall,
  // placeholder). No netting against one-time payments: the bank's requirement
  // is fixed, and the itemized costs stay separate so the summary's lines sum
  // exactly to the upfront total. Null without a requirement.
  const requiredCapital = snapshot.suggestedCapital

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
    (requiredCapital ?? 0) > 0 &&
    !snapshot.capitalAssessment
  ) {
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.capitalShortfall"
          values={{
            required: formatCurrency(requiredCapital ?? snapshot.suggestedCapital),
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
  const loanAmount = tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capitalForLoan
  const incomeValue = parseAmountText(incomeText)
  const otherTotal = otherExpenses.reduce(
    (sum, expense) => sum + parseAmountText(expense.amountText),
    0,
  )

  // Financing compliant with the purpose limit - the green mirror of the LTV
  // violation, computed once so the capital line and the standalone LTV line
  // agree on when the merged capital+financing line renders. Null when the
  // ratio is violated or there is nothing to measure.
  const ltvOkPercent = (() => {
    if (snapshot.isEmpty || effectiveValue < MIN_REAL_HOME_VALUE || loanAmount <= 0) return null
    const percent = (loanAmount / effectiveValue) * 100
    if (percent > PURPOSE_LIMITS[purpose].limit + 0.01) return null
    return Number.isInteger(percent) ? String(Math.round(percent)) : percent.toFixed(1)
  })()
  // The plain (non-shortfall) capital share line - the one candidate for
  // folding the compliant-financing note into one line.
  const capitalPlain =
    !!snapshot.capitalAssessment &&
    snapshot.capitalAssessment.state !== 'bad' &&
    !(snapshot.capitalShortfall && snapshot.suggestedCapital !== null && (requiredCapital ?? 0) > 0)
  const capitalLtvMerged = capitalPlain && ltvOkPercent !== null

  if (snapshot.ltv) {
    // Precise ratio (e.g. 75.3%) so the warning never reads as
    // "75% exceeds 75%" when the true ratio is just above the limit.
    const ltvPercent = Number.isInteger(snapshot.ltv.percent)
      ? String(snapshot.ltv.percentRounded)
      : snapshot.ltv.percent.toFixed(1)
    // The violation alone; the remedy (max mortgage + required capital)
    // lives on the 💡 required-payment line above (feedback request).
    warningMessages.push(
      mark(
        'negative',
        <Trans
          i18nKey="calculator.warnings.ltv"
          values={{
            percent: ltvPercent,
            purpose: purposeLabels[snapshot.ltv.purpose],
            limit: snapshot.ltv.limit,
          }}
          components={[<strong key="ltv-percent" />, <strong key="ltv-limit" />]}
        />,
      ),
    )
  } else if (ltvOkPercent !== null && !capitalLtvMerged) {
    // Compliant financing ratio → green ✔️ mirror of the violation line.
    // Skipped when the capital line already folded it in (one line, not two).
    warningMessages.push(
      mark(
        'positive',
        <Trans
          i18nKey="calculator.warnings.ltvOk"
          values={{
            percent: ltvOkPercent,
            purpose: purposeLabels[purpose],
            limit: PURPOSE_LIMITS[purpose].limit,
          }}
          components={[<strong key="ltv-percent" />, <strong key="ltv-limit" />]}
        />,
      ),
    )
  }
  // One affordability line: the monthly payment the adjustable PTI ceiling
  // allows for THIS buyer (the תקרת החזר share of net income minus the listed
  // recurring liabilities) vs the required payment. Red ❌ when the required
  // payment exceeds the allowance, with the minimum income that would fit
  // mixed into the same line; green ✔️ when it fits - one rule, one number,
  // one control. The wording mirrors the LTV lines ("עומד במותר" /
  // "חורג מהמותר") per feedback; kept terse: "פחות" without naming the
  // payments, "נדרשת הכנסה" without repeating the payment (the 💡 fact line
  // above carries it).
  const firstPayment = snapshot.totals.firstPayment
  const allowedPayment = allowedMonthlyPayment(incomeValue, otherTotal, ptiThresholdPercent)
  // The term behind the required payment: every amount-bearing track's
  // years. Tracks usually share the term slider, printing "15"; when they
  // diverge the honest range prints instead ("5-30") - the first payment is
  // the sum across them. Stating the term inline keeps the warning
  // comparable against bank quotes and calculators that assume another
  // term (a 25-year quote reads very differently from a 15-year one).
  const enteredYears = tracks
    .filter((track) => parseAmountText(track.amountText) > 0)
    .map((track) => Number(track.yearsText))
    .filter((years) => Number.isFinite(years) && years >= 1 && years <= MAX_YEARS)
  const termText = (() => {
    if (enteredYears.length === 0) return null
    const min = Math.min(...enteredYears)
    const max = Math.max(...enteredYears)
    return min === max ? String(min) : `${min}-${max}`
  })()
  // The required payment is a neutral fact on its own 💡 line in every
  // scenario: the verdict lines below stay short and never repeat it
  // (feedback). Stating the term inline keeps the figure comparable against
  // quotes and calculators that assume another term. Order 1 places it as
  // the second info line, right after the capital-requirement line
  // (feedback), ahead of the transaction-cost line.
  if (firstPayment > 0) {
    warningMessages.push(
      mark(
        'info',
        <Trans
          i18nKey="calculator.warnings.requiredPayment"
          values={{ payment: formatCurrency(firstPayment), term: termText ?? '' }}
          components={[<strong key="rp-term" />, <strong key="rp-payment" />]}
        />,
        1,
      ),
    )
    // With no income entered there is no verdict to grade against; when the
    // financing ratio is also violated, the remedy (max mortgage + the
    // capital that unlocks it) is its own 💡 line, not a tail on the ❌ LTV
    // line (feedback request).
    if (allowedPayment === null && snapshot.ltv) {
      warningMessages.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.ltvMaxLoan"
            values={{
              maxLoan: formatCurrency(snapshot.ltv.maxLoan),
              // The capital that unlocks that max loan (same figure the
              // capital lines show).
              requiredCapital: formatCurrency(requiredCapital ?? 0),
            }}
            components={[<strong key="ltv-maxloan" />, <strong key="ltv-required-capital" />]}
          />,
        ),
      )
    }
  }
  if (allowedPayment !== null && firstPayment > 0) {
    if (allowedPayment === 0) {
      // The listed monthly payments exhaust the whole net income - "up to 0 ₪"
      // would be nonsense, so say outright that there is no room.
      warningMessages.push(
        mark(
          'negative',
          <Trans
            i18nKey="calculator.warnings.monthlyAllowanceNone"
            values={{
              term: termText ?? '',
              income: formatCurrency(incomeValue),
              liabilities: formatCurrency(otherTotal),
            }}
            components={[
              <strong key="man-term" />,
              <strong key="man-liabilities" />,
              <strong key="man-income" />,
            ]}
          />,
        ),
      )
    } else {
      const overAllowance = paymentExceedsAllowed(firstPayment, allowedPayment)
      // Every variant shows the entered income in the 33% parenthetical so
      // the verdict stands on the entered figures; a תשלום חודשי is
      // additionally addressed by name with its number (income minus
      // monthly payments).
      const hasLiabilities = otherTotal > 0
      // When the ceiling is exceeded the verdict also names the minimum
      // income that would fit the payment - mixed into the ❌ line (feedback)
      // instead of a separate 💡 line. The ❌ wording names the expected
      // payment itself (the figure the income must cover) instead of the
      // allowance, per feedback.
      const minIncome = overAllowance
        ? suggestedIncomeForAllowance(firstPayment, otherTotal, ptiThresholdPercent)
        : null
      const allowanceValues = {
        allowed: formatCurrency(allowedPayment),
        payment: formatCurrency(firstPayment),
        income: formatCurrency(incomeValue),
        percent: String(ptiThresholdPercent),
        liabilities: formatCurrency(otherTotal),
        minIncome: minIncome !== null ? formatCurrency(minIncome) : '',
      }
      // Tag order must match the strings: allowed, percent, income, then
      // monthly payments when they exist, then the minimum income when the
      // ceiling is exceeded. The payment and its term live on the 💡 fact
      // line above, keeping the verdict short (feedback).
      const components = [<strong key="ma-allowed" />, <strong key="ma-percent" />]
      components.push(<strong key="ma-income" />)
      if (hasLiabilities) {
        components.push(<strong key="ma-liabilities" />)
      }
      if (overAllowance) {
        components.push(<strong key="ma-min-income" />)
      }
      warningMessages.push(
        mark(
          overAllowance ? 'negative' : 'positive',
          <Trans
            i18nKey={
              hasLiabilities
                ? overAllowance
                  ? 'calculator.warnings.monthlyAllowanceOver'
                  : 'calculator.warnings.monthlyAllowanceOk'
                : overAllowance
                  ? 'calculator.warnings.monthlyAllowanceOverNoLiabilities'
                  : 'calculator.warnings.monthlyAllowanceOkNoLiabilities'
            }
            values={allowanceValues}
            components={
              overAllowance
                ? [
                    <strong key="ma-payment" />,
                    <strong key="ma-percent" />,
                    <strong key="ma-income" />,
                    ...(hasLiabilities ? [<strong key="ma-liabilities" />] : []),
                    <strong key="ma-min-income" />,
                  ]
                : components
            }
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
    // The capital/closing-cost lines need a property basis (typed value, or
    // loan+capital when the value is blank) - they show even when no loan is
    // needed ("אין צורך 🥳"), because the upfront cash question (capital,
    // purchase tax, fees) still stands. Only a fully empty form hides them.
    if (effectiveValue <= 0) return lines
    // The capital share (actual or required) leads the list - any share that
    // meets the requirement (good or neutral) is good news; only a share
    // below the required amount is bad. When it's below the required amount,
    // the shortfall folds into the same line.
    if (snapshot.capitalAssessment) {
      if (
        snapshot.capitalShortfall &&
        snapshot.suggestedCapital !== null &&
        (requiredCapital ?? 0) > 0
      ) {
        lines.push(
          mark(
            'negative',
            <Trans
              i18nKey="calculator.warnings.capitalPercentRequired"
              values={{
                percent: snapshot.capitalAssessment.percent,
                required: formatCurrency(requiredCapital ?? snapshot.suggestedCapital),
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
        if (capitalLtvMerged) {
          // One green line: the capital share and the compliant financing
          // ratio, instead of two separate ✔️ lines saying the same thing.
          lines.push(
            mark(
              'positive',
              <Trans
                i18nKey="calculator.warnings.capitalLtvOk"
                values={{
                  percent: snapshot.capitalAssessment.percent,
                  ltvPercent: ltvOkPercent,
                  purpose: purposeLabels[purpose],
                  limit: PURPOSE_LIMITS[purpose].limit,
                }}
                components={[
                  <strong key="capital-percent" />,
                  <strong key="ltv-percent" />,
                  <strong key="ltv-limit" />,
                ]}
              />,
            ),
          )
        } else {
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
      }
    } else if (snapshot.suggestedCapital !== null && (requiredCapital ?? 0) > 0) {
      // Requirement is general info, not good or bad news. Order 0 leads the
      // info group so the 💡 payment fact (order 1) lands right after it
      // (feedback).
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.capitalRequired"
            values={{
              required: formatCurrency(requiredCapital ?? snapshot.suggestedCapital),
              requiredPercent: requiredCapitalPercent,
            }}
            components={[<strong key="required" />, <strong key="requiredPercent" />]}
          />,
          0,
        ),
      )
    }

    if (snapshot.closingCosts !== null) {
      if (snapshot.closingCosts.purchaseTax === 0) {
        // "Tax-free up to X" is only meaningful against a TYPED price - with
        // no typed שווי הנכס the effective basis is loan+capital, and showing
        // the exemption against it confused users ("why is this here?").
        // The regular tax line (below) still shows, since it quotes numbers.
        if (propertyValue > 0) {
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
        }
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
    // Transaction fees (realtor / lawyer / appraiser) plus the planned
    // renovation budget and each named one-time expense - every upfront
    // item on one line, built programmatically so items appear only when
    // they carry an amount. No subtotal here: the upfront-total line below
    // is the sum the user needs, and a second total just repeated it.
    const tx = snapshot.transactionCosts
    // Fees typed above their market norm (realtor 2%, lawyer 0.5%) get a
    // red ❌ warning - one line per offender, so two above-norm fees read
    // as two separate warnings instead of one run-on list.
    if (tx !== null && isFeeAboveNorm('realtor', realtorPercentText)) {
      lines.push(
        mark(
          'negative',
          <Trans
            i18nKey="calculator.warnings.feeAboveNormItem"
            values={{
              fee: t('calculator.feeLabels.realtor'),
              percent: realtorPercentText,
              normPercent: FEE_NORM_PERCENT.realtor,
              normAmount: formatCurrency(parseAmountText(realtorNormAmount ?? '')),
            }}
            components={[
              <strong key="fee-norm-percent" />,
              <strong key="fee-norm-norm" />,
              <strong key="fee-norm-amount" />,
            ]}
          />,
        ),
      )
    }
    if (tx !== null && isFeeAboveNorm('lawyer', lawyerPercentText)) {
      lines.push(
        mark(
          'negative',
          <Trans
            i18nKey="calculator.warnings.feeAboveNormItem"
            values={{
              fee: t('calculator.feeLabels.lawyer'),
              percent: lawyerPercentText,
              normPercent: FEE_NORM_PERCENT.lawyer,
              normAmount: formatCurrency(parseAmountText(lawyerNormAmount ?? '')),
            }}
            components={[
              <strong key="fee-norm-percent" />,
              <strong key="fee-norm-norm" />,
              <strong key="fee-norm-amount" />,
            ]}
          />,
        ),
      )
    }
    if (tx !== null) {
      const items: Array<{ label: string; amount: string }> = [
        { label: t('calculator.feeLabels.realtor'), amount: formatCurrency(tx.realtor) },
        { label: t('calculator.feeLabels.lawyer'), amount: formatCurrency(tx.lawyer) },
      ]
      // שמאי appears only when typed - a blank field means "no appraiser",
      // so the line never advertises a cost the user didn't enter.
      if (tx.appraiser > 0) {
        items.push({
          label: t('calculator.feeLabels.appraiser'),
          amount: formatCurrency(tx.appraiser),
        })
      }
      if (tx.renovations > 0) {
        items.push({
          label: t('calculator.feeLabels.renovations'),
          amount: formatCurrency(tx.renovations),
        })
      }
      for (const expense of otherExpenses) {
        const oneTime = parseAmountText(expense.oneTimeAmountText)
        if (oneTime > 0) {
          items.push({
            // An unnamed expense falls back to the generic noun, not the
            // field caption ("הוצאה 123 ₪", not "תיאור ההוצאה 123 ₪").
            label: expense.label.trim() || t('calculator.feeLabels.expense'),
            amount: formatCurrency(oneTime),
          })
        }
      }
      lines.push(
        mark(
          'info',
          <Trans
            i18nKey="calculator.warnings.transactionCosts"
            values={{
              items: items.map((item) => `${item.label} <0>${item.amount}</0>`).join(' · '),
            }}
            components={[<strong key="tx-amount" />]}
          />,
        ),
      )
    }
    // Grand upfront total: capital + purchase tax + fees & one-time
    // expenses, rounded to ₪500 - the single "how much cash do I need"
    // number. The wording enumerates the parts so it's clear the required
    // capital figure above is equity alone and this line is everything.
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
  // Within a group an explicit `order` ranks ahead of insertion order - the
  // payment fact leads the info group, before the transaction-cost line.
  const summaryNotes: NoteLine[] = [...capitalNoteLines, ...warningMessages].sort((a, b) => {
    const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (byStatus !== 0) return byStatus
    const aOrder = a.order ?? Number.POSITIVE_INFINITY
    const bOrder = b.order ?? Number.POSITIVE_INFINITY
    return aOrder - bOrder
  })
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
      snapshot.suggestedCapital !== null && (requiredCapital ?? 0) > 0
        ? formatGroupedNumber(requiredCapital ?? snapshot.suggestedCapital)
        : undefined,
    // שווי הנכס hint - the smallest value satisfying both the purpose's
    // financing limit and the ₪100k minimum-equity rule. Only while the
    // property-value field is blank and a meaningful mortgage is entered.
    propertyValuePlaceholder: (() => {
      if (propertyValue > 0) return undefined
      const hint = suggestedPropertyValue(loanAmount, purpose)
      return hint !== null ? formatGroupedNumber(hint) : undefined
    })(),
    // The realtor/lawyer ₪ fee fields only make sense once a fee basis
    // exists (property value, or the loan + capital fallback).
    feeAmountsVisible: snapshot.transactionCosts !== null,
    // Hint placeholders for cleared fee fields: the market default each
    // cleared pair falls back to (shown like the שווי הנכס hint).
    realtorPercentHint,
    lawyerPercentHint,
    realtorAmountHint,
    lawyerAmountHint,
    // Why a typed lawyer fee snapped up: the ₪6,000 pre-VAT minimum took
    // over (false when the fee is cleared, at/above the floor, or basisless).
    lawyerFloorApplied,
    lawyerFloorAmount: LAWYER_FLOOR_WITH_VAT,
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
