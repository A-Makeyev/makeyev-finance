/**
 * Baseline-versus-candidate cash-flow comparison for the compare page.
 *
 * The baseline is an INPUT, not a verdict: the compare page passes its first
 * priced mix, so every other mix is measured against that one. All figures are
 * cumulative over a COMMON horizon, the shorter of the two loan terms, so the
 * remaining balance can be compared at a point where both schedules exist.
 *
 * Sign convention: a positive delta means the CANDIDATE is better.
 * `netCashFlowDelta` is baseline outlay minus candidate outlay, where outlay
 * includes the one-time fees at month 0 and the monthly payments through the
 * horizon. It is cash-flow only: the remaining balance is reported separately
 * as `balanceDelta` (positive = candidate owes less), because a lower payment
 * from a longer term is not savings on its own.
 *
 * Every number is derived from the combined monthly schedule
 * (`combineMonthlySchedules`), never from a second amortization model, so the
 * totals reconcile to the month rows the page already shows.
 */

/** The subset of a combined monthly schedule this comparison needs. */
export interface CashFlowMonth {
  year: number
  month: number
  /** Actual cash paid this month: principal + interest (+ CPI, when indexed). */
  paid: number
  interest: number
  /** CPI drift added to the balance this month (0 when not indexed). */
  indexation: number
  /** Outstanding principal after this month's payment. */
  closing: number
}

export interface CashFlowSide {
  label: string
  months: CashFlowMonth[]
  /** One-time costs paid at closing: closing costs + transaction costs. */
  fees: number
}

export interface CumulativeSavingsPoint {
  /** 1-based month from the start of the comparison. */
  month: number
  /** Calendar year of the loan (1-based), taken from the monthly rows. */
  year: number
  /** Running baseline minus candidate outlay, including fees at month 0. */
  savings: number
}

export interface CashFlowComparison {
  /** The shorter of the two schedules, in months (at least 1 for a real comparison). */
  horizonMonths: number
  horizonYears: number
  baselineLabel: string
  candidateLabel: string
  /** First monthly payment: baseline minus candidate. */
  firstPaymentDelta: number
  /** Interest paid through the horizon: baseline minus candidate. */
  interestDelta: number
  /** CPI drift through the horizon: baseline minus candidate. */
  indexationDelta: number
  /** One-time fees: baseline minus candidate. */
  feesDelta: number
  /**
   * Remaining principal at the horizon: baseline minus candidate. Positive
   * means the candidate owes less. Reported separately from cash flow.
   */
  balanceDelta: number
  /** Total outlay through the horizon: baseline minus candidate. */
  netCashFlowDelta: number
  /** Running savings, one point per month (month 1..horizon). */
  cumulativeSavings: CumulativeSavingsPoint[]
  /**
   * First month where cumulative savings are >= 0 after starting negative.
   * 1 when the candidate is never behind (including a cheaper upfront fee).
   * null when the curve never reaches zero within the horizon.
   */
  breakEvenMonth: number | null
  /** True when the candidate is already ahead before the first payment. */
  breaksEvenImmediately: boolean
}

function sumThrough(months: CashFlowMonth[], horizon: number, key: keyof CashFlowMonth): number {
  let total = 0
  for (let index = 0; index < Math.min(horizon, months.length); index++) {
    total += months[index][key] as number
  }
  return total
}

/** The last balance at or before `horizon`; 0 when the loan already ended. */
function balanceAt(months: CashFlowMonth[], horizon: number): number {
  if (months.length === 0) return 0
  const index = Math.min(horizon, months.length) - 1
  return index >= 0 ? months[index].closing : 0
}

/**
 * Compares one candidate against one baseline. Returns null when either side
 * has no monthly schedule (nothing has been priced), so the page can hide the
 * section instead of showing zeroes.
 */
export function compareCashFlows(
  baseline: CashFlowSide,
  candidate: CashFlowSide,
): CashFlowComparison | null {
  const horizonMonths = Math.min(baseline.months.length, candidate.months.length)
  if (horizonMonths === 0) return null

  const netBeforePayments = baseline.fees - candidate.fees
  const cumulativeSavings: CumulativeSavingsPoint[] = []
  let running = netBeforePayments
  let breakEvenMonth: number | null = null
  let crossedZero = false

  for (let index = 0; index < horizonMonths; index++) {
    const baselineMonth = baseline.months[index]
    const candidateMonth = candidate.months[index]
    running += baselineMonth.paid - candidateMonth.paid
    cumulativeSavings.push({
      month: index + 1,
      year: baselineMonth.year,
      savings: running,
    })
    if (!crossedZero && running >= 0) {
      // Month 1 counts too: a cheaper first payment or a cheaper fee is an
      // immediate break-even, not a crossing that needs a prior month.
      if (index === 0 || cumulativeSavings[index - 1].savings < 0) {
        breakEvenMonth = index + 1
        crossedZero = true
      }
    }
  }

  const breaksEvenImmediately = (cumulativeSavings[0]?.savings ?? -1) >= 0
  if (breaksEvenImmediately) breakEvenMonth = 1

  return {
    horizonMonths,
    horizonYears: Math.ceil(horizonMonths / 12),
    baselineLabel: baseline.label,
    candidateLabel: candidate.label,
    firstPaymentDelta:
      (baseline.months[0]?.paid ?? 0) - (candidate.months[0]?.paid ?? 0),
    interestDelta:
      sumThrough(baseline.months, horizonMonths, 'interest') -
      sumThrough(candidate.months, horizonMonths, 'interest'),
    indexationDelta:
      sumThrough(baseline.months, horizonMonths, 'indexation') -
      sumThrough(candidate.months, horizonMonths, 'indexation'),
    feesDelta: baseline.fees - candidate.fees,
    balanceDelta:
      balanceAt(baseline.months, horizonMonths) - balanceAt(candidate.months, horizonMonths),
    netCashFlowDelta: running,
    cumulativeSavings,
    breakEvenMonth,
    breaksEvenImmediately,
  }
}
