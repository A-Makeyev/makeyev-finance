/**
 * Pure mortgage math - extracted from the legacy inline `getTrackResult`
 * (src/calculator.js:479-524) and the Bank of Israel compliance helpers.
 * Every formula, threshold and rounding behaviour is preserved verbatim;
 * see tests/unit/amortization.test.ts for golden values.
 */

export const MAX_TRACKS = 3
/** Cap on repeatable other-expense rows (feedback request). */
export const MAX_OTHER_EXPENSES = 3
export const MAX_YEARS = 30
/** Default slider term on load and after reset (feedback request). */
export const DEFAULT_TERM_YEARS = 15
export const FALLBACK_INFLATION = 0.02
export const VARIABLE_SHARE_LIMIT = 2 / 3
export const VARIABLE_SHARE_EPSILON = 0.0001
export const PRIME_MARGIN = 1.5
export const FALLBACK_PRIME_RATE = 5.75
export const DTI_THRESHOLD = 0.5
export const DTI_ROUNDING_STEP = 500
/**
 * Default payment-to-income ceiling (from mortgage-advisor course material):
 * banks typically cap the mortgage payment at ~33% of the borrower's net
 * monthly income. Case-by-case in practice (20-40%), so the UI exposes it as
 * an adjustable setting - this is only the starting value.
 */
export const PTI_DEFAULT_THRESHOLD = 0.33
export const PTI_MIN_THRESHOLD = 0.2
export const PTI_MAX_THRESHOLD = 0.4
/** Rough buyer-side side costs (attorney, registration, surveyor) as a % of the
    effective property value - a common mid estimate in Israel (~1.5%, excluding
    purchase tax and agent commission). */
export const SIDE_COSTS_PERCENT = 1.5
/** Below this effective value no real home exists - capital, LTV and closing-cost
    estimates are meaningless noise (their ₪500 rounding / percent math would
    distort them, e.g. "3333%") and are omitted entirely. */
export const MIN_REAL_HOME_VALUE = 100_000
/** One purchase-tax (מס רכישה) bracket: value up to `upTo` (inclusive, or
    Infinity for the top bracket) is taxed at `rate` percent. */
export interface PurchaseTaxBracket {
  upTo: number
  rate: number
}

/** Purchase tax (מס רכישה) exemption cap for a first home - no tax up to this
    value (2025–2028 rates). */
export const FIRST_HOME_TAX_EXEMPTION_UP_TO = 1_978_745

/** Purchase-tax brackets for a single dwelling unit (דירה יחידה) - rates for
    purchases between 16.1.2025 and 15.1.2028: 0% up to ₪1,978,745, then
    3.5% / 5% / 8% / 10%. */
export const PURCHASE_TAX_BRACKETS_FIRST_HOME: PurchaseTaxBracket[] = [
  { upTo: FIRST_HOME_TAX_EXEMPTION_UP_TO, rate: 0 },
  { upTo: 2_347_040, rate: 3.5 },
  { upTo: 6_055_070, rate: 5 },
  { upTo: 20_183_565, rate: 8 },
  { upTo: Infinity, rate: 10 },
]

/** Purchase-tax brackets for a second/additional dwelling (דירה נוספת) - paid
    from the first shekel: 8% up to ₪6,055,070, 10% above (2026 rates). */
export const PURCHASE_TAX_BRACKETS_ADDITIONAL: PurchaseTaxBracket[] = [
  { upTo: 6_055_070, rate: 8 },
  { upTo: Infinity, rate: 10 },
]

export const TRACK_TYPES = [
  'prime',
  'fixed',
  'variable5y',
  'variable',
  'fixedIndexed',
  'variableIndexed5y',
  'variableIndexed',
] as const
export type TrackType = (typeof TRACK_TYPES)[number]

/** Types exposed to the BoI variable-rate cap (legacy variableTrackTypes). */
export const VARIABLE_TRACK_TYPES: readonly TrackType[] = [
  'prime',
  'variable',
  'variable5y',
  'variableIndexed',
  'variableIndexed5y',
]

export type AmortizationMethod = 'spitzer' | 'equalPrincipal'

export type PropertyPurpose = 'first' | 'upgrade' | 'investment'

export const PURPOSE_LIMITS: Record<PropertyPurpose, { limit: number }> = {
  first: { limit: 75 },
  upgrade: { limit: 70 },
  investment: { limit: 50 },
}

/** Legacy defaultRatesByType - note: no `prime` entry (handled via live rate). */
export const DEFAULT_RATES_BY_TYPE: Omit<Record<TrackType, number>, 'prime'> = {
  fixed: 4.5,
  variable5y: 4.25,
  variable: 4.3,
  fixedIndexed: 3.0,
  variableIndexed5y: 3.0,
  variableIndexed: 3.2,
}

export function isVariableType(type: TrackType): boolean {
  return VARIABLE_TRACK_TYPES.includes(type)
}

export function isIndexedType(type: TrackType): boolean {
  return type.includes('Indexed')
}

export interface TrackComputationInput {
  principal: number
  years: number
  annualRatePercent: number
  type: TrackType
  method: AmortizationMethod
  annualInflation?: number
}

export interface YearlyRow {
  year: number
  opening: number
  principal: number
  paid: number
  interest: number
  closing: number
}

