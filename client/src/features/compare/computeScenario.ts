/**
 * Per-scenario computation for the comparison view.
 *
 * Zero new math: every number below comes from the same pure functions the
 * main calculator's `recalculate()` already calls (client/src/lib/amortization.ts),
 * invoked once per scenario against the SHARED property/capital/income inputs.
 * The result is a trimmed subset of `CalculatorSnapshot` (the fields the
 * comparison table shows) so the comparison vocabulary stays identical to the
 * main calculator's results cards.
 *
 * Renovation/closing-cost parity with the main calculator: the renovation
 * budget is part of the shared buyer profile, so it eats into the capital the
 * same way (capitalForLoan = max(0, capital - renovations)) and the loan the
 * tracks are priced against derives from it.
 */
import {
  DEFAULT_LAWYER_PERCENT,
  DEFAULT_REALTOR_PERCENT,
  FALLBACK_INFLATION,
  assessCapital,
  assessDti,
  assessLtv,
  assessPti,
  computeTrackResult,
  estimateClosingCosts,
  estimateTransactionCosts,
  MAX_YEARS,
  suggestedCapital,
  sumTotals,
  totalUpfrontCash,
  variableShareExceeded,
  calculateWeightedAvgInterestRate,
  averageInterestRate,
  averagePaybackRatio,
  type ClosingCostsEstimate,
  type PropertyPurpose,
  type TransactionCostsEstimate,
} from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
import type { TrackState } from '@/stores/calculatorStore'

/** Trimmed, display-oriented subset of CalculatorSnapshot for one scenario. */
export interface ScenarioResult {
  /** Empty state: no entered (non-blank) amounts at all. */
  isEmpty: boolean
  /** 'positive' - a track with an amount has years outside 1..30 or a non-positive amount. */
  /** 'variableCap' - variable share exceeds the Bank of Israel 2/3 ceiling. */
  error: 'positive' | 'variableCap' | null
  totals: { firstPayment: number; totalPaid: number; totalInterest: number; highestPayment: number }
  overpayPercent: number
  /** Loan-amount-weighted average annual rate (%). */
  weightedAvgInterestRate: number
  /** Unweighted average annual rate (%) - for the effective-rate caption. */
  avgInterestRate: number
  /** Average payback ratio (total repaid per shekel borrowed). */
  avgPaybackRatio: number
  /** Max term across the entered tracks, in years (0 when empty). */
  maxTermYears: number
  /** Track types in entry order - the mix summary line. */
  summaryTypes: string[]
  /** Share of the loan on variable-rate tracks, in percent (0 when empty). */
  variableSharePercent: number
  ltv: ReturnType<typeof assessLtv>
  dti: ReturnType<typeof assessDti>
  pti: ReturnType<typeof assessPti>
  capitalAssessment: ReturnType<typeof assessCapital>
  /** Suggested (required) initial capital for the shared purpose. */
  suggestedCapital: number | null
  /** Upfront cash: capital + purchase tax + fees + one-time expenses. */
  upfrontTotal: number | null
  closingCosts: ClosingCostsEstimate | null
  transactionCosts: TransactionCostsEstimate | null
  /** Total loan principal across the entered tracks (0 when empty). */
  loanAmount: number
  /** First payment if every variable rate rose by 1 point. */
  firstPaymentRateUp1: number
}

export interface SharedBuyerInputs {
  propertyValueText: string
  capitalText: string
  incomeText: string
  purpose: PropertyPurpose
  /** Shared fee profile seeded from the main calculator (percent fields as typed). */
  realtorPercent: number
  lawyerPercent: number
  appraiserFee: number
  renovations: number
  otherMonthly: number
  oneTimeExpenses: number
  ptiThresholdPercent: number
}

/** Mirror of the store's `parsePercentText`: percent text to a finite non-negative number. */
function parsePercentText(text: string): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * The effective fee basis: the property value when present, else loan +
 * post-renovation capital (the same fallback the main calculator uses so the
 * fee estimates agree between the two pages).
 */
