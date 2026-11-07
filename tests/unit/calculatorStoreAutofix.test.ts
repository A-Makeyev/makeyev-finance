import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { isVariableType } from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'

/**
 * Store-level tests for the one-click autofix. The button now appears for
 * every validation error, not just the 2/3 variable cap, and must repair the
 * mix without silently changing the mortgage the user typed.
 */

const totalOf = (tracks: ReturnType<typeof useCalculatorStore.getState>['tracks']) =>
  tracks.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)

beforeEach(() => useCalculatorStore.getState().reset())

describe('calculator autofix', () => {
  it('leaves a valid repeated track type alone', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const variable = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'variableIndexed5y')!
    // Two fixed tracks plus one prime: a valid mix with a repeated type.
    useCalculatorStore.getState().changeTrackType(variable.id, 'fixed')
    expect(useCalculatorStore.getState().error).toBeNull()

    useCalculatorStore.getState().autofixMix()

    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    expect(s.tracks.filter((track) => track.type === 'fixed')).toHaveLength(2)
    expect(totalOf(s.tracks)).toBe(1_000_000)
  })

  it('repairs an all-variable mix without shrinking the typed mortgage sum', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const fixed = useCalculatorStore
      .getState()
      .tracks.find((track) => track.type === 'fixed')!
    // Every track now carries a variable rate, so the 2/3 ceiling is breached.
    useCalculatorStore.getState().changeTrackType(fixed.id, 'variable5y')
    expect(useCalculatorStore.getState().error).toEqual({ kind: 'variableCap' })

    useCalculatorStore.getState().autofixMix()

    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    // The cap trim must return the excess to the fixed side, not leave the
    // loan smaller than the sum the user typed.
    expect(totalOf(s.tracks)).toBe(1_000_000)
    const variableTotal = s.tracks
      .filter((track) => isVariableType(track.type))
      .reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
    expect(variableTotal / totalOf(s.tracks)).toBeLessThanOrEqual(2 / 3 + 1e-9)
  })

  it('clamps an out-of-range track term', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const track = useCalculatorStore.getState().tracks[0]
    // Simulate a stale/imported mix with an impossible term, then force a
    // recalculation through a normal edit.
    useCalculatorStore.setState((s) => {
      s.tracks[0].yearsText = '0'
    })
    useCalculatorStore.getState().changeTrackMethod(track.id, 'spitzer')
    expect(useCalculatorStore.getState().error).toEqual({ kind: 'term' })

    useCalculatorStore.getState().autofixMix()

    const s = useCalculatorStore.getState()
    expect(s.error).toBeNull()
    expect(Number(s.tracks[0].yearsText)).toBe(15)
  })

  it('keeps a typed mortgage sum distributed across the tracks', () => {
    // A fresh mix holds the basket4 lineup with blank amounts. Typing the
    // loan allocates it, and autofix must leave that allocation intact.
    useCalculatorStore.getState().setStartingAmount('900,000', null)
    const before = useCalculatorStore.getState()
    expect(totalOf(before.tracks)).toBe(900_000)

    useCalculatorStore.getState().autofixMix()

    const after = useCalculatorStore.getState()
    expect(after.error).toBeNull()
    expect(totalOf(after.tracks)).toBe(900_000)
    expect(after.tracks.every((track) => parseAmountText(track.amountText) > 0)).toBe(true)
  })
})
