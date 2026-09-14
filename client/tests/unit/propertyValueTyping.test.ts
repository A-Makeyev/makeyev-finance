import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * Typing the שווי הנכס (home price) key by key walks the derived loan through
 * ₪1, ₪10, ₪100 ... where the preset's shares cannot be allocated across the
 * tracks in whole shekels (at ₪10 the recommended 40/34/26 rounds to 4/3/3).
 * That rounded split must not become the proportions every later scale-up
 * copies: 4/3/3 carries a 70% variable share, past the Bank of Israel 2/3 cap,
 * and the resulting error freezes the summary - the 💡 purchase-tax line and
 * the ladder it opens silently disappear while the price field reads ₪100M.
 */

const reset = () => useCalculatorStore.getState().reset()

beforeEach(reset)

/** Types the digits into the property field, one keystroke each. */
function typeHomePrice(digits: string): void {
  for (let length = 1; length <= digits.length; length++) {
    useCalculatorStore.getState().setPropertyValue(digits.slice(0, length), null)
  }
}

const trackAmounts = () => useCalculatorStore.getState().tracks.map((track) => track.amountText)

describe('home price typed key by key', () => {
  it('keeps the recommended mix instead of drifting to a variable share over the cap', () => {
    typeHomePrice('100000000')

    const s = useCalculatorStore.getState()
    expect(s.propertyValueText).toBe('100,000,000')
    expect(s.error).toBeNull()
    // The default (recommended) mix, scaled to the typed price: 40% prime +
    // 26% indexed = 66% variable, inside the 2/3 cap (the drift left 70%).
    expect(trackAmounts()).toEqual(['40,000,000', '34,000,000', '26,000,000'])
  })

  it('leaves the purchase tax the 💡 line and the ladder derive from', () => {
    typeHomePrice('100000000')
    // First home at ₪100M: 3.5% / 5% / 8% / 10% on their slices = 9,310,214.925.
    expect(useCalculatorStore.getState().snapshot.closingCosts?.purchaseTax).toBeCloseTo(
      9_310_214.925,
      6,
    )
  })

  it('reaches the same mix whether the price is typed or entered at once', () => {
    typeHomePrice('100000000')
    const typed = trackAmounts()

    reset()
    useCalculatorStore.getState().setPropertyValue('100,000,000', null)
    expect(trackAmounts()).toEqual(typed)
  })
})
