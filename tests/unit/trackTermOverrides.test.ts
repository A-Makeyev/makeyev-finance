import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_TERM_YEARS, MAX_YEARS } from '@/lib/amortization'
import { serializeSavableTracks, useCalculatorStore } from '@/stores/calculatorStore'
import { seedFromCalculator, useComparisonStore } from '@/stores/comparisonStore'

beforeEach(() => {
  useCalculatorStore.getState().reset()
  useComparisonStore.getState().reset()
})

describe('track terms and the longest-term slider', () => {
  it('resets both the slider and all track terms together', () => {
    const store = useCalculatorStore.getState()
    store.setTermYears(30)
    store.reset()
    expect(useCalculatorStore.getState().termYears).toBe(DEFAULT_TERM_YEARS)
    expect(useCalculatorStore.getState().tracks.every((track) => track.yearsText === String(DEFAULT_TERM_YEARS))).toBe(true)
  })
  it('changes one track independently, follows the longest, and preserves terms on submit', () => {
    const store = useCalculatorStore.getState()
    store.setTermYears(20)
    const id = store.tracks[0].id
    store.updateTrackYears(id, '25')
    store.commitTrackYearsBlur(id)
    expect(useCalculatorStore.getState().termYears).toBe(25)
    store.setStartingAmount('300,000', null)
    store.submit()
    expect(useCalculatorStore.getState().tracks.map((track) => track.yearsText)).toEqual(['25', '20', '20'])
    const currentId = useCalculatorStore.getState().tracks[0].id
    store.updateTrackYears(currentId, '10')
    store.commitTrackYearsBlur(currentId)
    expect(useCalculatorStore.getState().termYears).toBe(20)
  })

  it('applies an accepted slider change to every track and clears the edited flags', () => {
    const store = useCalculatorStore.getState()
    store.updateTrackYears(store.tracks[0].id, '10')
    store.commitTrackYearsBlur(store.tracks[0].id)
    store.setTermYears(25)
    store.addTrack()
    expect(useCalculatorStore.getState().tracks.every((track) => track.yearsText === '25' && !track.yearsOverridden)).toBe(true)
  })

  it('loads saved terms without changing them and displays their longest term', () => {
    const store = useCalculatorStore.getState()
    const tracks = serializeSavableTracks(store.tracks.map((track) => ({ ...track, amountText: '100,000' })))
      .map(({ yearsOverridden: _flag, ...track }, index) => ({ ...track, yearsText: index === 0 ? '10' : '20' }))
    store.loadSavedMix(tracks, 30)
    expect(useCalculatorStore.getState().termYears).toBe(20)
    expect(useCalculatorStore.getState().tracks.map((track) => track.yearsText)).toEqual(['10', '20', '20'])
    expect(useCalculatorStore.getState().tracks.every((track) => track.yearsOverridden)).toBe(true)
  })

  it('updates the displayed longest term after removing the longest track', () => {
    const store = useCalculatorStore.getState()
    store.setTermYears(10)
    store.updateTrackYears(store.tracks[0].id, '30')
    store.commitTrackYearsBlur(store.tracks[0].id)
    store.removeTrack(store.tracks[0].id)
    expect(useCalculatorStore.getState().termYears).toBe(10)
  })

  it.each([['0', '1'], ['', '1'], [String(MAX_YEARS + 1), String(MAX_YEARS)]])('bounds a custom term %s at %s', (input, expected) => {
    const store = useCalculatorStore.getState()
    store.updateTrackYears(store.tracks[0].id, input)
    store.commitTrackYearsBlur(store.tracks[0].id)
    expect(useCalculatorStore.getState().tracks[0].yearsText).toBe(expected)
  })

  it('keeps Compare scenarios independent and follows their own longest track', () => {
    const calc = useCalculatorStore.getState()
    calc.setTermYears(20)
    calc.updateTrackYears(calc.tracks[0].id, '10')
    calc.commitTrackYearsBlur(calc.tracks[0].id)
    seedFromCalculator({ ...useCalculatorStore.getState(), mortgageSumText: useCalculatorStore.getState().startingAmountText })
    const compare = useComparisonStore.getState()
    const [first, second] = compare.scenarios
    compare.updateTrackYears(first.id, first.tracks[0].id, '30')
    compare.commitTrackYearsBlur(first.id, first.tracks[0].id)
    expect(useComparisonStore.getState().scenarios[0].termYears).toBe(30)
    expect(useComparisonStore.getState().scenarios[0].tracks.map((track) => track.yearsText)).toEqual(['30', '20', '20'])
    compare.setScenarioTermYears(first.id, 25)
    expect(useComparisonStore.getState().scenarios[0].tracks.every((track) => track.yearsText === '25' && !track.yearsOverridden)).toBe(true)
    expect(useComparisonStore.getState().scenarios[1]).toEqual(second)
  })

  it('computes individual terms, then recomputes all terms after an accepted change', () => {
    const store = useCalculatorStore.getState()
    const fixed = { type: 'fixed' as const, amountText: '120,000', rateText: '0', method: 'spitzer' as const }
    store.loadSavedMix([{ ...fixed, yearsText: '10' }, { ...fixed, yearsText: '20' }], 20)
    // Zero interest: 120,000 / 120 + 120,000 / 240 = 1,500.
    expect(useCalculatorStore.getState().snapshot.totals.firstPayment).toBe(1500)
    store.setTermYears(10)
    expect(useCalculatorStore.getState().snapshot.totals.firstPayment).toBe(2000)
    store.setTermYears(5)
    expect(useCalculatorStore.getState().snapshot.totals.firstPayment).toBe(4000)
    expect(useCalculatorStore.getState().snapshot.maxEnteredYears).toBe(5)
  })

  it('bounds the slider and shortens grace when the accepted term is shorter', () => {
    const store = useCalculatorStore.getState()
    store.changeTrackGraceMonths(store.tracks[0].id, 24)
    store.setTermYears(-1)
    expect(useCalculatorStore.getState().termYears).toBe(1)
    expect(useCalculatorStore.getState().tracks[0].graceMonths).toBe(12)
    store.setTermYears(MAX_YEARS + 1)
    expect(useCalculatorStore.getState().termYears).toBe(MAX_YEARS)
    store.setTermYears(Number.NaN)
    expect(useCalculatorStore.getState().termYears).toBe(MAX_YEARS)
  })
})
