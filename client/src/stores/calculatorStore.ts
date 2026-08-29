import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  MAX_YEARS,
  DEFAULT_TERM_YEARS,
  FALLBACK_INFLATION,
  FALLBACK_PRIME_RATE,
  DEFAULT_RATES_BY_TYPE,
  PRESETS,
  allocatePreset,
  assessDti,
  assessEquity,
  assessLtv,
  autoFixVariableMix,
  combineSchedules,
  computeTrackResult,
  deriveLoanAmount,
  distributeEqually,
  EMPTY_TOTALS,
  estimateClosingCosts,
  isVariableType,
  resolvePaymentLabel,
  scaleTrackAmounts,
  sumTotals,
  suggestedEquity,
  suggestedMinimumIncome,
  variableShareExceeded,
  type AmortizationMethod,
  type ClosingCostsEstimate,
  type CombinedScheduleRow,
  type DtiWarning,
  type EquityAssessment,
  type LtvWarning,
  type PaymentLabelResolution,
  type PresetId,
  type PropertyPurpose,
  type TotalsSummary,
  type TrackResult,
  type TrackType,
} from '@/lib/amortization'
import {
  constrainYearsText,
  formatAmountWithCaret,
  formatGroupedNumber,
  parseAmountText,
} from '@/lib/format'

export interface TrackState {
  id: string
  type: TrackType
  /** Formatted display text ('' allowed) — math parses from this text exactly like the legacy DOM. */
  amountText: string
  yearsText: string
  rateText: string
  method: AmortizationMethod
  /** Legacy dataset.autoRate — live-rate seeding is allowed until user edits. */
  isAutoRate: boolean
  /** Legacy dataset.loanShare memory for proportional rebalancing. */
  loanShareMemory: number | null
}

export type CalculationError = { kind: 'term' } | { kind: 'positive' } | { kind: 'variableCap' }

export interface CalculatorSnapshot {
  totals: TotalsSummary
  annualFirstYearPayment: number
  scheduleRows: CombinedScheduleRow[]
  scheduleYearCount: number
  maxEnteredYears: number
  summaryTypes: TrackType[]
  enteredCount: number
  isEmpty: boolean
  /** null = keep showing whatever the label area currently shows (legacy behaviour). */
  highestLabel: PaymentLabelResolution | null
  equity: EquityAssessment | null
  ltv: LtvWarning | null
  dti: DtiWarning | null
  incomePlaceholder: number | null
  /** Suggested required initial equity (הון עצמי) for the current purpose. */
  suggestedEquity: number | null
  /** Entered equity is positive but below the required amount. */
  equityShortfall: boolean
  /** Rough buyer-side closing costs (side costs + purchase tax) estimate. */
  closingCosts: ClosingCostsEstimate | null
}

export interface AddTrackValues {
  type?: TrackType
  amount?: number | ''
  years?: number
  rate?: number | string | ''
}

let nextTrackId = 1

function makeTrackId(): string {
  return `track-${nextTrackId++}`
}

function displayAmountText(amount: number): string {
  return amount > 0 ? Math.round(amount).toLocaleString('en-US') : ''
}

function trackFromValues(
  values: AddTrackValues,
  selectedYears: number,
  primeRate: number | null,
): TrackState {
  const type = values.type ?? 'fixed'
  let rateValue = values.rate === undefined ? '' : String(values.rate)
  if (values.type === 'prime' && !rateValue && primeRate) rateValue = String(primeRate)
  const displayAmount =
    values.amount === undefined || values.amount === ''
      ? ''
      : formatGroupedNumber(Number(values.amount))
  return {
    id: makeTrackId(),
    type,
    amountText: displayAmount,
    yearsText: String(values.years ?? selectedYears),
    rateText: rateValue,
    method: 'spitzer',
    isAutoRate: Boolean(rateValue),
    loanShareMemory: null,
  }
}

