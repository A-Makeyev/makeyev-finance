import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { isMixDirty } from '@/stores/calculatorStore'

/**
 * Reset cadence is a live per-track field, not a track type. These tests pin
 * the defaults that keep legacy mixes working and the edit path the UI uses.
 */

beforeEach(() => useCalculatorStore.getState().reset())

describe('calculator reset cadence', () => {
  it('defaults by track type', () => {
    const tracks = useCalculatorStore.getState().tracks
    const variable5y = tracks.find((track) => track.type === 'variableIndexed5y')!
    expect(variable5y.resetMonths).toBe(60)
    expect(tracks.find((track) => track.type === 'prime')!.resetMonths).toBe(0)
    expect(tracks.find((track) => track.type === 'fixed')!.resetMonths).toBe(0)
  })

  it('changes cadence without touching the rate, and marks the mix dirty', () => {
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    const rateBefore = variable.rateText
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)

    useCalculatorStore.getState().changeTrackResetMonths(variable.id, 24)

    const state = useCalculatorStore.getState()
    const updated = state.tracks.find((track) => track.id === variable.id)!
    expect(updated.resetMonths).toBe(24)
    expect(updated.rateText).toBe(rateBefore)
    expect(isMixDirty(state)).toBe(true)
  })

  it('accepts every supported bank cadence', () => {
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    for (const months of [12, 18, 24, 30, 36, 48, 60, 84, 120]) {
      useCalculatorStore.getState().changeTrackResetMonths(variable.id, months)
      expect(
        useCalculatorStore.getState().tracks.find((track) => track.id === variable.id)!.resetMonths,
      ).toBe(months)
    }
  })

  it('normalizes an unsupported cadence back to the type default', () => {
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    useCalculatorStore.getState().changeTrackResetMonths(variable.id, 72)
    expect(
      useCalculatorStore.getState().tracks.find((track) => track.id === variable.id)!.resetMonths,
    ).toBe(60)
  })

  it('replaces the cadence when the track type changes', () => {
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    useCalculatorStore.getState().changeTrackType(variable.id, 'variable')
    expect(
      useCalculatorStore.getState().tracks.find((track) => track.id === variable.id)!.resetMonths,
    ).toBe(12)

    useCalculatorStore.getState().changeTrackType(variable.id, 'fixed')
    expect(
      useCalculatorStore.getState().tracks.find((track) => track.id === variable.id)!.resetMonths,
    ).toBe(0)
  })
})
