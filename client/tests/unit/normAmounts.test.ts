import { describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * The above-norm fee warning carries a norm-comparison amount: what the fee
 * would be AT the market-norm percent (realtor 2%, lawyer 0.5% with its
 * floor), not the fee at the user's typed percent.
 */
describe('norm amounts for the fee warning', () => {
  it('prices the realtor norm at 2% of the basis', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    // 2% of 1M = 20,000 pre-VAT → 23,600 incl. VAT.
    expect(s.realtorNormAmount).toBe('23,600')
  })

  it('prices the lawyer norm at 0.5% with the 6,000 floor', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    // 0.5% of 1M = 5,000 < 6,000 floor → floor wins → 7,080 incl. VAT.
    expect(s.lawyerNormAmount).toBe('7,080')
  })

  it('the norm amounts stay independent of the typed percents', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorPercent('3.5')
    useCalculatorStore.getState().updateLawyerPercent('1')
    const s = useCalculatorStore.getState()
    // Still priced at the norms, not at 3.5% / 1%.
    expect(s.realtorNormAmount).toBe('23,600')
    expect(s.lawyerNormAmount).toBe('7,080')
  })

  it('scales with the basis and is null without one', () => {
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    // 2% of 2M = 40,000 → 47,200; 0.5% of 2M = 10,000 > floor → 11,800.
    expect(useCalculatorStore.getState().realtorNormAmount).toBe('47,200')
    expect(useCalculatorStore.getState().lawyerNormAmount).toBe('11,800')
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().realtorNormAmount).toBeNull()
    expect(useCalculatorStore.getState().lawyerNormAmount).toBeNull()
  })
})
