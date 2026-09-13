import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { MAX_HOME_VALUE } from '@/lib/amortization'

/** The store's grouping format (en-US commas) for the cap figure. */
const formatGrouped = (value: number) => value.toLocaleString('en-US')

/**
 * The שווי הנכס (home-price) input caps at MAX_HOME_VALUE (₪100M): an
 * over-cap typed value clamps the stored text so every derived figure (the
 * loan mirror, the tracks, the purchase tax) derives from the capped value.
 */

const reset = () => useCalculatorStore.getState().reset()

beforeEach(reset)

describe('home-price input cap', () => {
  it('exposes MAX_HOME_VALUE of ₪100,000,000', () => {
    expect(MAX_HOME_VALUE).toBe(100_000_000)
  })

  it('keeps a value at the cap exactly', () => {
    useCalculatorStore
      .getState()
      .setPropertyValue(formatGrouped(MAX_HOME_VALUE), null)
    expect(useCalculatorStore.getState().propertyValueText).toBe(formatGrouped(MAX_HOME_VALUE))
  })

  it('clamps an over-cap value to the cap', () => {
    useCalculatorStore.getState().setPropertyValue('150,000,000', null)
    expect(useCalculatorStore.getState().propertyValueText).toBe(formatGrouped(MAX_HOME_VALUE))
  })

  it('clamps while typing with a caret (the display clamps mid-edit too)', () => {
    const result = useCalculatorStore.getState().setPropertyValue('999,999,999,999', 15)
    expect(result.text).toBe(formatGrouped(MAX_HOME_VALUE))
    expect(result.caret).toBe(result.text.length)
  })

  it('derives the purchase tax from the capped value', () => {
    useCalculatorStore.getState().setPropertyValue('250,000,000', null)
    const tax = useCalculatorStore.getState().snapshot.closingCosts?.purchaseTax
    // First home at the capped ₪100M:
    //   3.5% × (2,347,040 − 1,978,745) = 12,890.025
    // + 5% × (6,055,070 − 2,347,040) = 185,401.5
    // + 8% × (20,183,565 − 6,055,070) = 1,130,279.6
    // + 10% × (100,000,000 − 20,183,565) = 7,981,643.5
    // = 9,310,214.925
    expect(tax).toBeCloseTo(9_310_214.925, 6)
  })

  it('never triggers for values under the cap', () => {
    useCalculatorStore.getState().setPropertyValue('99,999,999', null)
    expect(useCalculatorStore.getState().propertyValueText).toBe('99,999,999')
  })
})
