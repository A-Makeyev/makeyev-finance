import { beforeEach, describe, expect, it } from 'vitest'
import { isMixDirty, useCalculatorStore } from '@/stores/calculatorStore'
import { seedFromCalculator, useComparisonStore } from '@/stores/comparisonStore'

/**
 * Store wiring for the אישור עקרוני approval date (rate validity). The window
 * itself is hand-checked in rateValidity.test.ts; these cover the plumbing the
 * UI depends on: sanitising input, clearing the date where a different offer
 * begins, keeping it out of the saved-mix dirty state, and carrying it from the
 * calculator into the comparison's first mix.
 */

beforeEach(() => {
  useCalculatorStore.getState().reset()
  useComparisonStore.getState().reset()
})

function seededScenarioDate(index: number): string {
  return useComparisonStore.getState().scenarios[index].approvalDateText
}

describe('calculator store: the אישור עקרוני date', () => {
  it('keeps a real date-only value, trimmed', () => {
    useCalculatorStore.getState().setApprovalDate(' 2026-01-01 ')
    expect(useCalculatorStore.getState().approvalDateText).toBe('2026-01-01')
  })

  it('clears a malformed or impossible date instead of storing junk', () => {
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    useCalculatorStore.getState().setApprovalDate('2026-02-30')
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
    useCalculatorStore.getState().setApprovalDate('not-a-date')
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
  })

  it('accepts an empty string as "no date"', () => {
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    useCalculatorStore.getState().setApprovalDate('')
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
  })

  it('does not mark the mix dirty: the date is not part of a saved mix', () => {
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('clears on reset: the date belongs to one offer', () => {
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
  })

  it('clears when detaching from a saved mix', () => {
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    useCalculatorStore.getState().detachMix()
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
  })

  it('clears when a saved mix is loaded (a mix carries no date)', () => {
    const before = useCalculatorStore.getState()
    useCalculatorStore.getState().setApprovalDate('2026-01-01')
    useCalculatorStore.getState().loadSavedMix(
      before.tracks.map((track) => ({
        type: track.type,
        amountText: track.amountText,
        yearsText: track.yearsText,
        rateText: track.rateText,
        method: track.method,
      })),
      before.termYears,
      null,
      'mix-1',
      'משכנתא',
    )
    expect(useCalculatorStore.getState().approvalDateText).toBe('')
    expect(useCalculatorStore.getState().loadedMixId).toBe('mix-1')
  })
})

describe('comparison store: the אישור עקרוני date', () => {
  it('seeds the calculator date into the first mix, and none into the blank one', () => {
    seedFromCalculator({
      propertyValueText: '',
      capitalText: '',
      incomeText: '',
      purpose: 'first',
      realtorPercentText: '',
      lawyerPercentText: '',
      realtorAmountText: '',
      lawyerAmountText: '',
      appraiserFeeText: '',
      renovationAmountText: '',
      otherExpenses: [{ label: '', amountText: '', oneTimeAmountText: '' }],
      ptiThresholdPercent: 33,
      termYears: 30,
      mortgageSumText: '1,000,000',
      activePreset: 'basket4',
      tracks: useCalculatorStore.getState().tracks,
      approvalDateText: '2026-01-01',
    })
    expect(seededScenarioDate(0)).toBe('2026-01-01')
    expect(seededScenarioDate(1)).toBe('')
  })

  it('leaves the date empty when the calculator had none', () => {
    seedFromCalculator({
      propertyValueText: '',
      capitalText: '',
      incomeText: '',
      purpose: 'first',
      realtorPercentText: '',
      lawyerPercentText: '',
      realtorAmountText: '',
      lawyerAmountText: '',
      appraiserFeeText: '',
      renovationAmountText: '',
      otherExpenses: [{ label: '', amountText: '', oneTimeAmountText: '' }],
      ptiThresholdPercent: 33,
      termYears: 30,
      mortgageSumText: '1,000,000',
      activePreset: null,
      tracks: useCalculatorStore.getState().tracks,
    })
    expect(seededScenarioDate(0)).toBe('')
  })

  it('sanitises a value set on one mix and leaves the other alone', () => {
    const store = useComparisonStore.getState()
    const first = store.scenarios[0].id
    store.setScenarioApprovalDate(first, '2026-03-02')
    expect(seededScenarioDate(0)).toBe('2026-03-02')
    useComparisonStore.getState().setScenarioApprovalDate(first, '31/03/2026')
    expect(seededScenarioDate(0)).toBe('')
    expect(seededScenarioDate(1)).toBe('')
  })

  it('ignores an unknown mix id', () => {
    const store = useComparisonStore.getState()
    store.setScenarioApprovalDate(store.scenarios[1].id, '2026-03-02')
    store.setScenarioApprovalDate('nope', '2026-01-01')
    expect(seededScenarioDate(1)).toBe('2026-03-02')
    expect(useComparisonStore.getState().scenarios).toHaveLength(2)
  })

  it('copies the date when a mix is duplicated (the copy is the same offer)', () => {
    const store = useComparisonStore.getState()
    const first = store.scenarios[0].id
    store.setScenarioApprovalDate(first, '2026-03-02')
    useComparisonStore.getState().duplicateScenario(first)
    expect(seededScenarioDate(1)).toBe('2026-03-02')
  })

  it('gives an added mix no date', () => {
    useComparisonStore.getState().addScenario()
    const scenarios = useComparisonStore.getState().scenarios
    expect(scenarios[scenarios.length - 1].approvalDateText).toBe('')
  })

  it('clears every mix date on reset', () => {
    const store = useComparisonStore.getState()
    store.setScenarioApprovalDate(store.scenarios[0].id, '2026-03-02')
    useComparisonStore.getState().reset()
    expect(
      useComparisonStore.getState().scenarios.every((scenario) => scenario.approvalDateText === ''),
    ).toBe(true)
  })
})
