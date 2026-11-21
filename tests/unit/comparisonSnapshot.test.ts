import { beforeEach, describe, expect, it } from 'vitest'
import {
  isComparisonDirty,
  seedFromCalculator,
  serializeComparisonSnapshot,
  useComparisonStore,
} from '@/stores/comparisonStore'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * The saved-comparison lifecycle: the input snapshot that is stored, the
 * unsaved-changes baseline, loading a snapshot back, and discarding edits.
 */

const reset = () => useComparisonStore.getState().reset()

beforeEach(() => {
  useCalculatorStore.getState().reset()
  reset()
})

describe('comparison snapshot serialization', () => {
  it('stores inputs only: no ids, derived fee mirrors or results', () => {
    const state = useComparisonStore.getState()
    const snapshot = serializeComparisonSnapshot(state)

    expect(snapshot.version).toBe(1)
    expect(snapshot.scenarios).toHaveLength(state.scenarios.length)
    expect(snapshot.shared).not.toHaveProperty('realtorAmountText')
    expect(snapshot.shared).not.toHaveProperty('lawyerAmountText')
    expect(snapshot.shared).not.toHaveProperty('derivedLoanMemory')
    expect(snapshot.scenarios[0]).not.toHaveProperty('id')
    expect(snapshot.scenarios[0].tracks[0]).not.toHaveProperty('id')
    expect(snapshot.scenarios[0].tracks[0]).not.toHaveProperty('isAutoRate')
    expect(snapshot).not.toHaveProperty('results')
  })

  it('round-trips through loadSavedComparison without showing as dirty', () => {
    const before = useComparisonStore.getState()
    const snapshot = serializeComparisonSnapshot(before)
    const firstTrackId = before.scenarios[0].tracks[0].id

    useComparisonStore.getState().loadSavedComparison(snapshot, 'saved-1', 'My comparison')

    const after = useComparisonStore.getState()
    expect(serializeComparisonSnapshot(after)).toEqual(snapshot)
    expect(isComparisonDirty(after)).toBe(false)
    expect(after.loadedComparisonId).toBe('saved-1')
    expect(after.loadedComparisonLabel).toBe('My comparison')
    // Fresh ephemeral ids: a loaded snapshot is a new editing session.
    expect(after.scenarios[0].tracks[0].id).not.toBe(firstTrackId)
  })
})

describe('comparison unsaved-changes baseline', () => {
  it('starts clean and becomes dirty on a shared-input edit', () => {
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(false)
    useComparisonStore.getState().setIncome('30,000', null)
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(true)
  })

  it('becomes dirty on a scenario or track edit', () => {
    const state = useComparisonStore.getState()
    const scenario = state.scenarios[0]
    state.updateTrackRate(scenario.id, scenario.tracks[0].id, '5.1')
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(true)
  })

  it('clears when marked saved', () => {
    useComparisonStore.getState().setIncome('30,000', null)
    useComparisonStore.getState().markComparisonSaved('saved-1', 'Comparison A')
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(false)
  })

  it('treats reset as clean, with no loaded comparison', () => {
    useComparisonStore.getState().setIncome('30,000', null)
    useComparisonStore.getState().markComparisonSaved('saved-1', 'Comparison A')
    useComparisonStore.getState().reset()
    const state = useComparisonStore.getState()
    expect(isComparisonDirty(state)).toBe(false)
    expect(state.loadedComparisonId).toBeNull()
    expect(state.loadedComparisonLabel).toBeNull()
  })

  it('discard restores the last loaded snapshot', () => {
    const snapshot = serializeComparisonSnapshot(useComparisonStore.getState())
    useComparisonStore.getState().loadSavedComparison(snapshot, 'saved-1', 'Comparison A')
    useComparisonStore.getState().setIncome('99,000', null)
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(true)

    useComparisonStore.getState().discardComparisonChanges()

    const restored = useComparisonStore.getState()
    expect(restored.shared.incomeText).toBe('')
    expect(isComparisonDirty(restored)).toBe(false)
    expect(restored.loadedComparisonId).toBe('saved-1')
  })

  it('treats a calculator seed as a clean starting point, not unsaved work', () => {
    const calculator = useCalculatorStore.getState()
    seedFromCalculator({
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
      otherExpenses: calculator.otherExpenses,
      ptiThresholdPercent: calculator.ptiThresholdPercent,
      termYears: calculator.termYears,
      mortgageSumText: calculator.startingAmountText,
      activePreset: calculator.activePreset,
      tracks: calculator.tracks,
      approvalDateText: calculator.approvalDateText,
    })
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(false)

    useComparisonStore.getState().setPropertyValue('1,500,000', null)
    expect(isComparisonDirty(useComparisonStore.getState())).toBe(true)
  })
})
