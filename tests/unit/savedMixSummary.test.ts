import { describe, expect, it } from 'vitest'
import { summarizeSavedMix } from '@/features/mixes/summary'
import type { SavedTrackInput } from '@/stores/calculatorStore'

/**
 * The expected payments are the plain annuity formula by hand:
 *   P * r / (1 - (1 + r)^-n),  r = annual/100/12, n = years * 12
 *   100,000 @ 4.8% / 30y -> 524.665354
 *   200,000 @ 5.0% / 25y -> 1,169.180083
 * so a saved mix must recompute to those, not replay a stored snapshot.
 */

const fixed = (amountText: string, yearsText: string, rateText: string): SavedTrackInput => ({
  type: 'fixed',
  amountText,
  yearsText,
  rateText,
  method: 'spitzer',
})

describe('summarizeSavedMix', () => {
  it('recomputes a single track (100k, 4.8%, 30y)', () => {
    const summary = summarizeSavedMix([fixed('100,000', '30', '4.8')])
    expect(summary.monthlyPayment).toBeCloseTo(524.665354, 4)
    expect(summary.totalAmount).toBe(100_000)
    expect(summary.parts).toEqual([{ type: 'fixed', sharePercent: 100, amount: 100_000 }])
    expect(summary.valid).toBe(true)
  })

  it('sums two tracks and derives each share of the loan', () => {
    const summary = summarizeSavedMix([fixed('100,000', '30', '4.8'), fixed('200,000', '25', '5')])
    expect(summary.monthlyPayment).toBeCloseTo(1693.845437, 4)
    expect(summary.totalAmount).toBe(300_000)
    expect(summary.parts.map((part) => Math.round(part.sharePercent))).toEqual([33, 67])
    expect(summary.valid).toBe(true)
  })

  it('marks the mix invalid when a stored track no longer computes', () => {
    // years 0 is rejected by computeTrackResult (months <= 0): the track is
    // excluded from the figures and the mix is flagged.
    const summary = summarizeSavedMix([fixed('100,000', '30', '4.8'), fixed('200,000', '0', '5')])
    expect(summary.valid).toBe(false)
    expect(summary.monthlyPayment).toBeCloseTo(524.665354, 4)
    expect(summary.totalAmount).toBe(100_000)
  })

  it('is invalid and zeroed when nothing computes', () => {
    const summary = summarizeSavedMix([])
    expect(summary.valid).toBe(false)
    expect(summary.monthlyPayment).toBe(0)
    expect(summary.totalAmount).toBe(0)
    expect(summary.parts).toEqual([])
  })
})