interface CalculatorData {
  startingAmountText: string
  startingNoNeed: boolean
  derivedLoanMemory: number
  termYears: number
  propertyValueText: string
  capitalText: string
  incomeText: string
  purpose: PropertyPurpose
  tracks: TrackState[]
  activePreset: PresetId | null
  startingPointDirty: boolean
  scheduleExpanded: boolean
  primeRate: number | null
  cpiAnnualChange: number | null
}

export interface CalculatorState extends CalculatorData {
  error: CalculationError | null
  flaggedTrackIds: string[]
  snapshot: CalculatorSnapshot
}

export interface CalculatorActions {
  setStartingAmount(raw: string, caret: number | null): { text: string; caret: number | null }
  setTermYears(years: number): void
  setPropertyValue(raw: string, caret: number | null): { text: string; caret: number | null }
  setCapital(raw: string, caret: number | null): { text: string; caret: number | null }
  setIncome(raw: string, caret: number | null): { text: string; caret: number | null }
  setPropertyBlur(): void
  setCapitalBlur(): void
  setIncomeBlur(): void
  setPurpose(purpose: PropertyPurpose): void
  addTrack(values?: AddTrackValues): void
  removeTrack(id: string): void
  updateTrackAmount(
    id: string,
    raw: string,
    caret: number | null,
  ): { text: string; caret: number | null }
  commitTrackAmountBlur(id: string): void
  updateTrackYears(id: string, raw: string): string
  commitTrackYearsBlur(id: string): void
  updateTrackRate(id: string, raw: string): void
  changeTrackType(id: string, type: TrackType): void
  changeTrackMethod(id: string, method: AmortizationMethod): void
  loadPreset(presetId: PresetId): void
  autofixMix(): void
  submit(): void
  toggleScheduleExpanded(): void
  reset(): void
  applyPrimeRate(rate: number): void
  setCpiAnnualChange(annualChange: number): void
}

export type CalculatorStore = CalculatorState & CalculatorActions

const INITIAL_SNAPSHOT: CalculatorSnapshot = {
  totals: EMPTY_TOTALS,
  annualFirstYearPayment: 0,
  scheduleRows: [],
  scheduleYearCount: 0,
  maxEnteredYears: 30,
  summaryTypes: [],
  enteredCount: 0,
  isEmpty: true,
  highestLabel: null,
  equity: null,
  ltv: null,
  dti: null,
  incomePlaceholder: null,
  suggestedEquity: null,
  equityShortfall: false,
  closingCosts: null,
}

// ---------------------------------------------------------------------------
// Derived helpers operating on draft state (mirrors legacy mutation order)
// ---------------------------------------------------------------------------

function getLoanAmount(s: CalculatorData): number {
  return deriveLoanAmount(
    parseAmountText(s.propertyValueText),
    parseAmountText(s.startingAmountText),
    parseAmountText(s.capitalText),
  )
}

/** Legacy syncStartingFromProperty (calculator.js:111-128). */
function syncStartingFromProperty(s: CalculatorData): void {
  const property = parseAmountText(s.propertyValueText)
  if (property > 0) {
    const loan = getLoanAmount(s)
    s.derivedLoanMemory = loan
    if (loan > 0) {
      s.startingAmountText = formatGroupedNumber(loan)
      s.startingNoNeed = false
    } else {
      s.startingAmountText = ''
      s.startingNoNeed = true
    }
  } else {
    s.startingNoNeed = false
    if (s.derivedLoanMemory > 0) {
      const gross = Math.round(s.derivedLoanMemory + parseAmountText(s.capitalText))
      s.startingAmountText = gross > 0 ? formatGroupedNumber(gross) : ''
      s.derivedLoanMemory = 0
    } else if (/\D/.test(s.startingAmountText.replace(/[,\s]/g, ''))) {
      s.startingAmountText = ''
    }
  }
}