/** One display row of a monthly schedule (aggregated per payment month). */
export interface MonthlyRow {
  /** Month index within the year, 1-12. */
  month: number
  /** Calendar year of the loan (1-based, same as YearlyRow.year). */
  year: number
  principal: number
  interest: number
  paid: number
  closing: number
}

export interface TrackResult {
  firstPayment: number
  highestPayment: number
  totalPaid: number
  totalInterest: number
  yearlyRows: YearlyRow[]
  /** Per-month payment rows (same totals as yearlyRows, finer granularity). */
  monthlyRows: MonthlyRow[]
  type: TrackType
  years: number
  principal: number
  isVariable: boolean
  isIndexed: boolean
  method: AmortizationMethod
  /** Total repaid ÷ nominal principal (e.g. 1.0617 = ₪1.0617 repaid per ₪1 borrowed). */
  paybackRatio: number
  /** Annual rate (percent, e.g. 4.5), carried through for the aggregate rate-helpers. */
  annualRatePercent: number
}

/**
 * Legacy validity gate (calculator.js:491): invalid inputs yield `null` and
 * the track is excluded from aggregation while still counted as "entered".
 */
export function computeTrackResult(input: TrackComputationInput): TrackResult | null {
  const { principal, years, annualRatePercent, type, method } = input
  const months = years * 12
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    months <= 0 ||
    months > MAX_YEARS * 12 ||
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0
  ) {
    return null
  }

  const inflationRate = input.annualInflation ?? FALLBACK_INFLATION
  const monthlyRate = annualRatePercent / 100 / 12
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12)

  let balance = principal
  let totalPaid = 0
  let totalInterest = 0
  let firstPayment = 0
  let highestPayment = 0
  let indexFactor = 1
  const yearlyRows: YearlyRow[] = []
  const monthlyRows: MonthlyRow[] = []
  let yearOpening = principal
  let yearPrincipal = 0
  let yearPaid = 0
  let yearInterest = 0

  for (let month = 1; month <= months; month++) {
    // CPI-indexed balances inflate month-over-month starting month 2.
    if (isIndexedType(type) && month > 1) {
      indexFactor *= monthlyInflation
      balance *= monthlyInflation
    }
    const remaining = months - month + 1
    const interest = balance * monthlyRate
    let principalPart: number
    let payment: number
    if (method === 'equalPrincipal') {
      principalPart = (principal * indexFactor) / months
      payment = principalPart + interest
    } else {
      payment =
        monthlyRate === 0
          ? balance / remaining
          : (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remaining))
      principalPart = payment - interest
    }
    if (month === 1) firstPayment = payment
    highestPayment = Math.max(highestPayment, payment)

    balance = Math.max(0, balance - principalPart)
    totalPaid += payment
    totalInterest += interest
    yearPrincipal += principalPart
    yearPaid += payment
    yearInterest += interest

    // Record the per-month row (monthly schedule view).
    monthlyRows.push({
      month: ((month - 1) % 12) + 1,
      year: Math.ceil(month / 12),
      principal: principalPart,
      interest,
      paid: payment,
      closing: balance,
    })

    if (month % 12 === 0 || month === months) {
      yearlyRows.push({
        year: Math.ceil(month / 12),
        opening: yearOpening,
        principal: yearPrincipal,
        paid: yearPaid,
        interest: yearInterest,
        closing: balance,
      })
      yearOpening = balance
      yearPrincipal = 0
      yearPaid = 0
      yearInterest = 0
    }
  }

  return {
    firstPayment,
    highestPayment,
    totalPaid,
    totalInterest,
    yearlyRows,
    monthlyRows,
    type,
    years: months / 12,
    principal,
    isVariable: isVariableType(type),
    isIndexed: isIndexedType(type),
    method,
    paybackRatio: totalPaid / principal,
    annualRatePercent,
  }
}

export interface TotalsSummary {
  firstPayment: number
  highestPayment: number
  totalPaid: number
  totalInterest: number
}

export const EMPTY_TOTALS: TotalsSummary = {
  firstPayment: 0,
  highestPayment: 0,
  totalPaid: 0,
  totalInterest: 0,
}

export function sumTotals(results: TrackResult[]): TotalsSummary {
  return results.reduce<TotalsSummary>(
    (sum, result) => ({
      firstPayment: sum.firstPayment + result.firstPayment,
      highestPayment: sum.highestPayment + result.highestPayment,
      totalPaid: sum.totalPaid + result.totalPaid,
      totalInterest: sum.totalInterest + result.totalInterest,
    }),
    EMPTY_TOTALS,
  )
}

/**
 * Unweighted average of the entered tracks' annual interest rates (percent).
 * Each track counts equally regardless of its loan amount (parity with the
 * reference sheet's average; see the weighted alternative below).
 */
export function averageInterestRate(results: TrackResult[]): number {
  if (!results.length) return 0
  const total = results.reduce((sum, result) => sum + result.annualRatePercent, 0)
  return total / results.length
}

/**
 * Loan-amount-weighted average annual interest rate (percent) - the blended
 * cost of the portfolio. A ₪10,000 track at 1% and a ₪300,000 track at 3%
 * average to 2% unweighted, but ≈2.94% when weighted by amount.
 */
export function calculateWeightedAvgInterestRate(results: TrackResult[]): number {
  const totalLoan = results.reduce((sum, result) => sum + result.principal, 0)
  if (totalLoan <= 0) return 0
  const weightedSum = results.reduce(
    (sum, result) => sum + result.principal * result.annualRatePercent,
    0,
  )
  return weightedSum / totalLoan
}

