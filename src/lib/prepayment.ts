/**
 * Early-repayment fee (עמלת פירעון מוקדם) - the Bank of Israel היוון formula.
 *
 * Pure math, no DOM and no I/O: the calculator feeds it the remaining payments
 * straight from the amortization schedule it already renders, so the fee is
 * computed on the same numbers the user sees.
 *
 * Source of the formula: the Banking Order (פירעון מוקדם של הלוואה לדיור),
 * 2002, second supplement, as amended in 2014 (תשע"ד), and BOI circular 2103,
 * "נוסחה לחישוב עמלת פרעון מוקדם" (30/01/2003):
 *
 *   PV(A) = Σ_{i=1..n} B_i/(1+A)^i + 1/(1+A)^n · Σ_{i=1..N-n} B_{i+n}/(1+R)^i
 *   PV    = Σ_{i=1..N} B_i/(1+R)^i
 *   fee   = max(0, PV(A) - PV)
 *
 * where A is the periodic market rate on the prepayment date, R the periodic
 * contractual rate and B_i the remaining periodic payments (principal AND
 * interest). The `n` split in the first sum covers a rate reset inside the
 * remaining term; for a track whose rate is fixed to the end (here: one whose
 * payments are already computed) n = N and both forms collapse to the same
 * discounted sum, which is what `presentValue` computes.
 *
 * Section 3(4) adds a cap: if the average rate at origination (C) was lower
 * than the contractual rate, the fee may not exceed `PV(A) - PV(C)`. Because
 * the same B_i are discounted at the lower of R and C, that is exactly
 * `min(fee(3), fee(4))`; `originationAverageRatePercent` models it.
 *
 * Because B_i are the schedule's own payments, PV at R is exactly the
 * outstanding balance for every repayment method (spitzer, קרן שווה) and for
 * index-linked tracks on the real basis - see the tests, which assert that
 * identity and cross-check the closed-form annuity difference against the
 * payment-by-payment sum. The tests also reproduce the BOI's published worked
 * example: ₪500,000, 5% contractual vs 4% average, 120 months, ₪23,805 gross
 * and ₪16,664 after the 30% reduction.
 *
 * The second sum's `n < N` case is section 4(1) of the order: for a track
 * whose rate resets inside the remaining term, the balance on the reset date
 * is treated as the last future payment. `streamToRateReset` builds that
 * stream, so a five-year track is priced only to its next reset instead of as
 * if the current rate ran to the end of the loan.
 *
 * Section 3(4)'s cap needs the average rate at origination (C). The panel lets
 * the reader enter C per track; without a value the cap is left off, and the
 * breakdown's `capApplied` says whether an entered value actually bit.
 *
 * Nominal vs effective: the contractual rate the calculator holds is nominal
 * (it divides by 12), while the BOI average tables publish effective annual
 * rates. The two helpers below convert each correctly; passing a nominal rate
 * with `marketRateIsEffective: true` (or the reverse) is a silent mispricing,
 * so callers must know which basis their number is on.
 *
 * WHAT THIS DOES NOT COVER (deliberately, first slice):
 *   - the operational fee (currently ₪60 per track) and the no-notice fee
 *     (עמלת אי הודעה, up to 0.1% of the amount repaid);
 *   - the CPI compensation fee on index-linked tracks;
 *   - the bank's own five-component breakdown - only היוון is modelled;
 *   - the extra reduction tiers for משלימה / מוכוונת loans (10-40%).
 * Those are added on top of `fee`, never inside it.
 */

import { FALLBACK_INFLATION, type AmortizationMethod, type TrackType } from './amortization'

/**
 * Legal reduction by loan age, from the Banking Order (2002) as amended:
 * 20% off once the prepayment happens 3+ years after the loan was taken, 30%
 * off from 5+ years. Newest tier first.
 */
export const AGE_DISCOUNT_TIERS = [
  { afterMonths: 60, discount: 0.3 },
  { afterMonths: 36, discount: 0.2 },
] as const

