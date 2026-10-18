import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * Store-level tests for the one-track-per-type rule: a mix may not hold the
 * same track type twice. The store gate is what the calculator UI surfaces
 * (the same way the 2/3 variable cap does).
 */

beforeEach(() => useCalculatorStore.getState().reset())

describe('one track per type (calculator store)', () => {
  it('prices a distinct-type mix without an error', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    // The opening basket4 mix: prime / fixed / variableIndexed5y.
    const types = s.tracks.map((track) => track.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('rejects a repeated track type and flags the repeated rows', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const before = useCalculatorStore.getState()
    const primeIds = before.tracks.filter((track) => track.type === 'prime').map((track) => track.id)
    const fixed = before.tracks.find((track) => track.type === 'fixed')!
    useCalculatorStore.getState().changeTrackType(fixed.id, 'prime')
    const s = useCalculatorStore.getState()
    expect(s.error).toEqual({ kind: 'duplicateType' })
    expect([...s.flaggedTrackIds].sort()).toEqual([...primeIds, fixed.id].sort())
  })

  it('clears the error once the repeated type is changed away', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const fixed = useCalculatorStore.getState().tracks.find((track) => track.type === 'fixed')!
    useCalculatorStore.getState().changeTrackType(fixed.id, 'prime')
    expect(useCalculatorStore.getState().error).toEqual({ kind: 'duplicateType' })
    useCalculatorStore.getState().changeTrackType(fixed.id, 'fixed')
    expect(useCalculatorStore.getState().error).toBeNull()
    expect(useCalculatorStore.getState().flaggedTrackIds).toEqual([])
  })

  it('adds a new track with a type the mix does not already hold', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    // Drop the variable slice so the added track cannot tip the 2/3 cap; the
    // mix is then fixed + prime and the new track takes the fixed-index type.
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    useCalculatorStore.getState().removeTrack(variable.id)
    useCalculatorStore.getState().addTrack({ years: useCalculatorStore.getState().termYears })
    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    const types = s.tracks.map((track) => track.type)
    expect(new Set(types).size).toBe(types.length)
  })
})
