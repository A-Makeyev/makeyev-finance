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
  MAX_YEARS,
  PRESETS,
  redistributeTrackAmounts,
  scaleTrackAmounts,
  splitLargestForNewTrack,
  type PresetId,
  type PropertyPurpose,
} from '@/lib/amortization'
import {
  constrainYearsText,
  formatAmountWithCaret,
  formatGroupedNumber,
  parseAmountText,
} from '@/lib/format'
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

/** One comparison scenario: a labeled track mix evaluated against shared inputs. */
export interface ComparisonScenario {
  id: string
  /** User-editable, e.g. "תמהיל שמרני". */
  label: string
  tracks: TrackState[]
  termYears: number
  /** סכום המשכנתא display text - the loan-defining input (calculator parity). */
  mortgageSumText: string
  /** Last chosen preset mix: highlights its button and keeps re-allocation exact. */
  activePreset: PresetId | null
  /** Loan memory for the sum-field mirror when the property is cleared. */
  derivedLoanMemory: number
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
  updateTrackYears(scenarioId: string, trackId: string, raw: string): void
  commitTrackYearsBlur(scenarioId: string, trackId: string): void
  updateTrackRate(scenarioId: string, trackId: string, raw: string): void
  commitTrackRateBlur(scenarioId: string, trackId: string): void
  changeTrackType(scenarioId: string, trackId: string, type: TrackState['type']): void
  changeTrackMethod(scenarioId: string, trackId: string, method: TrackState['method']): void
  setScenarioTermYears(scenarioId: string, years: number): void
  setScenarioMortgageSum(
    scenarioId: string,
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
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
      // The sum field starts exactly like the calculator's: ₪1,000,000, the
      // opening mix's total (the calculator's startingAmountText prefill).
      mortgageSumText: '1,000,000',
      activePreset: 'basket4',
      derivedLoanMemory: 0,
    },
    {
      id: makeScenarioId(),
      label: '',
      tracks: [blankTrack(DEFAULT_TERM_YEARS)],
      termYears: DEFAULT_TERM_YEARS,
      mortgageSumText: '',
      activePreset: null,
      derivedLoanMemory: 0,
    },
  ]
}