/**
 * Loans whose rate resets at least once a year are exempt from the היוון fee:
 * prime and the annual variable tracks (Banking Order, section 4(2)).
 */
export const FREQUENT_RESET_EXEMPT_TYPES: readonly TrackType[] = [
  'prime',
  'variable',
  'variableIndexed',
]

/**
 * Types with a known five-year reset, so a prepayment on the reset date is an
 * exit station (תחנת יציאה) and the היוון fee is waived (section 4(3)).
 */
export const EXIT_STATION_TYPES: readonly TrackType[] = ['variable5y', 'variableIndexed5y']

/**
 * The Banking Order lets a bank charge up to ₪60 per loan for handling an
 * early-repayment request. We apply it once per priced track (each track is
 * its own loan account) and label it as an upper bound, not a quote.
 */
export const OPERATIONAL_FEE_CAP = 60

/**
 * No-notice fee: up to 0.1% of the amount repaid when the borrower gives less
 * than 10 days' notice (Banking Order, section 5). This is the cap; a bank may
 * charge less.
 */
export const NO_NOTICE_FEE_RATE = 0.001

/** The first half of a month is when the CPI-compensation rule can apply. */
export const CPI_COMPENSATION_FROM_DAY = 1
export const CPI_COMPENSATION_TO_DAY = 15

/**
 * CPI compensation for an indexed loan repaid on days 1-15: half of the
 * average monthly CPI change over the last 12 published indices, applied to
 * the amount repaid. With the calculator's flat annual CPI assumption the
 * average monthly change is `(1 + annualInflation)^(1/12) - 1`.
 */
export function cpiCompensationRate(annualInflation: number): number {
  if (!Number.isFinite(annualInflation) || annualInflation <= 0) return 0
  return Math.pow(1 + annualInflation, 1 / 12) - 1
}

export interface PrepaymentExtrasInput {
  /** How many tracks the request covers (the operational fee is per track). */
  trackCount: number
  /** Principal being repaid now, before any fees. */
  amountRepaid: number
  /** The part of `amountRepaid` that sits on CPI-linked tracks. */
  indexedAmountRepaid: number
  /** Less than 10 days' notice was given. */
  noNotice: boolean
  /** The repayment falls on days 1-15 of the month. */
  firstHalfOfMonth: boolean
  annualInflation: number
}

export interface PrepaymentExtras {
  operationalFee: number
  noNoticeFee: number
  cpiCompensationFee: number
  total: number
}

/**
 * The fee components the היוון formula does not cover. All three are reported
 * separately so they can be labelled as estimates; only the CPI part depends
 * on the loan being indexed.
 */
export function prepaymentExtras(input: PrepaymentExtrasInput): PrepaymentExtras {
  const trackCount = Number.isFinite(input.trackCount) ? Math.max(0, Math.floor(input.trackCount)) : 0
  const amountRepaid = Number.isFinite(input.amountRepaid) ? Math.max(0, input.amountRepaid) : 0
  const indexedAmount = Number.isFinite(input.indexedAmountRepaid)
    ? Math.max(0, Math.min(input.indexedAmountRepaid, amountRepaid))
    : 0

  const operationalFee = roundAgorot(trackCount * OPERATIONAL_FEE_CAP)
  const noNoticeFee = input.noNotice ? roundAgorot(amountRepaid * NO_NOTICE_FEE_RATE) : 0
  const cpiCompensationFee =
    input.firstHalfOfMonth && indexedAmount > 0
      ? roundAgorot(indexedAmount * 0.5 * cpiCompensationRate(input.annualInflation))
      : 0

  return {
    operationalFee,
    noNoticeFee,
    cpiCompensationFee,
    total: roundAgorot(operationalFee + noNoticeFee + cpiCompensationFee),
  }
}