/**
 * Stress test: the combined first payment if every variable-rate track's
 * annual rate rose by `bumpPercent` percentage points (prime included);
 * fixed-rate tracks keep their payment. Exposes the monthly-payment
 * sensitivity to prime/variable moves in one number.
 */
export function firstPaymentWithRateBump(
  results: TrackResult[],
  bumpPercent: number,
  annualInflation: number = FALLBACK_INFLATION,
): number {
  return results.reduce((sum, result) => {
    if (!result.isVariable) return sum + result.firstPayment
    const stressed = computeTrackResult({
      principal: result.principal,
      years: result.years,
      annualRatePercent: result.annualRatePercent + bumpPercent,
      type: result.type,
      method: result.method,
      annualInflation,
    })
    return sum + (stressed?.firstPayment ?? 0)
  }, 0)
}

/**
 * Interest share (%) of everything repaid during the first five years -
 * annuity mechanics in aggregate: early payments are mostly interest, so
 * this stays high even years into the loan.
 */
export function first5yInterestShare(results: TrackResult[]): number {
  let interest = 0
  let paid = 0
  for (const result of results) {
    for (const row of result.yearlyRows) {
      if (row.year > 5) break
      interest += row.interest
      paid += row.paid
    }
  }
  return paid > 0 ? (interest / paid) * 100 : 0
}

/**
 * Normalized first payment per ₪100,000 borrowed - a scale-free number for
 * comparing offers and mixes regardless of total loan size.
 */
export function paymentPer100k(results: TrackResult[]): number {
  const totalPrincipal = results.reduce((sum, result) => sum + result.principal, 0)
  if (totalPrincipal <= 0) return 0
  const firstPayment = results.reduce((sum, result) => sum + result.firstPayment, 0)
  return firstPayment / (totalPrincipal / 100_000)
}

/** Average payback ratio (total repaid ÷ principal) across the entered tracks. */
export function averagePaybackRatio(results: TrackResult[]): number {
  if (!results.length) return 0
  const total = results.reduce((sum, result) => sum + result.paybackRatio, 0)
  return total / results.length
}

/**
 * Effective annual rate (EAR) implied by a monthly compounding of a nominal
 * annual rate (%) - `(1 + nominal/12)^12 − 1`, returned in percent. Always ≥
 * the nominal rate; used to compare offers apples-to-apples across banks.
 */
export function effectiveAnnualRatePercent(nominalRatePercent: number): number {
  if (!Number.isFinite(nominalRatePercent) || nominalRatePercent < 0) return 0
  const monthly = nominalRatePercent / 100 / 12
  return (Math.pow(1 + monthly, 12) - 1) * 100
}

export type CombinedScheduleRow = YearlyRow

/** Combines per-track yearly rows into a single schedule (missing years filtered). */
export function combineSchedules(results: TrackResult[]): CombinedScheduleRow[] {
  const scheduleYears = Math.max(...results.map((result) => result.yearlyRows.length))
  const combined: CombinedScheduleRow[] = []
  for (let index = 0; index < scheduleYears; index++) {
    const rows = results.map((result) => result.yearlyRows[index]).filter(Boolean)
    combined.push({
      year: index + 1,
      opening: rows.reduce((sum, row) => sum + row.opening, 0),
      principal: rows.reduce((sum, row) => sum + row.principal, 0),
      paid: rows.reduce((sum, row) => sum + row.paid, 0),
      interest: rows.reduce((sum, row) => sum + row.interest, 0),
      closing: rows.reduce((sum, row) => sum + row.closing, 0),
    })
  }
  return combined
}

/** One display row of the combined monthly schedule (all tracks together). */
export interface CombinedMonthlyRow {
  year: number
  /** Month within that year, 1-12. */
  month: number
  principal: number
  interest: number
  paid: number
  closing: number
}

/**
 * Combines per-track monthly rows into a single monthly schedule (missing
 * months filtered). Mirrors combineSchedules but at month granularity, so
 * the schedule table can render a month-by-month view.
 */
export function combineMonthlySchedules(results: TrackResult[]): CombinedMonthlyRow[] {
  if (!results.length) return []
  const scheduleMonths = Math.max(...results.map((result) => result.monthlyRows.length))
  const combined: CombinedMonthlyRow[] = []
  for (let index = 0; index < scheduleMonths; index++) {
    const rows = results.map((result) => result.monthlyRows[index]).filter(Boolean)
    if (!rows.length) continue
    combined.push({
      year: rows[0].year,
      month: rows[0].month,
      principal: rows.reduce((sum, row) => sum + row.principal, 0),
      paid: rows.reduce((sum, row) => sum + row.paid, 0),
      interest: rows.reduce((sum, row) => sum + row.interest, 0),
      closing: rows.reduce((sum, row) => sum + row.closing, 0),
    })
  }
  return combined
}

/** One display row of a single track's yearly schedule. */
export interface TrackScheduleRow {
  year: number
  /** Sum of the 12 monthly payments in that year (the "annual payment"). */
  paid: number
  principal: number
  interest: number
  balance: number
  /** The track's flat lifetime payback ratio (total repaid ÷ principal). */
  paybackRatio: number
}

/**
 * Derives a single track's per-track yearly schedule, stamping the track's
 * lifetime payback ratio (total repaid ÷ principal) onto every row.
 */
