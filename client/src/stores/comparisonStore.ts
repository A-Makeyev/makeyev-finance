import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  allocatePreset,
  DEFAULT_TERM_YEARS,
  deriveLoanAmount,
  distributeEqually,
  MAX_HOME_VALUE,
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  PRESETS,
  redistributeTrackAmounts,
  scaleTrackAmounts,
  splitLargestForNewTrack,
  type PresetId,
  type PropertyPurpose,
} from '@/lib/amortization'
import { formatAmountWithCaret, formatGroupedNumber, parseAmountText } from '@/lib/format'
import {
  computeScenario,
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
}

/** One repeatable shared expense row: a recurring monthly amount plus an
    optional one-time amount (the calculator's OtherExpense, compare copy). */
export interface SharedExpense {
  id: string
  label: string
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
  /** Fee profile (seeded from the calculator; priced into every upfront total). */
  realtorPercent: number
  lawyerPercent: number
  appraiserFee: number
  renovations: number
  /** Repeatable expense rows (calculator parity): the monthly amounts fold
      into the payment-to-income check, the one-time amounts join the upfront
      cash total. Sums derive at recompute time - no cached copies. */
  otherExpenses: SharedExpense[]
  ptiThresholdPercent: number
}

export interface ComparisonState {
  scenarios: ComparisonScenario[]
  shared: ComparisonSharedInputs
  results: ScenarioResult[]
}

export interface ComparisonActions {
  setLabel(id: string, label: string): void
  setPropertyValue(raw: string, caret: number | null): { text: string; caret: number | null }
  setCapital(raw: string, caret: number | null): { text: string; caret: number | null }
  setIncome(raw: string, caret: number | null): { text: string; caret: number | null }
  /** Blur commits - the calculator's setPropertyBlur/setCapitalBlur/setIncomeBlur. */
  commitPropertyValueBlur(): void
  commitCapitalBlur(): void
  commitIncomeBlur(): void
  setPurpose(purpose: PropertyPurpose): void
  addSharedExpense(): void
  updateSharedExpenseLabel(id: string, label: string): void
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
  loadScenarioPreset(scenarioId: string, presetId: PresetId): void
  reset(): void
}

export type ComparisonStore = ComparisonState & ComparisonActions

let nextScenarioId = 1
let nextTrackId = 1

function makeScenarioId(): string {
  return `scenario-${nextScenarioId++}`
}

function makeTrackId(): string {
  return `ctrack-${nextTrackId++}`
}

let nextExpenseId = 1

function makeExpenseId(): string {
  return `cexpense-${nextExpenseId++}`
}

/** A blank shared expense row - the calculator opens with one as well. */
function blankExpense(): SharedExpense {
  return { id: makeExpenseId(), label: '', monthlyText: '', oneTimeText: '' }
}

/**
 * A blank scenario's opening track: no amount, the given term, and the track
 * type's default rate. The rate IS seeded - a blank rate would price a 0% loan
 * the moment an amount is typed, which is a wrong number rather than a missing
 * one (same rule as commitTrackRateBlur). Everything else is the user's to
 * enter.
 */
function blankTrack(termYears: number): TrackState {
  return {
    id: makeTrackId(),
    type: 'fixed',
    amountText: '',
    yearsText: String(termYears),
    rateText: defaultRateFor('fixed'),
    method: 'spitzer',
    isAutoRate: true,
    loanShareMemory: null,
  }
}

/**
 * The opening pair: scenario 1 (תרחיש 1) starts with the calculator's own
 * opening data - the ₪1,000,000 recommended mix (basket4) at the default term,
 * via the very same createInitialTracks the main calculator uses, so the
 * comparison's first column matches what a user sees on the calculator before
 * touching anything. Scenario 2 opens blank: it is the alternative the user
 * builds by hand (or by duplicating scenario 1).
 */
function createInitialScenarios(): ComparisonScenario[] {
  return [
    {
      id: makeScenarioId(),
      label: '',
      tracks: createInitialTracks(null),
      termYears: DEFAULT_TERM_YEARS,
      activePreset: 'basket4',
    },
    {
      id: makeScenarioId(),
      label: '',
      tracks: [blankTrack(DEFAULT_TERM_YEARS)],
      termYears: DEFAULT_TERM_YEARS,
      activePreset: null,
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
    realtorPercent: 2,
    lawyerPercent: 0.5,
    appraiserFee: 0,
    renovations: 0,
    otherExpenses: [blankExpense()],
    ptiThresholdPercent: 33,
  }
}

function toComputeInputs(shared: ComparisonSharedInputs): SharedBuyerInputs {
  return {
    propertyValueText: shared.propertyValueText,
    capitalText: shared.capitalText,
    incomeText: shared.incomeText,
    purpose: shared.purpose,
    realtorPercent: shared.realtorPercent,
    lawyerPercent: shared.lawyerPercent,
    appraiserFee: shared.appraiserFee,
    renovations: shared.renovations,
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

/** Capital left for the loan after renovations eat into it (calculator parity). */
function capitalForLoan(s: ComparisonState): number {
  return Math.max(0, parseAmountText(s.shared.capitalText) - s.shared.renovations)
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

    setLabel: (id, label) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === id)
        if (scenario) scenario.label = label
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

    addSharedExpense: () => {
      set((s) => {
        if (s.shared.otherExpenses.length >= MAX_OTHER_EXPENSES) return
        s.shared.otherExpenses.push(blankExpense())
        recompute(s)
      })
    },

    updateSharedExpenseLabel: (id, label) => {
      set((s) => {
        const expense = s.shared.otherExpenses.find((entry) => entry.id === id)
        if (expense) expense.label = label
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
        recompute(s)
      })
      return formatted
    },

    removeSharedExpense: (id) => {
      set((s) => {
        s.shared.otherExpenses = s.shared.otherExpenses.filter((entry) => entry.id !== id)
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
        const track = blankTrack(scenario.termYears)
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
  appraiserFeeText: string
  renovationAmountText: string
  otherExpenses: Array<{ label: string; amountText: string; oneTimeAmountText: string }>
  ptiThresholdPercent: number
  termYears: number
  mortgageSumText: string
  activePreset: PresetId | null
  tracks: TrackState[]
}): void {
  useComparisonStore.setState((state) => {
    state.shared = {
      propertyValueText: calculator.propertyValueText,
      capitalText: calculator.capitalText,
      incomeText: calculator.incomeText,
      purpose: calculator.purpose,
      realtorPercent: percentOrDefault(calculator.realtorPercentText, 2),
      lawyerPercent: percentOrDefault(calculator.lawyerPercentText, 0.5),
      appraiserFee:
        calculator.appraiserFeeText.trim() === ''
          ? 0
          : parseAmountText(calculator.appraiserFeeText),
      renovations: parseAmountText(calculator.renovationAmountText),
      otherExpenses: calculator.otherExpenses.map((expense) => ({
        id: makeExpenseId(),
        label: expense.label,
        monthlyText: expense.amountText,
        oneTimeText: expense.oneTimeAmountText,
      })),
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
      },
      {
        id: makeScenarioId(),
        label: '',
        // Scenario 2 starts blank: scenario 1 already carries the mix the user
        // arrived with, so the alternative column is theirs to build.
        tracks: [blankTrack(calculator.termYears)],
        termYears: calculator.termYears,
        activePreset: null,
      },
    ]
    recompute(state)
  })
}

function percentOrDefault(text: string, fallback: number): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : fallback
}