/** Money is reported to the agora. */
export function roundAgorot(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/**
 * Periodic (monthly) rate from a nominal annual rate in percent - the Israeli
 * mortgage convention the calculator itself uses (`annualRate / 12`).
 */
export function periodicFromNominalAnnual(annualPercent: number): number {
  return annualPercent / 100 / 12
}

/**
 * Periodic rate from an EFFECTIVE annual rate in percent. The BOI average-rate
 * tables publish effective annual rates, and they are the default market rate
 * for the comparison (item 4), so they need converting before they can stand
 * next to a nominal contractual rate.
 */
export function periodicFromEffectiveAnnual(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1
}

/** Present value of `payments` (first one a period out) at a periodic rate. */
export function presentValue(payments: readonly number[], periodicRate: number): number {
  if (periodicRate <= -1) return 0
  let total = 0
  for (let index = 0; index < payments.length; index++) {
    total += payments[index] / Math.pow(1 + periodicRate, index + 1)
  }
  return total
}

/**
 * Discount the schedule's nominal payments back to the prepayment date's
 * money, so an index-linked track can be compared on the real basis its rate
 * is quoted in. Non-indexed tracks pass through untouched.
 */
export function deflatePayments(
  payments: readonly number[],
  annualInflation: number,
  indexed: boolean,
): number[] {
  if (!indexed) return payments.slice()
  const monthly = Math.pow(1 + annualInflation, 1 / 12)
  return payments.map((payment, index) => payment / Math.pow(monthly, index + 1))
}

/**
 * The stream the order prices for a track whose rate resets in
 * `monthsUntilReset` months: the payments up to the reset, with the balance on
 * the reset date added to the last payment (section 4(1) treats that balance
 * as the last future payment). Discounting this shorter stream at R still
 * gives the outstanding balance, which the tests assert.
 *
 * Returns the full stream when the loan ends before the next reset, and an
 * empty stream when the reset is already due (the caller should have flagged
 * an exit station instead).
 */
export function streamToRateReset(
  payments: readonly number[],
  balanceAtReset: number,
  monthsUntilReset: number,
): number[] {
  const periods = Math.min(payments.length, Math.max(0, Math.floor(monthsUntilReset)))
  if (periods >= payments.length) return payments.slice()
  if (periods === 0) return []
  const stream = payments.slice(0, periods)
  stream[periods - 1] += Math.max(0, balanceAtReset)
  return stream
}

export interface PrepaymentFeeInput {
  /**
   * The remaining payments, in schedule order (the first is due one month
   * after the prepayment). Taken from the amortization rows so neither the
   * repayment method nor the indexation has to be re-derived here. For a track
   * that resets inside the remaining term, pass the shorter stream built by
   * `streamToRateReset`, not the whole schedule.
   */
  payments: readonly number[]
  /** Outstanding principal after the prepayment, in the prepayment date's money. */
  balance: number
  /** Contractual annual rate in percent (real for index-linked tracks). */
  annualRatePercent: number
  /** Market comparison annual rate in percent, same basis as the contractual rate. */
  marketRatePercent: number
  /** True when `marketRatePercent` is an effective (not nominal) annual rate. */
  marketRateIsEffective?: boolean
  /**
   * The average rate at origination (C in the order's section 3(4)), or at the
   * last reset for a variable track. When it is below the contractual rate it
   * caps the fee. Omit it when the average is unknown: no cap, which can only
   * overstate the fee, never understate it.
   */
  originationAverageRatePercent?: number
  /**
   * True when the origination average is an effective annual rate (the BOI
   * tables publish effective rates). Defaults to true.
   */
  originationAverageRateIsEffective?: boolean
  /** Track kind - drives the statutory exemptions. */
  type: TrackType
  /** True for CPI-linked tracks, whose comparison runs on the real basis. */
  indexed: boolean
  /**
   * Assumed annual CPI change, used to deflate an indexed track's payments.
   * Defaults to the calculator's own `FALLBACK_INFLATION`, so an index-linked
   * track fed straight from the schedule keeps the PV-equals-balance identity.
   */
  annualInflation?: number
  /** Months from origination to the prepayment (drives the age reductions). */
  monthsSinceOrigination: number
  /**
   * True when the prepayment lands on a rate reset (תחנת יציאה). Only the
   * five-year reset tracks have one; for any other type the flag is ignored,
   * because a fixed or annually-reset loan has no exit station on that date.
   */
  onExitStation?: boolean
}

export type PrepaymentExemption = 'prime' | 'frequentReset' | 'exitStation'

export interface PrepaymentFeeBreakdown {
  /** PV of the remaining payments at the market rate. */
  marketPresentValue: number
  /**
   * PV of the remaining payments at the contractual rate, or at the lower
   * origination average when section 3(4)'s cap applies. With no cap this is
   * the outstanding balance.
   */
  contractualPresentValue: number
  /** Unrounded difference, floored at zero. */
  grossFee: number
  /**
   * True when section 3(4)'s origination average actually lowered the rate the
   * payments are discounted at (C below the contractual rate). False when no
   * average was entered or when it is at/above the contractual rate, so the
   * contractual rate stands. The panel uses it to say whether a typed cap did
   * anything - a cap that does not bite leaves the fee unchanged.
   */
  capApplied: boolean
  /** Legal reduction by loan age: 0, 0.2 or 0.3. */
  ageDiscount: number
  /** The exemption that zeroed the fee, when there is one. */
  exemptReason: PrepaymentExemption | null
  /** What the borrower actually pays: after exemption, reduction, and rounding. */
  fee: number
}

/** The age reduction that applies at `monthsSinceOrigination` (0, 0.2 or 0.3). */
export function ageDiscountFor(monthsSinceOrigination: number): number {
  for (const tier of AGE_DISCOUNT_TIERS) {
    if (monthsSinceOrigination >= tier.afterMonths) return tier.discount
  }
  return 0
}

/**
 * The היוון fee for one track. A rate that rose above the contractual one
 * yields a negative difference, which the law turns into zero (the borrower is
 * never paid for prepaying), so `fee` is never negative.
 */
export function prepaymentFee(input: PrepaymentFeeInput): PrepaymentFeeBreakdown {
  const {
    payments,
    balance,
    annualRatePercent,
    marketRatePercent,
    marketRateIsEffective = true,
    originationAverageRatePercent,
    originationAverageRateIsEffective = true,
    type,
    indexed,
    annualInflation,
    monthsSinceOrigination,
    onExitStation = false,
  } = input

  const empty: PrepaymentFeeBreakdown = {
    marketPresentValue: 0,
    contractualPresentValue: 0,
    grossFee: 0,
    capApplied: false,
    ageDiscount: 0,
    exemptReason: null,
    fee: 0,
  }
  if (payments.length === 0 || !(balance > 0)) return empty

  const real = deflatePayments(payments, annualInflation ?? FALLBACK_INFLATION, indexed)
  const contractualRate = periodicFromNominalAnnual(annualRatePercent)
  // Section 3(4): discount the same payments at C when the origination average
  // was lower than the contractual rate. `min` also handles the case where C
  // is unknown (then it is contractualRate) and the case where C is higher
  // (3(4) does not apply, so the contractual rate stands).
  const originationRate =
    originationAverageRatePercent === undefined
      ? contractualRate
      : originationAverageRateIsEffective
        ? periodicFromEffectiveAnnual(originationAverageRatePercent)
        : periodicFromNominalAnnual(originationAverageRatePercent)
  const loanRate = Math.min(contractualRate, originationRate)
  const marketRate = marketRateIsEffective
    ? periodicFromEffectiveAnnual(marketRatePercent)
    : periodicFromNominalAnnual(marketRatePercent)
  const capApplied = originationAverageRatePercent !== undefined && originationRate < contractualRate
  const marketPresentValue = presentValue(real, marketRate)
  const contractualPresentValue = presentValue(real, loanRate)
  const grossFee = Math.max(0, marketPresentValue - contractualPresentValue)
  const ageDiscount = ageDiscountFor(monthsSinceOrigination)
  const exemptReason: PrepaymentExemption | null =
    type === 'prime'
      ? 'prime'
      : FREQUENT_RESET_EXEMPT_TYPES.includes(type)
        ? 'frequentReset'
        : onExitStation && EXIT_STATION_TYPES.includes(type)
          ? 'exitStation'
          : null

  return {
    marketPresentValue,
    contractualPresentValue,
    grossFee,
    capApplied,
    ageDiscount,
    exemptReason,
    fee: exemptReason ? 0 : roundAgorot(grossFee * (1 - ageDiscount)),
  }
}

/**
 * "תוספת ריבית להשוואה": the fee re-expressed as a rate the borrower can
 * compare against a quoted interest rate.
 *
 * Definition: the annual rate addition whose EXTRA interest over the remaining
 * term equals the fee. A loan charged (R + x) instead of R pays an extra
 * x/12 × opening balance every month, so
 *
 *   fee = Σ_t (x/100)/12 · balance_t      ⇒      x = 1200 · fee / Σ_t balance_t
 *
 * It is deliberately an undiscounted comparison measure (that is what "להשוואה"
 * means here), not a yield: it answers "how many annual rate points is this fee
 * worth over the time left", and it uses the balance path straight from the
 * schedule, so different repayment methods stay comparable.
 *
 * `openingBalances` are the principal balances each remaining month starts
 * with, first one = the prepayment balance. For an index-linked track they are
 * deflated to today's money (the first one at t = 0 is already today's money),
 * because the fee is a real amount; otherwise mixing it with nominal balances
 * would make the result depend on the CPI assumption. Returns 0 when there is
 * no fee.
 */
export function feeAsAnnualRateAddition(input: {
  openingBalances: readonly number[]
  fee: number
  /** True for CPI-linked tracks, whose balances are nominal. */
  indexed?: boolean
  /** Assumed annual CPI change (decimal), used to deflate an indexed path. */
  annualInflation?: number
}): number {
  const { openingBalances, fee, indexed = false, annualInflation } = input
  const monthlyInflation = Math.pow(1 + (annualInflation ?? FALLBACK_INFLATION), 1 / 12)
  const sum = openingBalances.reduce(
    (total, balance, index) =>
      total + Math.max(0, indexed ? balance / Math.pow(monthlyInflation, index) : balance),
    0,
  )
  if (fee <= 0 || sum <= 0) return 0
  return roundAgorot((1200 * fee) / sum)
}

export interface PrepaymentCandidate {
  id: string
  /** Outstanding principal of the track (the full-prepayment basis). */
  balance: number
  /** The היוון fee for repaying that whole balance now. */
  fee: number
}

export interface PrepaymentAllocation {
  id: string
  /** How much of the partial amount goes to this track. */
  amount: number
  /** The fee that share costs, pro rata to the full-prepayment fee. */
  fee: number
}

export interface PrepaymentPlan {
  /** Track ids, cheapest first. */
  order: string[]
  /** Where a partial amount lands, in `order` order. */
  allocations: PrepaymentAllocation[]
  /** How much of `amount` could actually be allocated. */
  allocated: number
  /** The היוון fee the prepayment costs, after the allocation. */
  totalFee: number
}

/**
 * Cheapest payoff order for a partial prepayment. The order charges the fee
 * pro rata to the amount repaid (`fee × amount / balance`, which is how the
 * order lets a bank scale a partial prepayment), so the cheapest use of a
 * shekel is the track with the LOWEST fee per shekel of balance. Free tracks
 * (exempt, or a market rate at/above the contractual one) therefore come
 * first, and ties keep the input order.
 */
export function cheapestPrepaymentOrder(
  candidates: readonly PrepaymentCandidate[],
  amount: number,
): PrepaymentPlan {
  const usable = candidates
    .filter((candidate) => candidate.balance > 0)
    .map((candidate) => ({
      ...candidate,
      feePerShekel: Math.max(0, candidate.fee) / candidate.balance,
    }))
    .sort((a, b) => a.feePerShekel - b.feePerShekel)

  const allocations: PrepaymentAllocation[] = []
  let left = Math.max(0, amount)
  let totalFee = 0
  for (const candidate of usable) {
    if (left <= 0) break
    const take = Math.min(candidate.balance, left)
    const fee = roundAgorot(candidate.feePerShekel * take)
    allocations.push({ id: candidate.id, amount: roundAgorot(take), fee })
    totalFee += fee
    left -= take
  }

  return {
    order: usable.map((candidate) => candidate.id),
    allocations,
    allocated: roundAgorot(Math.max(0, amount) - Math.max(0, left)),
    totalFee: roundAgorot(totalFee),
  }
}

/**
 * One track's remaining schedule, in the shape the partial-prepayment
 * outcomes need. The panel fills these in from the same rows it already
 * renders, so the model never re-derives the balance, the payment or the
 * method from the inputs.
 */
export interface PartialPrepaymentTrack {
  /** Outstanding principal at the repayment date, after that month's payment. */
  balance: number
  /** The part of the partial amount allocated to this track (0 if none). */
  amount: number
  /** Scheduled payment for the first month after the repayment date. */
  nextPayment: number
  /** Principal component of that scheduled payment. */
  nextPrincipal: number
  /** Contractual annual rate in percent (real for an index-linked track). */
  annualRatePercent: number
  /** Months left on the current schedule. */
  remainingMonths: number
  /** Repayment method; it decides what "keep the payment" means. */
  method: AmortizationMethod
  /** True for CPI-linked tracks, whose balances and payments grow with the index. */
  indexed: boolean
}

/** One method's result for the whole mix. */
export interface PartialPrepaymentMode {
  /** First payment after the prepayment, across the tracks in the model. */
  monthlyPayment: number
  /** Months until the last track is repaid (0 when everything was repaid now). */
  months: number
  /** Future payments over those months (the statutory fee is not included). */
  totalPaid: number
  /** Interest inside `totalPaid`. */
  totalInterest: number
}

/** Both legal ways to take a partial prepayment, next to the unchanged mix. */
export interface PartialPrepaymentOutcomes {
  /** No prepayment: the schedule exactly as it stands after the chosen date. */
  unchanged: PartialPrepaymentMode
  /** The same payment basis, with the term shortened by the amount repaid. */
  shortenTerm: PartialPrepaymentMode
  /** The same maturity, with the payment recalculated on the lower balance. */
  reducePayment: PartialPrepaymentMode
}

interface TrackOutcome {
  monthlyPayment: number
  months: number
  totalPaid: number
  totalInterest: number
}

const emptyOutcome = (): TrackOutcome => ({
  monthlyPayment: 0,
  months: 0,
  totalPaid: 0,
  totalInterest: 0,
})

/** Annuity payment that amortizes `balance` over `months` at a monthly rate. */
function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0
  if (monthlyRate <= 0) return balance / months
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
}