export function buildTrackScheduleRows(result: TrackResult): TrackScheduleRow[] {
  return result.yearlyRows.map((row) => ({
    year: row.year,
    paid: row.paid,
    principal: row.principal,
    interest: row.interest,
    balance: row.closing,
    paybackRatio: result.paybackRatio,
  }))
}

// ---------------------------------------------------------------------------
// Bank of Israel regulatory limits
// ---------------------------------------------------------------------------

export interface CapitalAssessment {
  percent: number
  requiredPercent: number
  state: 'bad' | 'good' | 'neutral'
}

/** Legacy "equity note" logic, now user-facing "capital" (capital > 0 only). */
export function assessCapital(
  capital: number,
  propertyValue: number,
  loanAmount: number,
  purpose: PropertyPurpose,
): CapitalAssessment | null {
  if (capital <= 0) return null
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  if (effectiveValue < MIN_REAL_HOME_VALUE) return null
  const percent = Math.round((capital / effectiveValue) * 100)
  const requiredPercent = 100 - PURPOSE_LIMITS[purpose].limit
  const state: CapitalAssessment['state'] =
    percent < requiredPercent ? 'bad' : percent >= requiredPercent + 15 ? 'good' : 'neutral'
  return { percent, requiredPercent, state }
}

export interface LtvWarning {
  percentRounded: number
  /** Precise (unrounded) financing ratio, for non-contradictory warnings. */
  percent: number
  limit: number
  effectiveValue: number
  maxLoan: number
  purpose: PropertyPurpose
}

/** LTV check triggers above limit + 0.01 tolerance (legacy calculator.js:364). */
export function assessLtv(
  loanAmount: number,
  propertyValue: number,
  capital: number,
  purpose: PropertyPurpose,
): LtvWarning | null {
  if (propertyValue <= 0 && capital <= 0) return null
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  if (effectiveValue < MIN_REAL_HOME_VALUE) return null
  const ltv = (loanAmount / effectiveValue) * 100
  const limit = PURPOSE_LIMITS[purpose].limit
  if (!(ltv > limit + 0.01)) return null
  return {
    percentRounded: Math.round(ltv),
    percent: ltv,
    limit,
    effectiveValue,
    maxLoan: Math.max(0, Math.floor(((effectiveValue * limit) / 100 / 1000) * 1000)),
    purpose,
  }
}

export interface DtiWarning {
  payment: number
  minIncome: number
  shortfallPercent: number
}

/** Suggested minimum income: ceil(payment·2 / 500)·500 (legacy). */
export function suggestedMinimumIncome(firstMonthPayment: number): number {
  return Math.ceil((firstMonthPayment * 2) / DTI_ROUNDING_STEP) * DTI_ROUNDING_STEP
}

/**
 * Required initial capital (הון עצמי) for a purchase: the gap between the
 * maximum financed share (100 − purpose limit) and the effective property
 * value. Mirrors assessCapital's effectiveValue (property else loan+capital).
 */
/**
 * Which purchase-tax brackets apply: a first home, or a home improver
 * (משפר דיור) who commits to selling the old home, is taxed like a single
 * dwelling; an investment/second home pays the additional-dwelling brackets.
 */
export function purchaseTaxBrackets(purpose: PropertyPurpose): PurchaseTaxBracket[] {
  return purpose === 'investment'
    ? PURCHASE_TAX_BRACKETS_ADDITIONAL
    : PURCHASE_TAX_BRACKETS_FIRST_HOME
}

/** Progressive purchase tax (מס רכישה) for the value, per the bracket set. */
export function computePurchaseTax(value: number, purpose: PropertyPurpose): number {
  let tax = 0
  let previous = 0
  for (const bracket of purchaseTaxBrackets(purpose)) {
    const upper = Math.min(bracket.upTo, value)
    if (upper > previous) {
      tax += ((upper - previous) * bracket.rate) / 100
      previous = upper
    }
    if (value <= bracket.upTo) break
  }
  return tax
}

export interface ClosingCostsEstimate {
  /** Side costs excluding purchase tax (attorney, registration, surveyor). */
  sideCosts: number
  /** Purchase tax - progressive brackets: 0/3.5/5/8/10% first home, 8/10% second home. */
  purchaseTax: number
  /** sideCosts + purchaseTax. */
  total: number
  sideCostsPercent: number
  /** Effective (average) tax rate on the total value, for display. */
  purchaseTaxPercent: number
}

/**
 * Rough buyer-side closing-cost estimate for the effective property value,
 * rounded to the nearest ₪500. Purchase tax follows the progressive brackets:
 * a first home pays 0% up to ₪1,978,745 and 3.5%+ above; a second home and
 * beyond pays 8% from the first shekel. Returns null when no effective value
 * is known.
 */
export function estimateClosingCosts(
  propertyValue: number,
  loanAmount: number,
  capital: number,
  purpose: PropertyPurpose,
): ClosingCostsEstimate | null {
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  if (effectiveValue < MIN_REAL_HOME_VALUE) return null
  const round = (value: number) => Math.ceil(value / 500) * 500
  const sideCostsPercent = SIDE_COSTS_PERCENT
  const purchaseTax = round(computePurchaseTax(effectiveValue, purpose))
  // Effective rate from the unrounded tax so the ₪500 rounding can never
  // inflate it (e.g. no 3333% on tiny values).
  const purchaseTaxPercent = (computePurchaseTax(effectiveValue, purpose) / effectiveValue) * 100
  const sideCosts = round((sideCostsPercent / 100) * effectiveValue)
  return {
    sideCosts,
    purchaseTax,
    total: sideCosts + purchaseTax,
    sideCostsPercent,
    purchaseTaxPercent,
  }
}

