import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * Advisor rows: the debt the payments clear over the term (סך ירידת הקרן) and
 * the year the combined payment peaks. Both are read off the schedule the
 * table and the donut already show, so the tests cross-check them against that
 * schedule instead of re-deriving the arithmetic by hand.
 */

beforeEach(() => {
  useCalculatorStore.getState().reset()
})

function snapshot() {
  return useCalculatorStore.getState().snapshot
}

/** The nominal loan the mix was built from, summed per track. */
function loanAmount(): number {
  return snapshot().trackPaybacks.reduce((sum, entry) => sum + entry.amount, 0)
}

describe('totalPrincipalPaid (סך ירידת הקרן)', () => {
  it('is zero on an empty mix', () => {
    expect(snapshot().totalPrincipalPaid).toBe(0)
  })

  it('equals the loan when nothing is indexed', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket1')
    const s = snapshot()
    expect(loanAmount()).toBeCloseTo(1_000_000, 6)
    expect(s.totals.totalIndexation).toBe(0)
    expect(s.totalPrincipalPaid).toBeCloseTo(1_000_000, 4)
  })

  it('adds the CPI drift when the mix holds an indexed track', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket4')
    const s = snapshot()
    // The principal column telescopes to the nominal loan plus the indexation.
    expect(s.totals.totalIndexation).toBeGreaterThan(0)
    expect(s.totalPrincipalPaid).toBeCloseTo(loanAmount() + s.totals.totalIndexation, 4)
    expect(s.totalPrincipalPaid).toBeGreaterThan(1_000_000)
  })

  it('agrees with the schedule column and with everything repaid minus interest', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket4')
    const s = snapshot()
    const fromRows = s.scheduleRows.reduce((sum, row) => sum + row.principal, 0)
    expect(s.totalPrincipalPaid).toBeCloseTo(fromRows, 4)
    expect(s.totalPrincipalPaid).toBeCloseTo(s.totals.totalPaid - s.totals.totalInterest, 4)
  })
})

describe('peakPaymentYear (שנת שיא ההחזר)', () => {
  it('is 0 on an empty mix', () => {
    expect(snapshot().peakPaymentYear).toBe(0)
  })

  it('stays in year 1 when the payment never rises', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket1')
    expect(snapshot().peakPaymentYear).toBe(1)
  })

  it('is the final year for an indexed mix, whatever the term', () => {
    useCalculatorStore.getState().setTermYears(2)
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket4')
    expect(snapshot().peakPaymentYear).toBe(2)
  })

  it('never points past the longest track', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().loadPreset('basket4')
    const s = snapshot()
    expect(s.peakPaymentYear).toBe(s.maxEnteredYears)
  })
})