/**
 * Months a fixed payment needs to clear `balance`. The payment itself is on
 * the same real basis as the balance and the rate, so indexation does not
 * enter this step; the simulation below adds it back to the nominal payments.
 * A payment that does not cover the monthly interest never amortizes and
 * returns 0, which the caller reports as "no result" rather than inventing a
 * term.
 */
function monthsToAmortize(balance: number, monthlyRate: number, payment: number): number {
  if (!(balance > 0) || !(payment > 0)) return 0
  if (monthlyRate <= 0) return Math.ceil(balance / payment - 1e-9)
  const interest = balance * monthlyRate
  if (payment <= interest) return 0
  return Math.max(1, Math.ceil(-Math.log(1 - interest / payment) / Math.log(1 + monthlyRate) - 1e-9))
}

/**
 * Walk a reduced balance forward for `months` payments and report what the
 * borrower actually pays. Two details keep this on the schedule's own
 * convention:
 *
 * - The first payment is one month out, so an indexed balance grows once
 *   before it (`monthlyInflation`, exactly as `computeTrackResult` inflates
 *   every month after the first).
 * - The final payment absorbs the remainder, so rounding cannot leave a
 *   phantom balance behind.
 *
 * For a CPI-linked track the payment is kept on its real basis, not frozen in
 * nominal shekels: the index still lifts the payment, which is why the panel
 * does not call the shortened-term payment "identical" for those tracks.
 */
