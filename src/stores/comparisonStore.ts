import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  allocatePreset,
  autoFixVariableMix,
  DEFAULT_LAWYER_PERCENT,
  DEFAULT_REALTOR_PERCENT,
  DEFAULT_TERM_YEARS,
  deriveLoanAmount,
  distributeEqually,
  isVariableType,
  LAWYER_MINIMUM_FEE,
  lawyerFee,
  MAX_HOME_VALUE,
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  nextFreeTrackType,
  PRESETS,
  redistributeTrackAmounts,
  scaleTrackAmounts,
  splitLargestForNewTrack,
  VAT_RATE,
  type PresetId,
  type PropertyPurpose,
  type TrackType,
} from '@/lib/amortization'
import { formatAmountWithCaret, formatGroupedNumber, parseAmountText } from '@/lib/format'
import { parseDateOnly } from '@/lib/rateValidity'
import {
  computeScenario,
  sharedFeeProfileFromTexts,
  type ScenarioResult,
  type SharedBuyerInputs,
} from '@/features/compare/computeScenario'
import { createInitialTracks, type TrackState } from '@/stores/calculatorStore'

/**
 * Comparison feature state - Option A (separate store), confirmed with the
 * user. The existing single-scenario calculator store is untouched; this
 * store holds N scenarios plus its own copy of the shared buyer inputs,
 * seeded once from the main calculator when the user arrives from there
 * (confirmed decision: own copy, no live sync).
 *
 * Every scenario's numbers are recomputed with the same pure functions the
 * main calculator uses (via computeScenario.ts) - no duplicated math.
 */

/**
 * One comparison scenario: a labeled track mix (and its term) evaluated against
 * the shared borrower inputs. The loan itself is NOT per scenario - one shared
 * סכום המשכנתא prices every column, so the comparison varies the MIX.
 */
export interface ComparisonScenario {
  id: string
  /** User-editable, e.g. "תמהיל שמרני". */
  label: string
  tracks: TrackState[]
  termYears: number
  /** Last chosen preset mix: highlights its button and keeps re-allocation exact. */
  activePreset: PresetId | null
  /**
   * אישור עקרוני approval date as a date-only 'YYYY-MM-DD', or '' when not
   * entered. Each mix is its own offer, so each carries its own date: the rate
   * quoted in a pre-approval holds for a fixed window (see
   * `src/lib/rateValidity.ts`), and offers compared side by side rarely share
   * one. Session input: never persisted, never part of the math.
   */
  approvalDateText: string
}

/** One repeatable shared expense row: a recurring monthly amount plus an
    optional one-time amount. Unlike the calculator's rows these carry no
    name/description - the compare page keeps just the two amounts. */
export interface SharedExpense {
  id: string
  monthlyText: string
  oneTimeText: string
}

/** The shared, entered-once buyer/property profile (own copy, seeded once). */
export interface ComparisonSharedInputs {
  propertyValueText: string
  capitalText: string
  incomeText: string
  purpose: PropertyPurpose
  /**
   * סכום המשכנתא - the loan, entered once and priced into every scenario
   * (calculator parity). With a property value set it mirrors property -
   * capital and locks; without one it defines the loan every mix is filled
   * and scaled from.
   */
  mortgageSumText: string
  /** Loan memory for the sum-field mirror when the property is cleared. */
  derivedLoanMemory: number
  /**
   * Transaction costs (calculator parity): realtor/lawyer as percent text
   * (blank falls back to the market norm, like the calculator), appraiser as
   * a flat ₪ fee, and the planned renovation budget. All are one-time costs;
   * renovations also eat into the capital the loan derives from.
   */
  realtorPercentText: string
  lawyerPercentText: string
  /** The ₪-inclusive mirror of the realtor/lawyer percents (calculator
      parity): the percent stays canonical, the ₪ side converts back into it.
      Both derive at recompute time, so these hold the mirrored display text. */
  realtorAmountText: string
  lawyerAmountText: string
  appraiserFeeText: string
  renovationAmountText: string
  /** Repeatable expense rows (calculator parity): the monthly amounts fold
      into the payment-to-income check, the one-time amounts join the upfront
      cash total. Sums derive at recompute time - no cached copies. */
  otherExpenses: SharedExpense[]
  ptiThresholdPercent: number
}

/**
 * Derived fee-field UX (calculator parity): the market-norm hints shown on a
 * cleared pair, whether the ₪ mirrors have a basis to render against, and the
 * lawyer-floor flag the note under the pair explains.
 */
export interface ComparisonFeeHints {
  amountsVisible: boolean
  realtorPercentHint: string | null
  lawyerPercentHint: string | null
  realtorAmountHint: string | null
  lawyerAmountHint: string | null
  lawyerFloorApplied: boolean
}

export interface ComparisonState {
  scenarios: ComparisonScenario[]
  shared: ComparisonSharedInputs
  results: ScenarioResult[]
  fee: ComparisonFeeHints
}