// ---------------------------------------------------------------------------
// Transaction costs (realtor, lawyer, appraiser) - market norms, not law
// ---------------------------------------------------------------------------

/**
 * VAT (מע"מ) on professional services. Legislative rate, effective 1.1.2025
 * (raised from 17%), still 18% in 2026 - update when the law changes, never
 * fetched live. Market-norm fees below are quoted before VAT.
 */
export const VAT_RATE = 0.18

/**
 * Market-norm defaults for the transaction-cost estimate. Unlike the
 * purchase-tax brackets and financing limits these are NOT regulated - they
 * are editable starting values labeled "typical" in the UI, not exact
 * figures.
 */
export const DEFAULT_REALTOR_PERCENT = 2
export const DEFAULT_LAWYER_PERCENT = 1
/** Common floor regardless of the percent (before VAT). */
export const LAWYER_MINIMUM_FEE = 6000
/** Flat fee - appraisers price per property, not per shekel borrowed. */
export const DEFAULT_APPRAISER_FEE = 3000

/** Adds VAT to a pre-tax amount. */
function withVat(amount: number): number {
  return amount * (1 + VAT_RATE)
}

/**
 * Lawyer fee (before VAT): the higher of percent-based and the common
 * minimum. A cleared percent (0) falls back to the minimum so an empty
 * lawyer field still shows a realistic floor estimate.
 */
export function lawyerFee(propertyValue: number, percent: number): number {
  if (propertyValue <= 0) return 0
  return Math.max((percent / 100) * propertyValue, LAWYER_MINIMUM_FEE)
}

/**
 * Per-property transaction-cost line items (realtor / lawyer / appraiser).
 * The `realtor` / `lawyer` / `appraiser` fields carry VAT; the `*PreVat`
 * fields are the raw quoted amounts before VAT.
 */
export interface TransactionCostsEstimate {
  realtor: number
  lawyer: number
  appraiser: number
  /** Planned renovation budget (שיפוצים) - entered VAT-inclusive, unlike the
      pre-VAT percent fees, so the number the user types is the cash needed. */
  renovations: number
  realtorPreVat: number
  lawyerPreVat: number
  appraiserPreVat: number
  total: number
}

/**
 * Per-property transaction-cost estimate (before VAT, except VAT itself is
 * included on each line): realtor % of value, lawyer max(percent, minimum),
 * appraiser flat, plus an optional renovation budget entered as the actual
 * (VAT-inclusive) price. All are one-time costs based on the PROPERTY value -
 * never the loan amount - and never belong in a monthly-payment check. The
 * renovation also eats into the initial capital upstream (see the store), so
 * it lands in the loan, the totals and the fees line together.
 */
export function estimateTransactionCosts(
  propertyValue: number,
  realtorPercent: number,
  lawyerPercent: number,
  appraiserFee: number,
  renovations: number = 0,
): TransactionCostsEstimate | null {
  if (propertyValue <= 0) return null
  const realtor = (realtorPercent / 100) * propertyValue
  const lawyer = lawyerFee(propertyValue, lawyerPercent)
  const appraiser = appraiserFee
  const realtorWithVat = withVat(realtor)
  const lawyerWithVat = withVat(lawyer)
  const appraiserWithVat = withVat(appraiser)
  const renovationAmount = Number.isFinite(renovations) ? Math.max(0, renovations) : 0
  return {
    realtor: realtorWithVat,
    lawyer: lawyerWithVat,
    appraiser: appraiserWithVat,
    renovations: renovationAmount,
    realtorPreVat: realtor,
    lawyerPreVat: lawyer,
    appraiserPreVat: appraiser,
    total: realtorWithVat + lawyerWithVat + appraiserWithVat + renovationAmount,
  }
}

/**
 * Required initial capital (הון עצמי) for a purchase: the gap between the
 * maximum financed share (100 − purpose limit) and the effective property
 * value. Mirrors assessCapital's effectiveValue (property else loan+capital).
 */
export function suggestedCapital(
  propertyValue: number,
  loanAmount: number,
  capital: number,
  purpose: PropertyPurpose,
): number | null {
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  // Null only when there is no value basis at all - the capital hint shows even
  // for modest values (unlike LTV/capital-share warnings, which still guard on
  // a real home value to avoid absurd percentages).
  if (effectiveValue <= 0) return null
  const requiredPercent = 100 - PURPOSE_LIMITS[purpose].limit
  const raw = (requiredPercent / 100) * effectiveValue
  return Math.ceil(raw / 500) * 500
}

/**
 * Mandatory minimum equity (הון עצמי) a bank requires alongside any mortgage:
 * value ≥ loan + ₪100,000 no matter the financing limit.
 */
export const MINIMUM_EQUITY = 100_000

/** Upfront-cash figures round to the same ₪500 grid as suggestedCapital. */
export const TRANSACTION_COSTS_ROUNDING_STEP = 500