function defaultSharedInputs(): ComparisonSharedInputs {
  return {
    propertyValueText: '',
    capitalText: '',
    incomeText: '',
    purpose: 'first',
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
 * The scenario's loan, exactly like the calculator's getLoanAmount: with a
 * property value the loan is property - capital (and the sum input follows
 * and locks); without one the typed mortgage sum defines the loan.
 */
function scenarioLoanAmount(s: ComparisonState, scenario: ComparisonScenario): number {
  return deriveLoanAmount(
    parseAmountText(s.shared.propertyValueText),
    parseAmountText(scenario.mortgageSumText),
    capitalForLoan(s),
  )
}

/** סכום המשכנתא always mirrors the tracks' sum (calculator parity). */
function syncMortgageSumFromTracks(_s: ComparisonState, scenario: ComparisonScenario): void {
  const total = scenario.tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  scenario.mortgageSumText = total > 0 ? formatGroupedNumber(Math.round(total)) : ''
}

/** Pure scaleTrackAmounts applied to one scenario's tracks. */
function scaleScenarioTracks(s: ComparisonState, scenario: ComparisonScenario): void {
  const currentAmounts = scenario.tracks.map((track) => parseAmountText(track.amountText))
  const previousMemory = scenario.tracks.map((track) => track.loanShareMemory)
  const result = scaleTrackAmounts(currentAmounts, previousMemory, scenarioLoanAmount(s, scenario))
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
    const loanAmount = scenarioLoanAmount(s, scenario)
    const amounts = distributeEqually(loanAmount, scenario.tracks.length)
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
  const loanAmount = scenarioLoanAmount(s, scenario)
  const amounts = scenario.tracks.map((track) => parseAmountText(track.amountText))
  const preset = scenario.activePreset ? PRESETS[scenario.activePreset] : null
  const lineupMatches =
    preset !== null &&
    preset.length === scenario.tracks.length &&
    preset.every((definition, index) => definition.type === scenario.tracks[index].type)
  if (
    loanAmount > 0 &&
    lineupMatches &&
    (amounts.some((amount) => amount === 0) || amountsMirrorPreset(scenario))
  ) {
    const allocated = allocatePreset(scenario.activePreset!, loanAmount, null)
    scenario.tracks.forEach((track, index) => {
      track.amountText = displayAmountText(allocated[index].amount)
    })
    return
  }
  snapScenarioTracksToLoan(s, scenario)
}

/**
 * The sum field follows property - capital while a property is set, and
 * restores the (loan + capital) figure when the property is cleared - the
 * calculator's syncStartingFromProperty, per scenario.
 */
function syncMortgageSumFromProperty(s: ComparisonState, scenario: ComparisonScenario): void {
  const property = parseAmountText(s.shared.propertyValueText)
  if (property > 0) {
    const loan = scenarioLoanAmount(s, scenario)
    scenario.derivedLoanMemory = loan
    scenario.mortgageSumText = loan > 0 ? formatGroupedNumber(loan) : ''
  } else if (scenario.derivedLoanMemory > 0) {
    const gross = Math.round(scenario.derivedLoanMemory + capitalForLoan(s))
    scenario.mortgageSumText = gross > 0 ? formatGroupedNumber(gross) : ''
    scenario.derivedLoanMemory = 0
  }
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
        // Calculator parity: the property re-derives every scenario's loan -
        // the sum field follows (property - capital) and the tracks fill/scale.
        s.scenarios.forEach((scenario) => {
          syncMortgageSumFromProperty(s, scenario)
          fillScenarioTracksFromLoanInput(s, scenario)
        })
        recompute(s)
      })
      return { text: cappedText, caret: cappedCaret }
    },

    setCapital: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.capitalText = formatted.text
        // Calculator parity: the capital re-derives every scenario's loan.
        s.scenarios.forEach((scenario) => {
          syncMortgageSumFromProperty(s, scenario)
          fillScenarioTracksFromLoanInput(s, scenario)
        })
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
          mortgageSumText: '',
          activePreset: null,
          derivedLoanMemory: 0,
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
          mortgageSumText: source.mortgageSumText,
          activePreset: source.activePreset,
          derivedLoanMemory: source.derivedLoanMemory,
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
            syncMortgageSumFromTracks(s, scenario)
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
        // Calculator parity: only when a property value pins the loan can the
        // other tracks be re-balanced live against it. Without a property the
        // loan is derived FROM the tracks and balancing would fight the input.
        if (parseAmountText(s.shared.propertyValueText) > 0) {
          const updated = redistributeTrackAmounts(
            parseAmountText(formatted.text),
            scenario.tracks
              .filter((_, i) => i !== index)
              .map((other) => parseAmountText(other.amountText)),
            scenarioLoanAmount(s, scenario),
          )
          if (updated) {
            let otherIndex = 0
            scenario.tracks.forEach((other, i) => {
              if (i === index) return
              other.amountText = displayAmountText(updated[otherIndex++])
            })
          }
        }
        track.amountText = formatted.text
        track.loanShareMemory = null
        syncMortgageSumFromTracks(s, scenario)
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
        track.amountText = formatAmountWithCaret(track.amountText, null).text
        // Calculator parity: the blur snap reconciles the tracks to the loan
        // (only meaningful while a property value pins it).
        if (parseAmountText(s.shared.propertyValueText) > 0) {
          snapScenarioTracksToLoan(s, scenario)
        }
        recompute(s)
      })
    },

    updateTrackYears: (scenarioId, trackId, raw) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        // Same clamp contract as the main calculator (live digits-only + max).
        track.yearsText = constrainYearsText(raw, MAX_YEARS)
        recompute(s)
      })
    },

    commitTrackYearsBlur: (scenarioId, trackId) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        track.yearsText = constrainYearsText(track.yearsText, MAX_YEARS)
        if (!track.yearsText) track.yearsText = '1'
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

    setScenarioMortgageSum: (scenarioId, raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario) return
        scenario.mortgageSumText = formatted.text
        // Calculator parity: a typed loan fills/scales the tracks (preset
        // lineups re-allocate exactly, hand-built mixes scale, zeros split).
        fillScenarioTracksFromLoanInput(s, scenario)
        recompute(s)
      })
      return formatted
    },

    loadScenarioPreset: (scenarioId, presetId) => {
      set((s) => {
        const scenario = s.scenarios.find((entry) => entry.id === scenarioId)
        if (!scenario || !PRESETS[presetId]) return
        // Calculator parity (loadPreset): allocate at the loan, or at the
        // tracks' current total when no loan is derivable. A fully blank
        // scenario gets the mix SHAPE (types + default rates, zero amounts)
        // and the sum input allocates it once a loan is typed.
        const existingTotal = scenario.tracks.reduce(
          (sum, track) => sum + parseAmountText(track.amountText),
          0,
        )
        const startingAmount = scenarioLoanAmount(s, scenario) || existingTotal
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
    }
    state.scenarios = [
      {
        id: makeScenarioId(),
        label: '',
        tracks: calculator.tracks.map((track) => ({ ...track, id: makeTrackId() })),
        termYears: calculator.termYears,
        mortgageSumText: calculator.mortgageSumText,
        activePreset: calculator.activePreset,
        derivedLoanMemory: 0,
      },
      {
        id: makeScenarioId(),
        label: '',
        // Scenario 2 starts blank: scenario 1 already carries the mix the user
        // arrived with, so the alternative column is theirs to build.
        tracks: [blankTrack(calculator.termYears)],
        termYears: calculator.termYears,
        mortgageSumText: '',
        activePreset: null,
        derivedLoanMemory: 0,
      },
    ]
    recompute(state)
  })
}

function percentOrDefault(text: string, fallback: number): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : fallback
}
