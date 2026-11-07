import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * Repeated track types are allowed: real bank offers carry two prime tracks,
 * or two fixed tracks, and the calculator must price them. The 2/3 variable
 * cap is still enforced independently.
 */

beforeEach(() => useCalculatorStore.getState().reset())

describe('repeated track types (calculator store)', () => {
  it('prices a mix with two fixed tracks instead of rejecting it', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    useCalculatorStore.getState().changeTrackType(variable.id, 'fixed')

    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    expect(s.tracks.filter((track) => track.type === 'fixed')).toHaveLength(2)
    expect(s.flaggedTrackIds).toEqual([])
    expect(s.snapshot.totals.firstPayment).toBeGreaterThan(0)
  })

  it('prices a mix with two prime tracks without tripping the variable cap', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    // Two primes plus one fixed: one third variable, well under 2/3.
    useCalculatorStore.getState().changeTrackType(variable.id, 'prime')

    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    expect(s.tracks.filter((track) => track.type === 'prime')).toHaveLength(2)
    expect(s.snapshot.totals.firstPayment).toBeGreaterThan(0)
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