export interface ComparisonActions {
  setLabel(id: string, label: string): void
  /** אישור עקרוני date for one mix; date-only 'YYYY-MM-DD' or '' to clear. */
  setScenarioApprovalDate(id: string, raw: string): void
  setPropertyValue(raw: string, caret: number | null): { text: string; caret: number | null }
  setCapital(raw: string, caret: number | null): { text: string; caret: number | null }
  setIncome(raw: string, caret: number | null): { text: string; caret: number | null }
  /** Blur commits - the calculator's setPropertyBlur/setCapitalBlur/setIncomeBlur. */
  commitPropertyValueBlur(): void
  commitCapitalBlur(): void
  commitIncomeBlur(): void
  setPurpose(purpose: PropertyPurpose): void
  updateRealtorPercent(raw: string): string
  updateLawyerPercent(raw: string): string
  updateRealtorAmount(
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  updateLawyerAmount(
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  updateAppraiserFee(
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  updateRenovationAmount(
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  addSharedExpense(): void
  updateSharedExpenseMonthly(
    id: string,
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  updateSharedExpenseOneTime(
    id: string,
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  removeSharedExpense(id: string): void
  addScenario(): void
  duplicateScenario(id: string): void
  removeScenario(id: string): void
  addTrack(scenarioId: string): void
  removeTrack(scenarioId: string, trackId: string): void
  updateTrackAmount(
    scenarioId: string,
    trackId: string,
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  commitTrackAmountBlur(scenarioId: string, trackId: string): void
  updateTrackRate(scenarioId: string, trackId: string, raw: string): void
  commitTrackRateBlur(scenarioId: string, trackId: string): void
  changeTrackType(scenarioId: string, trackId: string, type: TrackState['type']): void
  changeTrackMethod(scenarioId: string, trackId: string, method: TrackState['method']): void
  setScenarioTermYears(scenarioId: string, years: number): void
  setMortgageSum(raw: string, caret: number | null): { text: string; caret: number | null }
  /**
   * One-click repair of a scenario's error state: trims an over-cap variable
   * mix back under the Bank of Israel 2/3 ceiling (the calculator's own
   * autofix rule, topped back up to the shared loan on the fixed side), and
   * normalises invalid terms/amounts against the shared loan.
   */
  fixScenario(scenarioId: string): void
  loadScenarioPreset(scenarioId: string, presetId: PresetId): void
  reset(): void
}

export type ComparisonStore = ComparisonState & ComparisonActions

let nextScenarioId = 1
let nextTrackId = 1
let nextExpenseId = 1

function makeExpenseId(): string {
  return `cexpense-${nextExpenseId++}`
}

/** A blank shared expense row - the calculator opens with one as well. */
function blankExpense(): SharedExpense {
  return { id: makeExpenseId(), monthlyText: '', oneTimeText: '' }
}

function makeScenarioId(): string {
  return `scenario-${nextScenarioId++}`
}

function makeTrackId(): string {
  return `ctrack-${nextTrackId++}`
}

/**
 * A blank scenario's opening track: no amount, the given term, and the track
 * type's default rate. The rate IS seeded - a blank rate would price a 0% loan
 * the moment an amount is typed, which is a wrong number rather than a missing
 * one (same rule as commitTrackRateBlur). Everything else is the user's to
 * enter.
 */
function blankTrack(termYears: number, type: TrackType = 'fixed'): TrackState {
  return {
    id: makeTrackId(),
    type,
    amountText: '',
    yearsText: String(termYears),
    rateText: defaultRateFor(type),
    method: 'spitzer',
    isAutoRate: true,
    loanShareMemory: null,
  }
}

/**
 * The opening pair: scenario 1 (תמהיל 1) starts with the calculator's own
 * opening data - the ₪1,000,000 recommended mix (basket4) at the default term,
 * via the very same createInitialTracks the main calculator uses, so the
 * comparison's first column matches what a user sees on the calculator before
 * touching anything. Scenario 2 opens blank: it is the alternative the user
 * builds by hand (or by duplicating scenario 1).
 */
function createInitialScenarios(calculatorApprovalDate = ''): ComparisonScenario[] {
  return [
    {
      id: makeScenarioId(),
      label: '',
      tracks: createInitialTracks(null),
      termYears: DEFAULT_TERM_YEARS,
      activePreset: 'basket4',
      // The calculator's אישור עקרוני date travels with the mix it belongs to.
      approvalDateText: calculatorApprovalDate,
    },
    {
      id: makeScenarioId(),
      label: '',
      tracks: [blankTrack(DEFAULT_TERM_YEARS)],
      termYears: DEFAULT_TERM_YEARS,
      activePreset: null,
      approvalDateText: '',
    },
  ]
}

function defaultSharedInputs(): ComparisonSharedInputs {
  return {
    propertyValueText: '',
    capitalText: '',
    incomeText: '',
    purpose: 'first',
    // The sum starts exactly like the calculator's: ₪1,000,000, the opening
    // mix's total (the calculator's startingAmountText prefill).
    mortgageSumText: '1,000,000',
    derivedLoanMemory: 0,
    // Blank is deliberate: the fee profile resolves to the market norm
    // (2% realtor / 0.5% lawyer) only when the fields look untouched, and a
    // blank field reads as "not entered" rather than a typed 0.
    realtorPercentText: '',
    lawyerPercentText: '',
    realtorAmountText: '',
    lawyerAmountText: '',
    appraiserFeeText: '',
    renovationAmountText: '',
    otherExpenses: [blankExpense()],
    ptiThresholdPercent: 33,
  }
}

/** A resting fee-hints block (no basis, cleared pair). recompute refines it. */
function defaultFeeHints(): ComparisonFeeHints {
  return {
    amountsVisible: false,
    realtorPercentHint: String(DEFAULT_REALTOR_PERCENT),
    lawyerPercentHint: String(DEFAULT_LAWYER_PERCENT),
    realtorAmountHint: null,
    lawyerAmountHint: null,
    lawyerFloorApplied: false,
  }
}

function toComputeInputs(shared: ComparisonSharedInputs): SharedBuyerInputs {
  const profile = sharedFeeProfileFromTexts({
    realtorPercentText: shared.realtorPercentText,
    lawyerPercentText: shared.lawyerPercentText,
    appraiserFeeText: shared.appraiserFeeText,
  })
  return {
    propertyValueText: shared.propertyValueText,
    capitalText: shared.capitalText,
    incomeText: shared.incomeText,
    purpose: shared.purpose,
    realtorPercent: profile.realtorPercent,
    lawyerPercent: profile.lawyerPercent,
    appraiserFee: profile.appraiserFee,
    renovations: parseAmountText(shared.renovationAmountText),
    // Sums derive from the rows at recompute time, so an edited row can
    // never leave a stale total behind.
    otherMonthly: shared.otherExpenses.reduce(
      (sum, expense) => sum + parseAmountText(expense.monthlyText),
      0,
    ),
    oneTimeExpenses: shared.otherExpenses.reduce(
      (sum, expense) => sum + parseAmountText(expense.oneTimeText),
      0,
    ),
    ptiThresholdPercent: shared.ptiThresholdPercent,
  }
}

/** Re-runs every scenario's numbers against the (possibly changed) shared inputs. */
function recompute(s: ComparisonState): void {
  syncFeeDialogue(s)
  s.results = s.scenarios.map((scenario) =>
    computeScenario(scenario.tracks, toComputeInputs(s.shared)),
  )
}

function findTrack(
  s: ComparisonState,
  scenarioId: string,
  trackId: string,
): TrackState | undefined {
  return s.scenarios
    .find((entry) => entry.id === scenarioId)
    ?.tracks.find((track) => track.id === trackId)
}

/** Default rate per track type, mirroring DEFAULT_RATES_BY_TYPE + prime fallback. */
function defaultRateFor(type: TrackState['type']): string {
  switch (type) {
    case 'prime':
      return '5.75'
    case 'fixed':
      return '4.5'
    case 'variable5y':
      return '4.25'
    case 'variable':
      return '4.3'
    case 'fixedIndexed':
      return '3.0'
    case 'variableIndexed5y':
      return '3.0'
    case 'variableIndexed':
      return '3.2'
  }
}

/** Display text for a track amount: grouped whole shekels, blank for zero. */
function displayAmountText(amount: number): string {
  return amount > 0 ? Math.round(amount).toLocaleString('en-US') : ''
}

/** Sum of formatted amount texts as grouped shekels, blank when the sum is 0. */
function sumAmountsText(texts: string[]): string {
  const sum = texts.reduce((total, text) => total + parseAmountText(text), 0)
  return sum > 0 ? formatGroupedNumber(sum) : ''
}

/**
 * Capital left for the loan after renovations AND one-time expenses eat into
 * it (calculator parity): both are paid from savings, so the down-payment
 * equity - and the loan derived from it - shrinks. Monthly expenses do not.
 */
function capitalForLoan(s: ComparisonState): number {
  const oneTime = s.shared.otherExpenses.reduce(
    (sum, expense) => sum + parseAmountText(expense.oneTimeText),
    0,
  )
  return Math.max(
    0,
    parseAmountText(s.shared.capitalText) -
      parseAmountText(s.shared.renovationAmountText) -
      oneTime,
  )
}

/**
 * The loan every scenario is priced from, exactly like the calculator's
 * getLoanAmount: with a property value it is property - capital (and the sum
 * input follows and locks); without one the typed shared sum defines it.
 * Sharing it is the point of the page - the scenarios vary the MIX, not the
 * amount borrowed - and it is why the sum never mirrors back from one
 * scenario's tracks (whichever one would win is arbitrary).
 */
function loanAmount(s: ComparisonState): number {
  return deriveLoanAmount(
    parseAmountText(s.shared.propertyValueText),
    parseAmountText(s.shared.mortgageSumText),
    capitalForLoan(s),
  )
}

/** Percent text ('', '2', '2.5') to a non-negative finite number. */
function parsePercentText(text: string): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Cleared realtor percent rests on the market norm (calculator parity). */
function effectiveRealtorPercent(s: ComparisonState): number {
  const text = s.shared.realtorPercentText.trim()
  return text === '' ? DEFAULT_REALTOR_PERCENT : parsePercentText(text)
}

/** Cleared lawyer percent rests on the market norm (calculator parity). */
function effectiveLawyerPercent(s: ComparisonState): number {
  const text = s.shared.lawyerPercentText.trim()
  return text === '' ? DEFAULT_LAWYER_PERCENT : parsePercentText(text)
}

/**
 * Fee basis for the percent <-> ₪ conversion (calculator parity): the property
 * value, or the shared loan + post-cost capital when no property is entered.
 * One shared basis keeps the pair consistent across scenarios - the fees
 * describe the buyer, not the mix.
 */
function feeBasisOf(s: ComparisonState): number {
  const property = parseAmountText(s.shared.propertyValueText)
  if (property > 0) return property
  return loanAmount(s) + capitalForLoan(s)
}

/**
 * Percent text derived from an entered ₪ amount. Kept precise (2 decimals,
 * trailing zeros trimmed) so the mirrored ₪ round-trips from the percent.
 */
function percentTextFromAmount(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return ''
  return String(Number(percent.toFixed(2)))
}

/**
 * Keep the fee pair and its hints in step (calculator parity): the percent is
 * canonical, the ₪ mirror re-derives from it, and a cleared pair shows the
 * market norm as a hint instead of refilling. Also records whether the pair
 * has a basis to render the ₪ mirror against and whether the lawyer floor won.
 */
function syncFeeDialogue(s: ComparisonState): void {
  const realtorCleared = s.shared.realtorPercentText.trim() === ''
  const lawyerCleared = s.shared.lawyerPercentText.trim() === ''
  const basis = feeBasisOf(s)
  s.fee.amountsVisible = basis > 0
  s.fee.realtorPercentHint = realtorCleared ? String(DEFAULT_REALTOR_PERCENT) : null
  s.fee.lawyerPercentHint = lawyerCleared ? String(DEFAULT_LAWYER_PERCENT) : null
  if (basis > 0) {
    const realtorPreVat = (effectiveRealtorPercent(s) / 100) * basis
    const lawyerPercent = effectiveLawyerPercent(s)
    const lawyerPreVat = lawyerFee(basis, lawyerPercent)
    const realtorWithVat =
      realtorPreVat > 0 ? formatGroupedNumber(Math.round(realtorPreVat * (1 + VAT_RATE))) : ''
    const lawyerWithVat =
      lawyerPreVat > 0 ? formatGroupedNumber(Math.round(lawyerPreVat * (1 + VAT_RATE))) : ''
    s.fee.lawyerFloorApplied =
      !lawyerCleared &&
      lawyerPreVat > 0 &&
      (lawyerPercent / 100) * basis < LAWYER_MINIMUM_FEE - 1e-6
    // A typed percent rewrites its ₪ mirror; a cleared pair stays blank so the
    // hint shows (and the field never refills under the user).
    s.shared.realtorAmountText = realtorCleared ? '' : realtorWithVat
    s.shared.lawyerAmountText = lawyerCleared ? '' : lawyerWithVat
    s.fee.realtorAmountHint = realtorCleared ? realtorWithVat || null : null
    s.fee.lawyerAmountHint = lawyerCleared ? lawyerWithVat || null : null
  } else {
    s.shared.realtorAmountText = ''
    s.shared.lawyerAmountText = ''
    s.fee.realtorAmountHint = null
    s.fee.lawyerAmountHint = null
    s.fee.lawyerFloorApplied = false
  }
}

/** Pure scaleTrackAmounts applied to one scenario's tracks. */
function scaleScenarioTracks(s: ComparisonState, scenario: ComparisonScenario): void {
  const currentAmounts = scenario.tracks.map((track) => parseAmountText(track.amountText))
  const previousMemory = scenario.tracks.map((track) => track.loanShareMemory)
  const result = scaleTrackAmounts(currentAmounts, previousMemory, loanAmount(s))
  if (!result) return
  scenario.tracks.forEach((track, index) => {
    track.amountText = displayAmountText(result.amounts[index])
    track.loanShareMemory = result.shareMemory[index]
  })
}

/** Legacy snapTracksToLoan: proportional scale, or an equal split at zero. */
function snapScenarioTracksToLoan(s: ComparisonState, scenario: ComparisonScenario): void {
  const total = scenario.tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  if (total) {
    scaleScenarioTracks(s, scenario)
  } else {
    const amounts = distributeEqually(loanAmount(s), scenario.tracks.length)
    if (!amounts.length) return
    scenario.tracks.forEach((track, index) => {
      track.amountText = displayAmountText(amounts[index])
    })
  }
}

/**
 * True when the tracks still hold the active preset's OWN allocation, at
 * whatever scale - nobody has edited the mix by hand. Re-allocating such a
 * lineup from the preset at a new loan is exact (calculator parity).
 */
function amountsMirrorPreset(scenario: ComparisonScenario): boolean {
  if (!scenario.activePreset) return false
  const amounts = scenario.tracks.map((track) => parseAmountText(track.amountText))
  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  const allocated = allocatePreset(scenario.activePreset, total, null)
  return (
    allocated.length === amounts.length &&
    allocated.every((track, index) => track.amount === amounts[index])
  )
}

/**
 * Fill/scale the tracks from the loan-defining inputs - a direct port of the
 * calculator's fillTracksFromLoanInput: a preset lineup re-allocates exactly,
 * a hand-built mix scales proportionally, an all-zero mix splits equally.
 */
function fillScenarioTracksFromLoanInput(s: ComparisonState, scenario: ComparisonScenario): void {
  const loan = loanAmount(s)
  const amounts = scenario.tracks.map((track) => parseAmountText(track.amountText))
  const preset = scenario.activePreset ? PRESETS[scenario.activePreset] : null
  const lineupMatches =
    preset !== null &&
    preset.length === scenario.tracks.length &&
    preset.every((definition, index) => definition.type === scenario.tracks[index].type)
  if (
    loan > 0 &&
    lineupMatches &&
    (amounts.some((amount) => amount === 0) || amountsMirrorPreset(scenario))
  ) {
    const allocated = allocatePreset(scenario.activePreset!, loan, null)
    scenario.tracks.forEach((track, index) => {
      track.amountText = displayAmountText(allocated[index].amount)
    })
    return
  }
  snapScenarioTracksToLoan(s, scenario)
}

/**
 * The shared sum field follows property - capital while a property is set, and
 * restores the (loan + capital) figure when the property is cleared - the
 * calculator's syncStartingFromProperty, hoisted to the one shared loan.
 */
function syncMortgageSumFromProperty(s: ComparisonState): void {
  const property = parseAmountText(s.shared.propertyValueText)
  if (property > 0) {
    const loan = loanAmount(s)
    s.shared.derivedLoanMemory = loan
    s.shared.mortgageSumText = loan > 0 ? formatGroupedNumber(loan) : ''
  } else if (s.shared.derivedLoanMemory > 0) {
    const gross = Math.round(s.shared.derivedLoanMemory + capitalForLoan(s))
    s.shared.mortgageSumText = gross > 0 ? formatGroupedNumber(gross) : ''
    s.shared.derivedLoanMemory = 0
  }
}

/**
 * A shared loan-input edit (sum / property / capital): re-derive the sum's
 * mirror and re-fill every scenario's mix at the new loan.
 */
function applySharedLoanInput(s: ComparisonState): void {
  syncMortgageSumFromProperty(s)
  s.scenarios.forEach((scenario) => fillScenarioTracksFromLoanInput(s, scenario))
}

export const useComparisonStore = create<ComparisonStore>()(
  immer((set) => ({
    scenarios: createInitialScenarios(),
    shared: defaultSharedInputs(),
    results: [],
    fee: defaultFeeHints(),

    setLabel: (id, label) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === id)
        if (scenario) scenario.label = label
      })
    },

    setScenarioApprovalDate: (id, raw) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === id)
        if (!scenario) return
        // A malformed value clears rather than storing junk the chip would
        // silently swallow. No recompute: the date never feeds the math.
        scenario.approvalDateText = parseDateOnly(raw) === null ? '' : raw.trim()
      })
    },

    setPropertyValue: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      // Same home-price cap as the main calculator: one clamp at the input.
      const cappedText =
        parseAmountText(formatted.text) > MAX_HOME_VALUE
          ? formatAmountWithCaret(String(MAX_HOME_VALUE), null).text
          : formatted.text
      const cappedCaret =
        formatted.caret === null ? null : Math.min(formatted.caret, cappedText.length)
      set((s) => {
        s.shared.propertyValueText = cappedText
        // Calculator parity: the property re-derives the loan - the shared sum
        // field follows (property - capital) and every scenario's mix fills or
        // scales with it.
        applySharedLoanInput(s)
        recompute(s)
      })
      return { text: cappedText, caret: cappedCaret }
    },

    setCapital: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.capitalText = formatted.text
        // Calculator parity: the capital re-derives the shared loan.
        applySharedLoanInput(s)
        recompute(s)
      })
      return formatted
    },

    setIncome: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.incomeText = formatted.text
        recompute(s)
      })
      return formatted
    },

    // Blur commits format the typed text one last time (calculator parity:
    // setPropertyBlur/setCapitalBlur/setIncomeBlur). No recompute - the
    // parse value is unchanged, only the grouping is finalized.
    commitPropertyValueBlur: () => {
      set((s) => {
        s.shared.propertyValueText = formatAmountWithCaret(s.shared.propertyValueText, null).text
      })
    },

    commitCapitalBlur: () => {
      set((s) => {
        s.shared.capitalText = formatAmountWithCaret(s.shared.capitalText, null).text
      })
    },

    commitIncomeBlur: () => {
      set((s) => {
        s.shared.incomeText = formatAmountWithCaret(s.shared.incomeText, null).text
      })
    },

    setPurpose: (purpose) => {
      set((s) => {
        s.shared.purpose = purpose
        recompute(s)
      })
    },

    updateRealtorPercent: (raw) => {
      const clean = sanitizePercentInput(raw)
      set((s) => {
        s.shared.realtorPercentText = clean
        recompute(s)
      })
      return clean
    },

    updateLawyerPercent: (raw) => {
      const clean = sanitizePercentInput(raw)
      set((s) => {
        s.shared.lawyerPercentText = clean
        recompute(s)
      })
      return clean
    },

    updateRealtorAmount: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const basis = feeBasisOf(s)
        const value = parseAmountText(formatted.text)
        // Editing the ₪ side sets the equivalent percent (the percent stays
        // canonical); recompute then mirrors the ₪ back from it. A cleared or
        // zero field restores the market-norm hint like the property field.
        if (basis > 0) {
          s.shared.realtorPercentText =
            value > 0 ? percentTextFromAmount((value / (1 + VAT_RATE) / basis) * 100) : ''
        }
        recompute(s)
      })
      return formatted
    },

    updateLawyerAmount: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const basis = feeBasisOf(s)
        const value = parseAmountText(formatted.text)
        if (basis > 0) {
          s.shared.lawyerPercentText =
            value > 0 ? percentTextFromAmount((value / (1 + VAT_RATE) / basis) * 100) : ''
        }
        recompute(s)
        // Keep the typed ₪ figure when the ₪6,000 pre-VAT minimum would have
        // replaced it (calculator parity): the field shows what was typed and
        // the floor note explains that the real fee is the minimum.
        if (s.fee.lawyerFloorApplied) s.shared.lawyerAmountText = formatted.text
      })
      return formatted
    },

    updateAppraiserFee: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.appraiserFeeText = formatted.text
        recompute(s)
      })
      return formatted
    },

    updateRenovationAmount: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.renovationAmountText = formatted.text
        // Calculator parity: renovations reduce the capital the loan is
        // derived from, so the shared loan and every scenario re-fill.
        applySharedLoanInput(s)
        recompute(s)
      })
      return formatted
    },

    addSharedExpense: () => {
      set((s) => {
        if (s.shared.otherExpenses.length >= MAX_OTHER_EXPENSES) return
        s.shared.otherExpenses.push(blankExpense())
        recompute(s)
      })
    },

    updateSharedExpenseMonthly: (id, raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const expense = s.shared.otherExpenses.find((entry) => entry.id === id)
        if (expense) expense.monthlyText = formatted.text
        recompute(s)
      })
      return formatted
    },

    updateSharedExpenseOneTime: (id, raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const expense = s.shared.otherExpenses.find((entry) => entry.id === id)
        if (expense) expense.oneTimeText = formatted.text
        // Calculator parity: a one-time expense eats the down-payment equity
        // like renovations, so the shared loan and every scenario re-fill.
        applySharedLoanInput(s)
        recompute(s)
      })
      return formatted
    },

    removeSharedExpense: (id) => {
      set((s) => {
        s.shared.otherExpenses = s.shared.otherExpenses.filter((entry) => entry.id !== id)
        // Removing a row can restore equity (a one-time amount goes with it),
        // so re-derive the shared loan like an edit does.
        applySharedLoanInput(s)
        recompute(s)
      })
    },

    addScenario: () => {
      set((s) => {
        if (s.scenarios.length >= MAX_TRACKS) return
        s.scenarios.push({
          id: makeScenarioId(),
          label: '',
          // Start empty: the user builds the alternative mix by hand (or
          // duplicates an existing scenario instead).
          tracks: [blankTrack(DEFAULT_TERM_YEARS)],
          termYears: DEFAULT_TERM_YEARS,
          activePreset: null,
          approvalDateText: '',
        })
        recompute(s)
      })
    },

    duplicateScenario: (id) => {
      set((s) => {
        if (s.scenarios.length >= MAX_TRACKS) return
        const index = s.scenarios.findIndex((entry) => entry.id === id)
        if (index < 0) return
        const source = s.scenarios[index]
        // Deep copy with fresh ids so editing one copy never touches the other.
        s.scenarios.splice(index + 1, 0, {
          id: makeScenarioId(),
          label: source.label,
          tracks: source.tracks.map((track) => ({ ...track, id: makeTrackId() })),
          termYears: source.termYears,
          activePreset: source.activePreset,
          // The copy is the same offer, so it starts on the same date.
          approvalDateText: source.approvalDateText,
        })
        recompute(s)
      })
    },

    removeScenario: (id) => {
      set((s) => {
        if (s.scenarios.length <= 2) return
        s.scenarios = s.scenarios.filter((entry) => entry.id !== id)
        recompute(s)
      })
    },

    addTrack: (scenarioId) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario || scenario.tracks.length >= MAX_TRACKS) return
        // One track per type: seed the new track with a type the scenario does
        // not already hold, so adding a track never trips the duplicate gate.
        const freeType = nextFreeTrackType(scenario.tracks.map((track) => track.type)) ?? 'fixed'
        const track = blankTrack(scenario.termYears, freeType)
        scenario.tracks.push(track)
        // Calculator parity: a blank new track is funded by moving half of the
        // largest existing track's amount over, keeping the loan total constant.
        if (!track.amountText.trim()) {
          const amounts = splitLargestForNewTrack(
            scenario.tracks.slice(0, -1).map((existing) => parseAmountText(existing.amountText)),
          )
          if (amounts) {
            scenario.tracks.forEach((existing, index) => {
              existing.amountText = displayAmountText(amounts[index])
            })
          }
          // ...and the shared loan from the תמהילים section funds whatever the
          // split above could not: a scenario with no amounts at all gets the
          // loan split equally across its tracks (last one absorbs the
          // remainder), and a mix whose total drifted off the shared loan is
          // snapped back onto it. A mix that already totals the loan is left
          // exactly as the split left it.
          const loan = loanAmount(s)
          if (loan > 0) {
            const total = scenario.tracks.reduce(
              (sum, entry) => sum + parseAmountText(entry.amountText),
              0,
            )
            if (total === 0) {
              const shares = distributeEqually(loan, scenario.tracks.length)
              scenario.tracks.forEach((entry, index) => {
                entry.amountText = displayAmountText(shares[index])
              })
            } else if (total !== loan) {
              snapScenarioTracksToLoan(s, scenario)
            }
          }
        }
        recompute(s)
      })
    },

    removeTrack: (scenarioId, trackId) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario || scenario.tracks.length <= 1) return
        scenario.tracks = scenario.tracks.filter((track) => track.id !== trackId)
        recompute(s)
      })
    },

    updateTrackAmount: (scenarioId, trackId, raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario) return
        const index = scenario.tracks.findIndex((track) => track.id === trackId)
        if (index < 0) return
        const track = scenario.tracks[index]
        // The shared loan pins the mix (one loan for all - the scenarios vary
        // only the mix): editing one track rebalances its siblings in the SAME
        // scenario so that scenario still totals the loan. A single-track
        // scenario has nothing to rebalance against and keeps the typed amount.
        const updated = redistributeTrackAmounts(
          parseAmountText(formatted.text),
          scenario.tracks
            .filter((_, i) => i !== index)
            .map((other) => parseAmountText(other.amountText)),
          loanAmount(s),
        )
        if (updated) {
          let otherIndex = 0
          scenario.tracks.forEach((other, i) => {
            if (i === index) return
            other.amountText = displayAmountText(updated[otherIndex++])
          })
        }
        track.amountText = formatted.text
        track.loanShareMemory = null
        recompute(s)
      })
      return formatted
    },

    commitTrackAmountBlur: (scenarioId, trackId) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario) return
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        const hadAmounts = scenario.tracks.some((entry) => parseAmountText(entry.amountText) > 0)
        track.amountText = formatAmountWithCaret(track.amountText, null).text
        // Calculator parity: the blur snap reconciles the mix to the shared
        // loan. A scenario nobody has entered anything into is left blank -
        // merely focusing and leaving an empty amount field must not conjure a
        // mix out of the loan.
        if (hadAmounts && loanAmount(s) > 0) {
          snapScenarioTracksToLoan(s, scenario)
        }
        recompute(s)
      })
    },

    updateTrackRate: (scenarioId, trackId, raw) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        track.rateText = raw
        track.isAutoRate = false
        recompute(s)
      })
    },

    commitTrackRateBlur: (scenarioId, trackId) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        // A cleared rate would silently compute at 0% - reseed the type's
        // default (mirrors the main calculator's commitTrackRateBlur).
        if (!track.rateText.trim()) {
          track.rateText = defaultRateFor(track.type)
          track.isAutoRate = true
        }
        recompute(s)
      })
    },

    changeTrackType: (scenarioId, trackId, type) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        track.type = type
        // Reseed the default rate unless the user typed a custom one (same
        // rule as the main calculator's applyTrackTypeLogic).
        if (track.rateText.trim() && !track.isAutoRate) {
          recompute(s)
          return
        }
        track.rateText = defaultRateFor(type)
        track.isAutoRate = true
        recompute(s)
      })
    },

    changeTrackMethod: (scenarioId, trackId, method) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        track.method = method
        recompute(s)
      })
    },

    setScenarioTermYears: (scenarioId, years) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario) return
        scenario.termYears = years
        // The slider drives every track's term (same legacy rule).
        scenario.tracks.forEach((track) => {
          track.yearsText = String(years)
        })
        recompute(s)
      })
    },

    setMortgageSum: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.mortgageSumText = formatted.text
        // One loan for all: a typed sum fills/scales EVERY scenario's mix
        // (preset lineups re-allocate exactly, hand-built mixes scale, zeros
        // split) so the columns stay directly comparable.
        s.scenarios.forEach((scenario) => fillScenarioTracksFromLoanInput(s, scenario))
        recompute(s)
      })
      return formatted
    },

    fixScenario: (scenarioId) => {
      set((s) => {
        const index = s.scenarios.findIndex((entry) => entry.id === scenarioId)
        if (index < 0) return
        const scenario = s.scenarios[index]
        const error = s.results[index]?.error
        if (!error) return
        const loan = loanAmount(s)

        if (error === 'variableCap') {
          const fix = autoFixVariableMix(
            scenario.tracks.map((track) => ({
              amount: parseAmountText(track.amountText),
              isVariable: isVariableType(track.type),
            })),
          )
          if (fix.convertedToFixedIndex !== null) {
            const converted = scenario.tracks[fix.convertedToFixedIndex]
            converted.type = 'fixed'
            // Same rule as changeTrackType: keep a custom rate, reseed an auto one.
            if (!converted.rateText.trim() || converted.isAutoRate) {
              converted.rateText = defaultRateFor('fixed')
              converted.isAutoRate = true
            }
          }
          scenario.tracks.forEach((track, trackIndex) => {
            track.amountText = displayAmountText(Math.max(0, fix.amounts[trackIndex]))
          })
          // The trim takes the excess off the variable side. On this page the
          // shared loan is the invariant every column is compared at, so the
          // excess returns to the fixed side instead of leaving the loan.
          if (loan > 0) {
            const total = scenario.tracks.reduce(
              (sum, track) => sum + parseAmountText(track.amountText),
              0,
            )
            const shortfall = loan - total
            if (shortfall > 0) {
              const fundedFixed = scenario.tracks.filter(
                (track) => !isVariableType(track.type) && parseAmountText(track.amountText) > 0,
              )
              if (fundedFixed.length > 0) {
                const target = fundedFixed[fundedFixed.length - 1]
                target.amountText = displayAmountText(
                  parseAmountText(target.amountText) + shortfall,
                )
              } else {
                // No fixed track carries money: split the shortfall across the
                // fixed tracks (autoFixVariableMix always leaves at least one).
                const fixedTracks = scenario.tracks.filter(
                  (track) => !isVariableType(track.type),
                )
                const shares = distributeEqually(shortfall, fixedTracks.length)
                fixedTracks.forEach((track, fixedIndex) => {
                  track.amountText = displayAmountText(shares[fixedIndex])
                })
              }
            }
          }
          // The repaired mix no longer matches the preset that seeded it.
          scenario.activePreset = null
        } else if (error === 'duplicateType') {
          // One track per type: walk the mix and move every repeat onto the
          // first type it does not already hold (reseed the rate, same rule as
          // changeTrackType), so the fix is one click like the variable cap.
          const used = new Set<TrackType>()
          for (const track of scenario.tracks) {
            if (used.has(track.type)) {
              const free = nextFreeTrackType([...used])
              if (!free) break
              track.type = free
              if (!track.rateText.trim() || track.isAutoRate) {
                track.rateText = defaultRateFor(free)
                track.isAutoRate = true
              }
            }
            used.add(track.type)
          }
          scenario.activePreset = null
        } else {
          // 'positive': every track needs a 1..30 year term and a positive
          // amount. Clamp the term, drop zero amounts, then fund whatever is
          // left from the shared loan (the same rule the add-track uses).
          const years = Math.min(
            MAX_YEARS,
            Math.max(1, Math.round(scenario.termYears) || DEFAULT_TERM_YEARS),
          )
          scenario.termYears = years
          scenario.tracks.forEach((track) => {
            const trackYears = Number(track.yearsText)
            if (!Number.isFinite(trackYears) || trackYears < 1 || trackYears > MAX_YEARS) {
              track.yearsText = String(years)
            }
            if (parseAmountText(track.amountText) <= 0) track.amountText = ''
          })
          scenario.activePreset = null
          if (loan > 0) fillScenarioTracksFromLoanInput(s, scenario)
        }
        recompute(s)
      })
    },

    loadScenarioPreset: (scenarioId, presetId) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario || !PRESETS[presetId]) return
        // Calculator parity (loadPreset): allocate at the shared loan, or at
        // the tracks' current total when no loan is derivable. With the shared
        // sum set, picking a mix on a blank scenario prices it right away -
        // the loan is the one typed once for the whole page.
        const existingTotal = scenario.tracks.reduce(
          (sum, track) => sum + parseAmountText(track.amountText),
          0,
        )
        const startingAmount = loanAmount(s) || existingTotal
        const allocated = allocatePreset(presetId, startingAmount, null)
        scenario.tracks = allocated.map((entry) => ({
          id: makeTrackId(),
          type: entry.type,
          amountText: displayAmountText(entry.amount),
          yearsText: String(scenario.termYears),
          rateText: String(entry.rate),
          method: 'spitzer',
          isAutoRate: true,
          loanShareMemory: null,
        }))
        scenario.activePreset = presetId
        recompute(s)
      })
    },

    reset: () => {
      set((s) => {
        s.scenarios = createInitialScenarios()
        s.shared = defaultSharedInputs()
        recompute(s)
      })
    },
  })),
)