function feeBasisOf(inputs: SharedBuyerInputs, trackSum: number, capitalForLoan: number): number {
  const property = parseAmountText(inputs.propertyValueText)
  if (property > 0) return property
  return trackSum + capitalForLoan
}

/**
 * Computes one scenario's trimmed result from its track list against the
 * shared buyer inputs. Faithful port of the main recalculate() flow, trimmed
 * to the fields the comparison shows; the monthly/schedule rows are skipped
 * (the comparison table has no schedule view) - everything else is the same
 * function calls in the same order.
 */
export function computeScenario(tracks: TrackState[], inputs: SharedBuyerInputs): ScenarioResult {
  const property = parseAmountText(inputs.propertyValueText)
  const capital = parseAmountText(inputs.capitalText)
  const income = parseAmountText(inputs.incomeText)
  const capitalForLoan = Math.max(0, capital - inputs.renovations)

  const invalidTerm = tracks.some((track) => {
    const years = Number(track.yearsText)
    return !years || years < 1 || years > MAX_YEARS
  })

  // Shared derived figures, identical whether or not tracks carry amounts,
  // so the upfront-cash picture does not depend on any one scenario.
  const trackSum = tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  const feeBasis = feeBasisOf(inputs, trackSum, capitalForLoan)
  const transactionCosts = estimateTransactionCosts(
    feeBasis,
    inputs.realtorPercent,
    inputs.lawyerPercent,
    inputs.appraiserFee,
    inputs.renovations,
  )

  const enteredIndexes = tracks
    .map((_, index) => index)
    .filter((index) => tracks[index].amountText.trim() !== '')

  const emptyResult: ScenarioResult = {
    isEmpty: true,
    error: invalidTerm ? 'positive' : null,
    totals: { firstPayment: 0, totalPaid: 0, totalInterest: 0, highestPayment: 0 },
    overpayPercent: 0,
    weightedAvgInterestRate: 0,
    avgInterestRate: 0,
    avgPaybackRatio: 0,
    maxTermYears: 0,
    summaryTypes: [],
    variableSharePercent: 0,
    ltv: assessLtv(0, property, capitalForLoan, inputs.purpose),
    dti: assessDti(0, income),
    pti: assessPti(inputs.otherMonthly, income, inputs.ptiThresholdPercent),
    capitalAssessment: assessCapital(capitalForLoan, property, 0, inputs.purpose),
    suggestedCapital: suggestedCapital(property, 0, capitalForLoan, inputs.purpose),
    closingCosts: estimateClosingCosts(property, 0, capitalForLoan, inputs.purpose),
    transactionCosts,
    upfrontTotal: totalUpfrontCash(
      suggestedCapital(property, 0, capitalForLoan, inputs.purpose),
      estimateClosingCosts(property, 0, capitalForLoan, inputs.purpose),
      transactionCosts,
      inputs.oneTimeExpenses,
    ),
    loanAmount: 0,
    firstPaymentRateUp1: 0,
  }
  if (enteredIndexes.length === 0) return emptyResult

  // Term validity: a scenario with an invalid term shows its error and no
  // numbers (mirrors the store's error gate).
  if (invalidTerm) {
    return { ...emptyResult, isEmpty: false, error: 'positive' }
  }

  const results = tracks.map((track) =>
    computeTrackResult({
      principal: parseAmountText(track.amountText),
      years: Number(track.yearsText) || 0,
      annualRatePercent: Number(track.rateText) || 0,
      type: track.type,
      method: track.method,
      annualInflation: FALLBACK_INFLATION,
    }),
  )

  const enteredResults = enteredIndexes.map((index) => results[index])
  if (enteredResults.some((result) => !result)) {
    return { ...emptyResult, isEmpty: false, error: 'positive' }
  }

  const validResults = enteredResults.filter(Boolean) as NonNullable<
    ReturnType<typeof computeTrackResult>
  >[]
  const totalPrincipal = validResults.reduce((sum, result) => sum + result.principal, 0)
  const variablePrincipal = validResults
    .filter((result) => result.isVariable)
    .reduce((sum, result) => sum + result.principal, 0)

  if (variableShareExceeded(totalPrincipal, variablePrincipal)) {
    return { ...emptyResult, isEmpty: false, error: 'variableCap' }
  }

  const totals = sumTotals(validResults)
  const firstMonthPayment = totals.firstPayment
  const overpayPercent = totalPrincipal > 0 ? (totals.totalInterest / totalPrincipal) * 100 : 0
  const suggested = suggestedCapital(property, totalPrincipal, capitalForLoan, inputs.purpose)
  const closingCosts = estimateClosingCosts(
    property,
    totalPrincipal,
    capitalForLoan,
    inputs.purpose,
  )
  const maxYears = Math.max(...validResults.map((result) => result.years))

  return {
    isEmpty: false,
    error: null,
    totals,
    overpayPercent,
    weightedAvgInterestRate: calculateWeightedAvgInterestRate(validResults),
    avgInterestRate: averageInterestRate(validResults),
    avgPaybackRatio: averagePaybackRatio(validResults),
    maxTermYears: Math.min(MAX_YEARS, maxYears),
    summaryTypes: validResults.map((result) => result.type),
    variableSharePercent: totalPrincipal > 0 ? (variablePrincipal / totalPrincipal) * 100 : 0,
    ltv: assessLtv(totalPrincipal, property, capitalForLoan, inputs.purpose),
    dti: assessDti(firstMonthPayment, income),
    pti: assessPti(firstMonthPayment + inputs.otherMonthly, income, inputs.ptiThresholdPercent),
    capitalAssessment: assessCapital(capitalForLoan, property, totalPrincipal, inputs.purpose),
    suggestedCapital: suggested,
    closingCosts,
    transactionCosts,
    upfrontTotal: totalUpfrontCash(
      suggested,
      closingCosts,
      transactionCosts,
      inputs.oneTimeExpenses,
    ),
    loanAmount: totalPrincipal,
    // Rate-bump stress test (same helper the main calculator uses).
    firstPaymentRateUp1: (() => {
      let sum = 0
      for (const result of validResults) {
        if (!result.isVariable) {
          sum += result.firstPayment
          continue
        }
        const stressed = computeTrackResult({
          principal: result.principal,
          years: result.years,
          annualRatePercent: result.annualRatePercent + 1,
          type: result.type,
          method: result.method,
          annualInflation: FALLBACK_INFLATION,
        })
        sum += stressed?.firstPayment ?? 0
      }
      return sum
    })(),
  }
}