/** Legacy scaleTrackAmounts (calculator.js:138-167). */
function scaleTracks(s: CalculatorData): void {
  if (!s.tracks.length) return
  const currentAmounts = s.tracks.map((track) => parseAmountText(track.amountText))
  const previousMemory = s.tracks.map((track) => track.loanShareMemory)
  const result = scaleTrackAmounts(currentAmounts, previousMemory, getLoanAmount(s))
  if (!result) return
  s.tracks.forEach((track, index) => {
    track.amountText = displayAmountText(result.amounts[index])
    track.loanShareMemory = result.shareMemory[index]
  })
}

/** Legacy syncStartingAmountFromTracks (calculator.js:169-174). */
function syncStartingAmountFromTracks(s: CalculatorData): void {
  if (parseAmountText(s.propertyValueText) > 0) return
  const total = s.tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  const gross = total + parseAmountText(s.capitalText)
  s.startingAmountText = gross > 0 ? formatGroupedNumber(Math.round(gross)) : ''
}

/** Legacy snapTracksToLoan (calculator.js:226-242). */
function snapTracksToLoan(s: CalculatorData): void {
  const total = s.tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  if (total) {
    scaleTracks(s)
    return
  }
  const loanAmount = getLoanAmount(s)
  const amounts = distributeEqually(loanAmount, s.tracks.length)
  if (!amounts.length) return
  s.tracks.forEach((track, index) => {
    track.amountText = displayAmountText(amounts[index])
  })
}

/** Legacy applySelectedYears — slider drives every track's term. */
function applySelectedYears(s: CalculatorData): void {
  s.tracks.forEach((track) => {
    track.yearsText = String(s.termYears)
  })
}

/** Legacy syncTermSliderFromTracks (calculator.js:214-224) — slider follows max track term. */
function syncTermYearsFromTracks(s: CalculatorData): void {
  const yearValues = s.tracks
    .map((track) => Number(track.yearsText))
    .filter((value) => Number.isFinite(value) && value >= 1)
  if (!yearValues.length) return
  const maxYears = Math.min(MAX_YEARS, Math.max(...yearValues))
  if (maxYears !== s.termYears) s.termYears = maxYears
}

/**
 * Legacy applyTrackTypeLogic (calculator.js:299-310): seeds the default/live
 * rate unless the user typed a custom one (autoRate cleared on edit).
 */
function applyTrackTypeLogic(s: CalculatorData, track: TrackState, type: TrackType): void {
  if (track.rateText.trim() && !track.isAutoRate) return
  const rate = type === 'prime' ? (s.primeRate ?? FALLBACK_PRIME_RATE) : DEFAULT_RATES_BY_TYPE[type]
  if (Number.isFinite(rate)) {
    track.rateText = String(rate)
    track.isAutoRate = true
  }
}