// Populate the initial results so the very first render has numbers.
useComparisonStore.setState((s) => {
  recompute(s)
})

/**
 * Seeds the comparison store ONCE from the main calculator's current state:
 * shared buyer inputs (property/capital/income/purpose/fees) and scenario 1
 * from the calculator's track mix; scenario 2 starts blank (the alternative
 * column is the user's to define). Called on
 * navigation from the calculator; entering /compare directly keeps whatever
 * state the comparison already holds.
 */
export function seedFromCalculator(calculator: {
  propertyValueText: string
  capitalText: string
  incomeText: string
  purpose: PropertyPurpose
  realtorPercentText: string
  lawyerPercentText: string
  realtorAmountText: string
  lawyerAmountText: string
  appraiserFeeText: string
  renovationAmountText: string
  otherExpenses: Array<{ label: string; amountText: string; oneTimeAmountText: string }>
  ptiThresholdPercent: number
  termYears: number
  mortgageSumText: string
  activePreset: PresetId | null
  tracks: TrackState[]
  /** אישור עקרוני date for the seeded mix; omitted = no date entered. */
  approvalDateText?: string
}): void {
  useComparisonStore.setState((state) => {
    state.shared = {
      propertyValueText: calculator.propertyValueText,
      capitalText: calculator.capitalText,
      incomeText: calculator.incomeText,
      purpose: calculator.purpose,
      realtorPercentText: calculator.realtorPercentText,
      lawyerPercentText: calculator.lawyerPercentText,
      realtorAmountText: calculator.realtorAmountText,
      lawyerAmountText: calculator.lawyerAmountText,
      appraiserFeeText: calculator.appraiserFeeText,
      renovationAmountText: calculator.renovationAmountText,
      // This page keeps exactly ONE expense row (no add/remove), so the
      // calculator's rows collapse into a single pair by summing their monthly
      // and one-time amounts (the compare pair drops the calculator's name).
      otherExpenses: [
        {
          id: makeExpenseId(),
          monthlyText: sumAmountsText(calculator.otherExpenses.map((e) => e.amountText)),
          oneTimeText: sumAmountsText(calculator.otherExpenses.map((e) => e.oneTimeAmountText)),
        },
      ],
      ptiThresholdPercent: calculator.ptiThresholdPercent,
      // The calculator's sum travels as the ONE shared loan (parity): the mix
      // the user arrived with is scenario 1, and scenario 2 is an alternative
      // mix of the same loan, not an alternative loan.
      mortgageSumText: calculator.mortgageSumText,
      derivedLoanMemory: 0,
    }
    state.scenarios = [
      {
        id: makeScenarioId(),
        label: '',
        tracks: calculator.tracks.map((track) => ({ ...track, id: makeTrackId() })),
        termYears: calculator.termYears,
        activePreset: calculator.activePreset,
        approvalDateText: calculator.approvalDateText ?? '',
      },
      {
        id: makeScenarioId(),
        label: '',
        // Scenario 2 starts blank: scenario 1 already carries the mix the user
        // arrived with, so the alternative column is theirs to build.
        tracks: [blankTrack(calculator.termYears)],
        termYears: calculator.termYears,
        activePreset: null,
        approvalDateText: '',
      },
    ]
    recompute(state)
  })
}

/** Percent input: digits and a single decimal separator, max 2 decimals. */
function sanitizePercentInput(raw: string): string {
  const cleaned = raw
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.')
    .replace(/(\.\d\d)\d+/, '$1')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}