/**
 * The shared fee profile for the comparison, priced the same way the main
 * calculator prices it: cleared percent fields fall back to the market norm,
 * the lawyer floor applies, and the appraiser counts only when typed.
 * Kept here so the compare store prices from the raw seeded text fields once
 * at seed time without duplicating the mirror/hint logic the calculator owns.
 */
export function sharedFeeProfileFromTexts(texts: {
  realtorPercentText: string
  lawyerPercentText: string
  appraiserFeeText: string
}): { realtorPercent: number; lawyerPercent: number; appraiserFee: number } {
  const realtorText = texts.realtorPercentText.trim()
  const lawyerText = texts.lawyerPercentText.trim()
  const realtorPercent =
    realtorText === '' ? DEFAULT_REALTOR_PERCENT : parsePercentText(realtorText)
  const lawyerPercent = lawyerText === '' ? DEFAULT_LAWYER_PERCENT : parsePercentText(lawyerText)
  // The ₪6,000 lawyer floor is NOT applied here: estimateTransactionCosts
  // routes the percent through lawyerFee(), which applies the floor itself.
  return {
    realtorPercent,
    lawyerPercent,
    appraiserFee:
      texts.appraiserFeeText.trim() === '' ? 0 : parseAmountText(texts.appraiserFeeText),
  }
}
