import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  DEFAULT_TERM_YEARS,
  MAX_HOME_VALUE,
  MAX_TRACKS,
  MAX_YEARS,
  allocatePreset,
  type PropertyPurpose,
} from '@/lib/amortization'
import { constrainYearsText, formatAmountWithCaret, parseAmountText } from '@/lib/format'
import {
  computeScenario,
  type ScenarioResult,
  type SharedBuyerInputs,
} from '@/features/compare/computeScenario'
import type { TrackState } from '@/stores/calculatorStore'

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
  otherMonthly: number
  oneTimeExpenses: number
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

function displayAmountText(amount: number): string {
  return amount > 0 ? Math.round(amount).toLocaleString('en-US') : ''
}

/** Default scenario lineup: the recommended 40/34/26 mix over ₪1M. */
function defaultTracks(): TrackState[] {
  const allocated = allocatePreset('basket4', 1_000_000, null)
  return allocated.map((entry) => ({
    id: makeTrackId(),
    type: entry.type,
    amountText: displayAmountText(entry.amount),
    yearsText: String(DEFAULT_TERM_YEARS),
    rateText: String(entry.rate),
    method: 'spitzer',
    isAutoRate: Boolean(entry.rate),
    loanShareMemory: null,
  }))
}

function createInitialScenarios(): ComparisonScenario[] {
  return [
    { id: makeScenarioId(), label: '', tracks: defaultTracks(), termYears: DEFAULT_TERM_YEARS },
    { id: makeScenarioId(), label: '', tracks: defaultTracks(), termYears: DEFAULT_TERM_YEARS },
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
    otherMonthly: 0,
    oneTimeExpenses: 0,
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
    otherMonthly: shared.otherMonthly,
    oneTimeExpenses: shared.oneTimeExpenses,
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
        recompute(s)
      })
      return { text: cappedText, caret: cappedCaret }
    },

    setCapital: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.shared.capitalText = formatted.text
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

    addScenario: () => {
      set((s) => {
        if (s.scenarios.length >= MAX_TRACKS) return
        s.scenarios.push({
          id: makeScenarioId(),
          label: '',
          // Start empty: the user builds the alternative mix by hand (or
          // duplicates an existing scenario instead).
          tracks: [
            {
              id: makeTrackId(),
              type: 'fixed',
              amountText: '',
              yearsText: String(DEFAULT_TERM_YEARS),
              rateText: '4.5',
              method: 'spitzer',
              isAutoRate: true,
              loanShareMemory: null,
            },
          ],
          termYears: DEFAULT_TERM_YEARS,
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
        scenario.tracks.push({
          id: makeTrackId(),
          type: 'fixed',
          amountText: '',
          yearsText: String(scenario.termYears),
          rateText: '',
          method: 'spitzer',
          isAutoRate: true,
          loanShareMemory: null,
        })
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
        const track = findTrack(s, scenarioId, trackId)
        if (track) track.amountText = formatted.text
        recompute(s)
      })
      return formatted
    },

    commitTrackAmountBlur: (scenarioId, trackId) => {
      set((s) => {
        const track = findTrack(s, scenarioId, trackId)
        if (!track) return
        track.amountText = formatAmountWithCaret(track.amountText, null).text
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
 * from the calculator's track mix, plus a duplicate of it as scenario 2 (the
 * natural "start from my mix, tweak one variable" workflow). Called on
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
  otherExpenses: Array<{ amountText: string; oneTimeAmountText: string }>
  ptiThresholdPercent: number
  termYears: number
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
      otherMonthly: calculator.otherExpenses.reduce(
        (sum, expense) => sum + parseAmountText(expense.amountText),
        0,
      ),
      oneTimeExpenses: calculator.otherExpenses.reduce(
        (sum, expense) => sum + parseAmountText(expense.oneTimeAmountText),
        0,
      ),
      ptiThresholdPercent: calculator.ptiThresholdPercent,
    }
    state.scenarios = [
      {
        id: makeScenarioId(),
        label: '',
        tracks: calculator.tracks.map((track) => ({ ...track, id: makeTrackId() })),
        termYears: calculator.termYears,
      },
      {
        id: makeScenarioId(),
        label: '',
        tracks: calculator.tracks.map((track) => ({ ...track, id: makeTrackId() })),
        termYears: calculator.termYears,
      },
    ]
    recompute(state)
  })
}

function percentOrDefault(text: string, fallback: number): number {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : fallback
}