/**
 * Total upfront cash (הון עצמי + all one-time costs): the required capital,
 * the closing-cost estimate and the transaction-cost fees (each already
 * VAT-inclusive) draw from the same pool of savings, so the affordability
 * picture must add them. Rounded up to ₪500; null when there is no basis.
 */
export function totalUpfrontCash(
  requiredCapital: number | null,
  closingCosts: ClosingCostsEstimate | null,
  transactionCosts: TransactionCostsEstimate | null,
  oneTimeExpenses: number = 0,
): number | null {
  // A null capital (no equity basis) contributes zero - fees alone still
  // draw from savings, so the total must still show.
  const capital = requiredCapital ?? 0
  if (
    capital <= 0 &&
    closingCosts === null &&
    transactionCosts === null &&
    oneTimeExpenses <= 0
  ) {
    return null
  }
  const oneTime = Number.isFinite(oneTimeExpenses) ? Math.max(0, oneTimeExpenses) : 0
  const raw =
    capital + (closingCosts?.total ?? 0) + (transactionCosts?.total ?? 0) + oneTime
  return Math.ceil(raw / TRANSACTION_COSTS_ROUNDING_STEP) * TRANSACTION_COSTS_ROUNDING_STEP
}

/**
 * Property value (שווי הנכס) hint when the field is blank: the smallest value
 * that satisfies both regulatory constraints for the mortgage -
 * - the purpose's maximum financing (e.g. a ₪1M loan at the 75% first-home
 *   limit needs a value of ₪1,333,500), and
 * - the mandatory ₪100,000 minimum equity (value ≥ loan + 100,000, which
 *   dominates for loans under ₪400k - a ₪100k loan means at least a ₪200k
 *   home).
 * Rounded up to ₪500; null when no meaningful mortgage is entered, so a
 * placeholder never shows for tiny/placeholder loan amounts.
 */
export function suggestedPropertyValue(loanAmount: number, purpose: PropertyPurpose): number | null {
  if (loanAmount < MIN_REAL_HOME_VALUE) return null
  const financingFloor = (loanAmount * 100) / PURPOSE_LIMITS[purpose].limit
  const raw = Math.max(financingFloor, loanAmount + MINIMUM_EQUITY)
  return Math.ceil(raw / 500) * 500
}

export function assessDti(firstMonthPayment: number, income: number): DtiWarning | null {
  if (income <= 0 || firstMonthPayment / income <= DTI_THRESHOLD) return null
  const minIncome = suggestedMinimumIncome(firstMonthPayment)
  const shortfallPercent = Math.min(99, Math.round((1 - income / minIncome) * 100))
  return { payment: firstMonthPayment, minIncome, shortfallPercent }
}

export interface PTIAssessment {
  /** Monthly outflow tested: mortgage first payment + other recurring expenses. */
  payment: number
  /** The user-adjusted ceiling as a percent (e.g. 33). */
  thresholdPercent: number
  /** Income at which the outflow exactly meets the ceiling, rounded up to ₪500. */
  minIncome: number
}

/**
 * Soft payment-to-income check against the adjustable ceiling (default 33%,
 * range 20-40%). Unlike the 50% DTI regulatory check this is guidance, not a
 * bank rule. `monthlyObligation` is the mortgage's first payment plus any
 * recurring expenses the user listed (car loan etc.); one-time transaction
 * costs never enter this check.
 */
export function suggestedMortgagePayment(
  monthlyIncome: number,
  otherMonthlyExpenses: number,
  thresholdPercent: number,
): number {
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 0
  const expenses = Number.isFinite(otherMonthlyExpenses) ? Math.max(0, otherMonthlyExpenses) : 0
  const threshold = Number.isFinite(thresholdPercent) ? thresholdPercent / 100 : PTI_DEFAULT_THRESHOLD
  return Math.max(0, monthlyIncome * threshold - expenses)
}

export function assessPti(
  monthlyObligation: number,
  income: number,
  thresholdPercent: number,
): PTIAssessment | null {
  if (income <= 0 || monthlyObligation <= 0) return null
  const threshold = thresholdPercent / 100
  if (monthlyObligation / income <= threshold) return null
  return {
    payment: monthlyObligation,
    thresholdPercent,
    minIncome: Math.ceil(monthlyObligation / threshold / DTI_ROUNDING_STEP) * DTI_ROUNDING_STEP,
  }
}

/**
 * Minimum income for a given outflow at the given ceiling, rounded up to
 * ₪500 - the PTI counterpart of suggestedMinimumIncome (which is hardwired
 * to the 50% DTI rule).
 */
export function suggestedMinimumIncomeForPayment(
  monthlyObligation: number,
  thresholdPercent: number,
): number {
  return (
    Math.ceil(monthlyObligation / (thresholdPercent / 100) / DTI_ROUNDING_STEP) * DTI_ROUNDING_STEP
  )
}

/** Variable-principal share must not exceed 2/3 (+epsilon tolerance). */
export function variableShareExceeded(totalPrincipal: number, variablePrincipal: number): boolean {
  return variablePrincipal / totalPrincipal > VARIABLE_SHARE_LIMIT + VARIABLE_SHARE_EPSILON
}

// ---------------------------------------------------------------------------
// Loan / track amount distribution
// ---------------------------------------------------------------------------

/**
 * Loan amount derivation quirk preserved from legacy getLoanAmount:
 * base is the property value when present, otherwise the starting amount
 * (never both); capital is always subtracted; floored at zero.
 */