function simulateOutcome(input: {
  balance: number
  months: number
  monthlyRate: number
  monthlyInflation: number
  method: AmortizationMethod
  /** Real (today's money) payment for a spitzer track. */
  realPayment: number
  /** Real principal installment for an equal-principal track. */
  realPrincipal: number
}): TrackOutcome {
  const { balance, months, monthlyRate, monthlyInflation, method } = input
  if (!(balance > 0) || months <= 0) return emptyOutcome()
  if (!(monthlyInflation > 0) || !Number.isFinite(monthlyInflation)) return emptyOutcome()
  const basis = method === 'equalPrincipal' ? input.realPrincipal : input.realPayment
  if (!(basis > 0) || !Number.isFinite(basis)) return emptyOutcome()

  let remaining = balance
  let monthlyPayment = 0
  let totalPaid = 0
  let totalInterest = 0
  let paidMonths = 0

  for (let month = 1; month <= months; month++) {
    const inflationFactor = Math.pow(monthlyInflation, month)
    remaining *= monthlyInflation
    const interest = remaining * monthlyRate
    let principal: number
    let payment: number
    if (method === 'equalPrincipal') {
      principal = Math.min(remaining, basis * inflationFactor)
      payment = principal + interest
    } else {
      const scheduled = basis * inflationFactor
      principal = Math.min(remaining, Math.max(0, scheduled - interest))
      payment = principal + interest
    }
    if (month === 1) monthlyPayment = payment
    remaining = Math.max(0, remaining - principal)
    totalPaid += payment
    totalInterest += interest
    paidMonths = month
    if (remaining <= 0.005) break
  }

  return { monthlyPayment, months: paidMonths, totalPaid, totalInterest }
}

