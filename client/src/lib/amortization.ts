/**
 * Pure mortgage math — extracted from the legacy inline `getTrackResult`
 * (src/calculator.js:479-524) and the Bank of Israel compliance helpers.
 * Every formula, threshold and rounding behaviour is preserved verbatim;
 * see tests/unit/amortization.test.ts for golden values.
 */

export const MAX_TRACKS = 3
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
/** Rough buyer-side side costs (attorney, registration, surveyor) as a % of the
    effective property value — a common mid estimate in Israel (~1.5%, excluding
    purchase tax and agent commission). */
export const SIDE_COSTS_PERCENT = 1.5
/** Below this effective value no real home exists — equity, LTV and closing-cost
    estimates are meaningless noise (their ₪500 rounding / percent math would
    distort them, e.g. "3333%") and are omitted entirely. */
export const MIN_REAL_HOME_VALUE = 100_000
/** One purchase-tax (מס רכישה) bracket: value up to `upTo` (inclusive, or
    Infinity for the top bracket) is taxed at `rate` percent. */
export interface PurchaseTaxBracket {
  upTo: number
  rate: number
}

/** Purchase tax (מס רכישה) exemption cap for a first home — no tax up to this
    value (2025–2028 rates). */
export const FIRST_HOME_TAX_EXEMPTION_UP_TO = 1_978_745

/** Purchase-tax brackets for a single dwelling unit (דירה יחידה) — rates for
    purchases between 16.1.2025 and 15.1.2028: 0% up to ₪1,978,745, then
    3.5% / 5% / 8% / 10%. */
export const PURCHASE_TAX_BRACKETS_FIRST_HOME: PurchaseTaxBracket[] = [
  { upTo: FIRST_HOME_TAX_EXEMPTION_UP_TO, rate: 0 },
  { upTo: 2_347_040, rate: 3.5 },
  { upTo: 6_055_070, rate: 5 },
  { upTo: 20_183_565, rate: 8 },
  { upTo: Infinity, rate: 10 },
]

/** Purchase-tax brackets for a second/additional dwelling (דירה נוספת) — paid
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

/** Legacy defaultRatesByType — note: no `prime` entry (handled via live rate). */
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

export interface TrackResult {
  firstPayment: number
  highestPayment: number
  totalPaid: number
  totalInterest: number
  yearlyRows: YearlyRow[]
  type: TrackType
  years: number
  principal: number
  isVariable: boolean
  isIndexed: boolean
  method: AmortizationMethod
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
    type,
    years: months / 12,
    principal,
    isVariable: isVariableType(type),
    isIndexed: isIndexedType(type),
    method,
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

// ---------------------------------------------------------------------------
// Bank of Israel regulatory limits
// ---------------------------------------------------------------------------

export interface EquityAssessment {
  percent: number
  requiredPercent: number
  state: 'bad' | 'good' | 'neutral'
}

/** Legacy equity-note logic (capital > 0 only). */
export function assessEquity(
  capital: number,
  propertyValue: number,
  loanAmount: number,
  purpose: PropertyPurpose,
): EquityAssessment | null {
  if (capital <= 0) return null
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  if (effectiveValue < MIN_REAL_HOME_VALUE) return null
  const percent = Math.round((capital / effectiveValue) * 100)
  const requiredPercent = 100 - PURPOSE_LIMITS[purpose].limit
  const state: EquityAssessment['state'] =
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
 * Required initial equity (הון עצמי) for a purchase: the gap between the
 * maximum financed share (100 − purpose limit) and the effective property
 * value. Mirrors assessEquity's effectiveValue (property else loan+capital).
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
  /** Purchase tax — progressive brackets: 0/3.5/5/8/10% first home, 8/10% second home. */
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

export function suggestedEquity(
  propertyValue: number,
  loanAmount: number,
  capital: number,
  purpose: PropertyPurpose,
): number | null {
  const effectiveValue = propertyValue > 0 ? propertyValue : loanAmount + capital
  if (effectiveValue < MIN_REAL_HOME_VALUE) return null
  const requiredPercent = 100 - PURPOSE_LIMITS[purpose].limit
  const raw = (requiredPercent / 100) * effectiveValue
  return Math.ceil(raw / 500) * 500
}

export function assessDti(firstMonthPayment: number, income: number): DtiWarning | null {
  if (income <= 0 || firstMonthPayment / income <= DTI_THRESHOLD) return null
  const minIncome = suggestedMinimumIncome(firstMonthPayment)
  const shortfallPercent = Math.min(99, Math.round((1 - income / minIncome) * 100))
  return { payment: firstMonthPayment, minIncome, shortfallPercent }
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
      // Keep the remembered share for tracks whose current amount is 0 —
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
 * Pure port of the legacy autoFixVariableMix rebalancer (calculator.js:378-414).
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
    const convertIndex = isVar.lastIndexOf(true)
    convertedToFixedIndex = convertIndex
    isVar[convertIndex] = false
  }

  const amounts = tracks.map((track) => track.amount)
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  if (!total) {
    return { amounts, convertedToFixedIndex, changed: convertedToFixedIndex !== null }
  }

  const varTotal = amounts.reduce((sum, amount, index) => sum + (isVar[index] ? amount : 0), 0)
  if (varTotal / total <= VARIABLE_SHARE_LIMIT + VARIABLE_SHARE_EPSILON) {
    return { amounts, convertedToFixedIndex, changed: convertedToFixedIndex !== null }
  }

  const targetVar = Math.floor((total * 2) / 3)
  let varLeft = targetVar
  const varIndexes = tracks.map((_, index) => index).filter((index) => isVar[index])
  varIndexes.forEach((index, order) => {
    const isLast = order === varIndexes.length - 1
    const amount = isLast ? varLeft : Math.round((amounts[index] * targetVar) / varTotal)
    amounts[index] = Math.max(0, amount)
    varLeft -= amount
  })

  const fixedTarget = total - targetVar
  let fixedLeft = fixedTarget
  const fixedIndexes = tracks.map((_, index) => index).filter((index) => !isVar[index])
  const fixedBase = fixedIndexes.reduce((sum, index) => sum + amounts[index], 0)
  fixedIndexes.forEach((index, order) => {
    const isLast = order === fixedIndexes.length - 1
    const amount = isLast
      ? fixedLeft
      : Math.round((amounts[index] / (fixedBase || 1)) * fixedTarget)
    amounts[index] = Math.max(0, amount)
    fixedLeft -= amount
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

/** Verbatim preset data from legacy calculator.js:37-42. */
export const PRESETS: Record<PresetId, PresetDefinition[]> = {
  basket1: [{ type: 'fixed', share: 1, rate: 4.5 }],
  basket2: [
    { type: 'fixed', share: 1 / 3, rate: 4.5 },
    { type: 'prime', share: 1 / 3, rate: 5.75 },
    { type: 'variableIndexed5y', share: 1 / 3, rate: 3.0 },
  ],
  basket3: [
    { type: 'fixed', share: 1 / 2, rate: 4.5 },
    { type: 'prime', share: 1 / 2, rate: 5.75 },
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