export function deriveLoanAmount(
  propertyValue: number,
  startingAmount: number,
  capital: number,
): number {
  const base = propertyValue > 0 ? propertyValue : startingAmount
  return Math.max(0, base - capital)
}

export interface ScaleTracksResult {
  amounts: number[]
  /** Per-track remembered shares (null = no memory for that track). */
  shareMemory: Array<number | null>
}

/**
 * Pure port of legacy scaleTrackAmounts (calculator.js:138-167):
 * - loan=0 → stash every positive amount into memory, display zeros;
 * - current amounts exist → scale them proportionally;
 * - else fall back to remembered shares; none → leave unchanged (null).
 * The last track always absorbs the rounding remainder so the sum equals the
 * loan amount exactly.
 */
export function scaleTrackAmounts(
  currentAmounts: number[],
  previousMemory: Array<number | null>,
  loanAmount: number,
): ScaleTracksResult | null {
  const count = currentAmounts.length
  if (!count) return null

  if (!loanAmount) {
    return {
      amounts: currentAmounts.map(() => 0),
      // Keep the remembered share for tracks whose current amount is 0 -
      // otherwise typing a property value keystroke-by-keystroke (where the
      // loan briefly hits 0) would wipe the memory and the tracks could never
      // be restored once the loan becomes positive again.
      shareMemory: currentAmounts.map((amount, index) =>
        amount > 0 ? amount : previousMemory[index],
      ),
    }
  }

  const currentTotal = currentAmounts.reduce((sum, amount) => sum + amount, 0)
  let proportions: number[]
  if (currentTotal) {
    proportions = [...currentAmounts]
  } else {
    proportions = previousMemory.map((share) => share ?? 0)
    if (!proportions.some((share) => share > 0)) return null
  }
  const total = proportions.reduce((sum, share) => sum + share, 0)
  let allocated = 0
  const amounts = proportions.map((_, index) => {
    const amount =
      index === count - 1
        ? loanAmount - allocated
        : Math.round((loanAmount * proportions[index]) / total)
    allocated += amount
    return amount
  })
  return { amounts, shareMemory: previousMemory }
}

/**
 * Even floor-split with last-track remainder (legacy snapTracksToLoan fallback).
 */
export function distributeEqually(loanAmount: number, count: number): number[] {
  if (!count || !loanAmount) return []
  const share = Math.floor(loanAmount / count)
  let allocated = 0
  return Array.from({ length: count }, (_, index) => {
    const amount = index === count - 1 ? loanAmount - allocated : share
    allocated += amount
    return amount
  })
}

/**
 * Live re-balance while typing: given the edited track's new amount, return
 * the amounts the OTHER tracks must take so the tracks sum to the loan
 * exactly. Others keep their current proportions (equal split when they are
 * all 0); the last track absorbs rounding. Clearing a track (amount 0)
 * splits the whole loan evenly between the survivors, so the freed share is
 * never dumped onto whichever track was largest. Returns null when there is
 * nothing to redistribute. A typed amount above the loan leaves the others
 * at 0 - the blur snap reconciles the overshoot.
 */
export function redistributeTrackAmounts(
  editedAmount: number,
  otherAmounts: number[],
  loanAmount: number,
): number[] | null {
  const count = otherAmounts.length
  if (!count || loanAmount <= 0) return null
  if (editedAmount === 0) return distributeEqually(loanAmount, count)
  const remaining = Math.max(0, loanAmount - editedAmount)
  const othersTotal = otherAmounts.reduce((sum, amount) => sum + amount, 0)
  let allocated = 0
  return otherAmounts.map((amount, index) => {
    if (index === count - 1) return remaining - allocated
    const share =
      othersTotal > 0 ? Math.round((remaining * amount) / othersTotal) : Math.floor(remaining / count)
    allocated += share
    return share
  })
}

/**
 * Fill a newly added track (result's last index) by moving half of the
 * largest existing track amount to it, keeping the total constant.
 * Returns null when there is nothing to split (every existing amount is 0),
 * in which case the caller leaves the new track empty.
 */
export function splitLargestForNewTrack(existingAmounts: number[]): number[] | null {
  if (!existingAmounts.length) return null
  let maxIndex = -1
  let max = 0
  existingAmounts.forEach((amount, index) => {
    if (amount > max) {
      max = amount
      maxIndex = index
    }
  })
  if (maxIndex < 0) return null
  const half = Math.round(max / 2)
  const result = [...existingAmounts]
  result[maxIndex] = max - half
  result.push(half)
  return result
}

/**
 * Auto-fix rebalancer for the ⅔ variable-rate ceiling. Fixed (non-variable)
 * tracks keep the exact amounts the user entered; only the variable tracks
 * are trimmed - proportionally to each other, last one absorbing rounding -
 * until their total is at most twice the fixed total (share ≤ 2/3). The
 * trimmed excess leaves the loan instead of being parked into a fixed track,
 * so the mortgage total shrinks. When every track is variable one of them
 * (the last one holding money) is converted to fixed to anchor the ceiling.
 * Input tracks carry a display amount and whether they are variable-type.
 * Returns new amounts plus (optionally) the index converted to fixed.
 */
export interface AutoFixTrackInput {
  amount: number
  isVariable: boolean
}

export interface AutoFixResult {
  amounts: number[]
  convertedToFixedIndex: number | null
  changed: boolean
}