/** One track's unchanged, shortened and lowered results. */
function trackOutcomes(
  track: PartialPrepaymentTrack,
  annualInflation: number,
): { unchanged: TrackOutcome; shortenTerm: TrackOutcome; reducePayment: TrackOutcome } {
  const zero = { unchanged: emptyOutcome(), shortenTerm: emptyOutcome(), reducePayment: emptyOutcome() }
  const balance = Number.isFinite(track.balance) ? Math.max(0, track.balance) : 0
  const months = Math.round(track.remainingMonths)
  const rate = Number.isFinite(track.annualRatePercent) ? Math.max(0, track.annualRatePercent) : 0
  const nextPayment = Number.isFinite(track.nextPayment) ? track.nextPayment : 0
  const nextPrincipal = Number.isFinite(track.nextPrincipal) ? track.nextPrincipal : 0
  if (!(balance > 0) || months <= 0) return zero
  if (!(nextPayment > 0) || !(nextPrincipal > 0)) return zero

  const monthlyRate = periodicFromNominalAnnual(rate)
  const monthlyInflation = track.indexed ? Math.pow(1 + annualInflation, 1 / 12) : 1
  if (!(monthlyInflation > 0) || !Number.isFinite(monthlyInflation)) return zero

  // The schedule's next payment is one month out; deflate it to today's money
  // so it can sit next to the balance, which is already in today's money.
  const realPayment = nextPayment / monthlyInflation
  const realPrincipal = nextPrincipal / monthlyInflation

  const base = {
    balance,
    months,
    monthlyRate,
    monthlyInflation,
    method: track.method,
  }
  const unchanged = simulateOutcome({ ...base, realPayment, realPrincipal })
  const amount = Number.isFinite(track.amount) ? Math.min(Math.max(0, track.amount), balance) : 0
  if (amount <= 0) return { unchanged, shortenTerm: unchanged, reducePayment: unchanged }

  const after = Math.max(0, balance - amount)
  if (after <= 0) return { unchanged, shortenTerm: emptyOutcome(), reducePayment: emptyOutcome() }

  let shortened: TrackOutcome
  let reduced: TrackOutcome
  if (track.method === 'equalPrincipal') {
    const shortenedMonths = Math.max(1, Math.ceil(after / realPrincipal - 1e-9))
    shortened = simulateOutcome({
      ...base,
      balance: after,
      months: Math.min(months, shortenedMonths),
      realPayment,
      realPrincipal,
    })
    reduced = simulateOutcome({
      ...base,
      balance: after,
      realPayment,
      realPrincipal: after / months,
    })
  } else {
    const shortenedMonths = monthsToAmortize(after, monthlyRate, realPayment)
    shortened = simulateOutcome({
      ...base,
      balance: after,
      months: Math.min(months, shortenedMonths || months),
      realPayment,
      realPrincipal,
    })
    reduced = simulateOutcome({
      ...base,
      balance: after,
      realPayment: annuityPayment(after, monthlyRate, months),
      realPrincipal,
    })
  }

  return { unchanged, shortenTerm: shortened, reducePayment: reduced }
}