/** Core recalculation — a faithful port of legacy calculate() (calculator.js:526-644). */
function recalculate(s: CalculatorState): void {
  const property = parseAmountText(s.propertyValueText)
  const capital = parseAmountText(s.capitalText)
  const income = parseAmountText(s.incomeText)

  const invalidTerm = s.tracks.some((track) => {
    const years = Number(track.yearsText)
    return !years || years < 1 || years > MAX_YEARS
  })
  if (invalidTerm) {
    s.error = { kind: 'term' }
    return
  }

  const inflation = s.cpiAnnualChange ?? FALLBACK_INFLATION
  const results: Array<TrackResult | null> = s.tracks.map((track) =>
    computeTrackResult({
      principal: parseAmountText(track.amountText),
      years: Number(track.yearsText) || 0,
      annualRatePercent: Number(track.rateText) || 0,
      type: track.type,
      method: track.method,
      annualInflation: inflation,
    }),
  )

  s.flaggedTrackIds = []

  const enteredIndexes = s.tracks
    .map((_, index) => index)
    .filter((index) => s.tracks[index].amountText.trim() !== '')

  if (!enteredIndexes.length) {
    const prev = s.snapshot
    s.error = null
    const suggested = suggestedEquity(property, 0, capital, s.purpose)
    s.snapshot = {
      totals: EMPTY_TOTALS,
      annualFirstYearPayment: 0,
      scheduleRows: [],
      scheduleYearCount: 0,
      maxEnteredYears: prev.maxEnteredYears,
      summaryTypes: [],
      enteredCount: 0,
      isEmpty: true,
      highestLabel: prev.highestLabel,
      equity: assessEquity(capital, property, 0, s.purpose),
      ltv: assessLtv(0, property, capital, s.purpose),
      dti: assessDti(0, income),
      incomePlaceholder: prev.incomePlaceholder,
      suggestedEquity: suggested,
      equityShortfall: capital > 0 && suggested !== null && suggested > capital,
      closingCosts: estimateClosingCosts(property, 0, capital, s.purpose),
    }
    return
  }

  const enteredResults = enteredIndexes.map((index) => results[index])
  if (enteredResults.some((result) => !result)) {
    s.error = { kind: 'positive' }
    return
  }

  const validResults = enteredResults.filter(Boolean) as TrackResult[]
  const totalPrincipal = validResults.reduce((sum, result) => sum + result.principal, 0)
  const variablePrincipal = validResults
    .filter((result) => result.isVariable)
    .reduce((sum, result) => sum + result.principal, 0)

  if (variableShareExceeded(totalPrincipal, variablePrincipal)) {
    s.flaggedTrackIds = s.tracks
      .map((track, index) => ({ track, result: results[index] }))
      .filter(({ result }) => result && result.isVariable && validResults.includes(result))
      .map(({ track }) => track.id)
    s.error = { kind: 'variableCap' }
    return
  }

  s.error = null

  const totals = sumTotals(validResults)
  const combinedRows = combineSchedules(validResults)
  const firstMonthPayment = totals.firstPayment
  const suggested = suggestedEquity(property, totalPrincipal, capital, s.purpose)

  s.snapshot = {
    totals,
    annualFirstYearPayment: combinedRows[0]?.paid ?? 0,
    scheduleRows: combinedRows,
    scheduleYearCount: combinedRows.length,
    maxEnteredYears: Math.max(...validResults.map((result) => result.years)),
    summaryTypes: validResults.map((result) => result.type),
    enteredCount: validResults.length,
    isEmpty: false,
    highestLabel: resolvePaymentLabel(validResults),
    equity: assessEquity(capital, property, totalPrincipal, s.purpose),
    ltv: assessLtv(totalPrincipal, property, capital, s.purpose),
    dti: assessDti(firstMonthPayment, income),
    incomePlaceholder:
      firstMonthPayment > 0
        ? suggestedMinimumIncome(firstMonthPayment)
        : s.snapshot.incomePlaceholder,
    suggestedEquity: suggested,
    equityShortfall: capital > 0 && suggested !== null && suggested > capital,
    closingCosts: estimateClosingCosts(property, totalPrincipal, capital, s.purpose),
  }
}

function createInitialTracks(primeRate: number | null): TrackState[] {
  const allocated = allocatePreset('basket1', 1_000_000, primeRate)
  return allocated.map((entry) =>
    trackFromValues(
      { type: entry.type, amount: entry.amount, years: DEFAULT_TERM_YEARS, rate: entry.rate },
      DEFAULT_TERM_YEARS,
      primeRate,
    ),
  )
}

const initialData: CalculatorData = {
  startingAmountText: '1,000,000',
  startingNoNeed: false,
  derivedLoanMemory: 0,
  termYears: DEFAULT_TERM_YEARS,
  propertyValueText: '',
  capitalText: '',
  incomeText: '',
  purpose: 'first',
  tracks: createInitialTracks(null),
  activePreset: 'basket1',
  startingPointDirty: false,
  scheduleExpanded: false,
  primeRate: null,
  cpiAnnualChange: null,
}