export function autoFixVariableMix(tracks: AutoFixTrackInput[]): AutoFixResult {
  const isVar = tracks.map((track) => track.isVariable)
  let convertedToFixedIndex: number | null = null

  if (isVar.every((v) => v)) {
    // All tracks are variable - one must carry the fixed share. Prefer the
    // last track that actually holds money: converting an empty trailing
    // track would leave a zero fixed anchor and force the whole loan away.
    let convertIndex = -1
    for (let index = tracks.length - 1; index >= 0; index--) {
      if (isVar[index] && tracks[index].amount > 0) {
        convertIndex = index
        break
      }
    }
    convertedToFixedIndex = convertIndex < 0 ? isVar.lastIndexOf(true) : convertIndex
    isVar[convertedToFixedIndex] = false
  }

  const amounts = tracks.map((track) => track.amount)
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  if (!total) {
    return { amounts, convertedToFixedIndex, changed: convertedToFixedIndex !== null }
  }

  const varTotal = amounts.reduce((sum, amount, index) => sum + (isVar[index] ? amount : 0), 0)
  const fixedTotal = total - varTotal
  // Variable may hold at most twice the fixed total: v/(v+f) ≤ 2/3 ⇔ v ≤ 2f.
  const varCap = fixedTotal * 2
  if (varTotal <= varCap) {
    return { amounts, convertedToFixedIndex, changed: convertedToFixedIndex !== null }
  }

  let varLeft = varCap
  const varIndexes = tracks.map((_, index) => index).filter((index) => isVar[index])
  varIndexes.forEach((index, order) => {
    const isLast = order === varIndexes.length - 1
    const amount = isLast ? varLeft : Math.round((amounts[index] * varCap) / varTotal)
    amounts[index] = Math.max(0, amount)
    varLeft -= amount
  })

  return { amounts, convertedToFixedIndex, changed: true }
}

// ---------------------------------------------------------------------------
// Presets ("baskets")
// ---------------------------------------------------------------------------

export type PresetId = 'basket1' | 'basket2' | 'basket3' | 'basket4'

export interface PresetDefinition {
  type: TrackType
  share: number
  rate: number
}

/**
 * Preset data from legacy calculator.js:37-42 - the basket-2 and basket-3
 * mixes were swapped so the mix number matches its track count: תמהיל 2
 * holds two tracks (fixed/prime halves), תמהיל 3 holds three equal tracks
 * (fixed/prime/5-year variable).
 */
export const PRESETS: Record<PresetId, PresetDefinition[]> = {
  basket1: [{ type: 'fixed', share: 1, rate: 4.5 }],
  basket2: [
    { type: 'fixed', share: 1 / 2, rate: 4.5 },
    { type: 'prime', share: 1 / 2, rate: 5.75 },
  ],
  basket3: [
    { type: 'fixed', share: 1 / 3, rate: 4.5 },
    { type: 'prime', share: 1 / 3, rate: 5.75 },
    { type: 'variableIndexed5y', share: 1 / 3, rate: 3.0 },
  ],
  basket4: [
    { type: 'prime', share: 0.4, rate: 5.75 },
    { type: 'fixed', share: 0.34, rate: 4.5 },
    { type: 'variableIndexed5y', share: 0.26, rate: 3.0 },
  ],
}

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[]

export interface AllocatedPresetTrack {
  type: TrackType
  amount: number
  rate: number
}

/**
 * Legacy loadPreset allocation (calculator.js:459-477): all tracks except the
 * last get round(startingAmount · share); the last absorbs the remainder so
 * the allocation sums exactly to the starting amount.
 */
export function allocatePreset(
  presetId: PresetId,
  startingAmount: number,
  livePrimeRate: number | null,
): AllocatedPresetTrack[] {
  const preset = PRESETS[presetId]
  if (!preset) return []
  let allocatedAmount = 0
  return preset.map((definition, index) => {
    const amount =
      index === preset.length - 1
        ? startingAmount - allocatedAmount
        : Math.round(startingAmount * definition.share)
    allocatedAmount += amount
    const rate = definition.type === 'prime' ? (livePrimeRate ?? definition.rate) : definition.rate
    return { type: definition.type, amount, rate }
  })
}

// ---------------------------------------------------------------------------
// Dynamic results-card label resolution (legacy calculator.js:603-620)
// ---------------------------------------------------------------------------

export type PaymentLabelKind = 'indexed' | 'equalPrincipal' | 'variable' | 'fixed'

export interface PaymentLabelResolution {
  kind: PaymentLabelKind
  hasFiveYearVariable: boolean
}

export function resolvePaymentLabel(results: TrackResult[]): PaymentLabelResolution {
  const hasIndexed = results.some((result) => result.isIndexed)
  const allSpitzer = results.every((result) => result.method !== 'equalPrincipal')
  const hasVariable = results.some((result) => result.isVariable)

  if (hasIndexed) return { kind: 'indexed', hasFiveYearVariable: false }
  if (!allSpitzer) return { kind: 'equalPrincipal', hasFiveYearVariable: false }
  if (hasVariable) {
    return {
      kind: 'variable',
      hasFiveYearVariable: results.some(
        (result) => result.type === 'variable5y' || result.type === 'variableIndexed5y',
      ),
    }
  }
  return { kind: 'fixed', hasFiveYearVariable: false }
}