/** Total a set of track results into one mode. */
function sumOutcomes(outcomes: readonly TrackOutcome[]): PartialPrepaymentMode {
  return outcomes.reduce<PartialPrepaymentMode>(
    (total, outcome) => ({
      monthlyPayment: total.monthlyPayment + outcome.monthlyPayment,
      months: Math.max(total.months, outcome.months),
      totalPaid: total.totalPaid + outcome.totalPaid,
      totalInterest: total.totalInterest + outcome.totalInterest,
    }),
    { monthlyPayment: 0, months: 0, totalPaid: 0, totalInterest: 0 },
  )
}

/**
 * The two ways a partial prepayment can be applied, and the unchanged mix for
 * comparison. The caller decides how the amount is split across tracks; this
 * function only models what each track looks like afterwards.
 *
 * `shortenTerm` keeps the payment basis: a spitzer track keeps its real
 * payment and ends earlier, an equal-principal track keeps its real principal
 * installment and ends earlier. `reducePayment` keeps the maturity and
 * recalculates the payment on the lower balance. For an index-linked track the
 * index is still assumed to lift both the balance and the payment, so neither
 * mode promises a constant nominal shekel figure. Rate resets are outside this
 * model: it uses the schedule's current rate, the same rate the schedule above
 * already shows.
 *
 * A track whose whole balance is repaid contributes zero payments and zero
 * months. An amount of zero gives the unchanged result for both modes, and a
 * non-finite input is treated as zero, so a malformed row can never produce a
 * confident-looking term.
 */
export function partialPrepaymentOutcomes(
  tracks: readonly PartialPrepaymentTrack[],
  annualInflation: number = FALLBACK_INFLATION,
): PartialPrepaymentOutcomes {
  const inflation =
    Number.isFinite(annualInflation) && annualInflation > -1 ? annualInflation : FALLBACK_INFLATION
  const results = tracks.map((track) => trackOutcomes(track, inflation))
  return {
    unchanged: sumOutcomes(results.map((result) => result.unchanged)),
    shortenTerm: sumOutcomes(results.map((result) => result.shortenTerm)),
    reducePayment: sumOutcomes(results.map((result) => result.reducePayment)),
  }
}