function createInitialState(): CalculatorState {
  const state: CalculatorState = {
    ...initialData,
    tracks: [],
    activePreset: null,
    error: null,
    flaggedTrackIds: [],
    snapshot: INITIAL_SNAPSHOT,
  }
  state.tracks = createInitialTracks(null)
  state.activePreset = 'basket1'
  recalculate(state)
  return state
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCalculatorStore = create<CalculatorStore>()(
  immer((set) => ({
    ...createInitialState(),

    setStartingAmount: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.startingAmountText = formatted.text
        s.startingNoNeed = false
        s.startingPointDirty = true
        scaleTracks(s)
        recalculate(s)
      })
      return formatted
    },

    setTermYears: (years) => {
      set((s) => {
        s.termYears = years
        s.startingPointDirty = true
        applySelectedYears(s)
        recalculate(s)
      })
    },

    setPropertyValue: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.propertyValueText = formatted.text
        syncStartingFromProperty(s)
        scaleTracks(s)
        recalculate(s)
      })
      return formatted
    },

    setCapital: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.capitalText = formatted.text
        syncStartingFromProperty(s)
        scaleTracks(s)
        recalculate(s)
      })
      return formatted
    },

    setIncome: (raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        s.incomeText = formatted.text
        recalculate(s)
      })
      return formatted
    },

    setPropertyBlur: () => {
      set((s) => {
        s.propertyValueText = formatAmountWithCaret(s.propertyValueText, null).text
      })
    },

    setCapitalBlur: () => {
      set((s) => {
        s.capitalText = formatAmountWithCaret(s.capitalText, null).text
      })
    },

    setIncomeBlur: () => {
      set((s) => {
        s.incomeText = formatAmountWithCaret(s.incomeText, null).text
      })
    },

    setPurpose: (purpose) => {
      set((s) => {
        s.purpose = purpose
        recalculate(s)
      })
    },

    addTrack: (values) => {
      set((s) => {
        if (s.tracks.length >= 3) return
        s.tracks.push(trackFromValues(values ?? { years: s.termYears }, s.termYears, s.primeRate))
        recalculate(s)
      })
    },

    removeTrack: (id) => {
      set((s) => {
        if (s.tracks.length <= 1) return
        s.tracks = s.tracks.filter((track) => track.id !== id)
        recalculate(s)
      })
    },

    updateTrackAmount: (id, raw, caret) => {
      const formatted = formatAmountWithCaret(raw, caret)
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.amountText = formatted.text
        track.loanShareMemory = null
        syncStartingAmountFromTracks(s)
        recalculate(s)
      })
      return formatted
    },

    commitTrackAmountBlur: (id) => {
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.amountText = formatAmountWithCaret(track.amountText, null).text
        if (parseAmountText(s.propertyValueText) > 0) snapTracksToLoan(s)
        recalculate(s)
      })
    },

    updateTrackYears: (_id, raw) => constrainYearsText(raw, MAX_YEARS),

    commitTrackYearsBlur: (id) => {
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.yearsText = constrainYearsText(track.yearsText, MAX_YEARS)
        if (!track.yearsText) track.yearsText = '1'
        syncTermYearsFromTracks(s)
        recalculate(s)
      })
    },

    updateTrackRate: (id, raw) => {
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.rateText = raw
        track.isAutoRate = false
        recalculate(s)
      })
    },

    changeTrackType: (id, type) => {
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.type = type
        applyTrackTypeLogic(s, track, type)
        recalculate(s)
      })
    },

    changeTrackMethod: (id, method) => {
      set((s) => {
        const track = s.tracks.find((t) => t.id === id)
        if (!track) return
        track.method = method
        recalculate(s)
      })
    },

    loadPreset: (presetId) => {
      set((s) => {
        const preset = PRESETS[presetId]
        if (!preset) return
        const existingTotal = s.tracks.reduce(
          (sum, track) => sum + parseAmountText(track.amountText),
          0,
        )
        const startingAmount = getLoanAmount(s) || existingTotal
        const allocated = allocatePreset(presetId, startingAmount, s.primeRate)
        s.tracks = allocated.map((entry) =>
          trackFromValues(
            { type: entry.type, amount: entry.amount, years: s.termYears, rate: entry.rate },
            s.termYears,
            s.primeRate,
          ),
        )
        s.activePreset = presetId
        s.startingPointDirty = false
        recalculate(s)
      })
    },

    autofixMix: () => {
      set((s) => {
        const inputs = s.tracks.map((track) => ({
          amount: parseAmountText(track.amountText),
          isVariable: isVariableType(track.type),
        }))
        const result = autoFixVariableMix(inputs)
        if (result.convertedToFixedIndex !== null) {
          const track = s.tracks[result.convertedToFixedIndex]
          track.type = 'fixed'
          applyTrackTypeLogic(s, track, 'fixed')
        }
        const total = inputs.reduce((sum, item) => sum + item.amount, 0)
        const varTotal = inputs.reduce((sum, item) => sum + (item.isVariable ? item.amount : 0), 0)
        const rebalanced = total > 0 && !(varTotal / total <= 2 / 3 + 0.0001)
        if (rebalanced) {
          s.tracks.forEach((track, index) => {
            track.amountText = displayAmountText(Math.max(0, result.amounts[index]))
          })
        }
        recalculate(s)
      })
    },

    submit: () => {
      set((s) => {
        if (s.activePreset && s.startingPointDirty) {
          // replicate: reload the active preset with the new parameters
          const preset = PRESETS[s.activePreset]
          if (preset) {
            const existingTotal = s.tracks.reduce(
              (sum, track) => sum + parseAmountText(track.amountText),
              0,
            )
            const startingAmount = getLoanAmount(s) || existingTotal
            const allocated = allocatePreset(s.activePreset, startingAmount, s.primeRate)
            s.tracks = allocated.map((entry) =>
              trackFromValues(
                { type: entry.type, amount: entry.amount, years: s.termYears, rate: entry.rate },
                s.termYears,
                s.primeRate,
              ),
            )
            s.startingPointDirty = false
          }
        } else if (s.startingPointDirty) {
          scaleTracks(s)
          applySelectedYears(s)
          s.startingPointDirty = false
        }
        recalculate(s)
      })
    },

    toggleScheduleExpanded: () => {
      set((s) => {
        s.scheduleExpanded = !s.scheduleExpanded
        recalculate(s)
      })
    },

    reset: () => {
      set((s) => {
        s.tracks = []
        s.startingAmountText = '1,000,000'
        s.startingNoNeed = false
        s.derivedLoanMemory = 0
        s.propertyValueText = ''
        s.capitalText = ''
        s.termYears = DEFAULT_TERM_YEARS
        s.scheduleExpanded = false
        // legacy reset does not clear income/purpose; preserved.
        const allocated = allocatePreset('basket1', 1_000_000, s.primeRate)
        s.tracks = allocated.map((entry) =>
          trackFromValues(
            { type: entry.type, amount: entry.amount, years: s.termYears, rate: entry.rate },
            s.termYears,
            s.primeRate,
          ),
        )
        s.activePreset = 'basket1'
        s.startingPointDirty = false
        recalculate(s)
      })
    },

    applyPrimeRate: (rate) => {
      set((s) => {
        s.primeRate = rate
        let changed = false
        s.tracks.forEach((track) => {
          if (track.type !== 'prime') return
          if (!track.rateText.trim() || track.isAutoRate) {
            track.rateText = String(rate)
            track.isAutoRate = true
            changed = true
          }
        })
        if (changed) recalculate(s)
      })
    },

    setCpiAnnualChange: (annualChange) => {
      set((s) => {
        if (s.cpiAnnualChange === annualChange) return
        s.cpiAnnualChange = annualChange
        recalculate(s)
      })
    },
  })),
)
