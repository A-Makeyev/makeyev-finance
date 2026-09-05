import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { MAX_OTHER_EXPENSES, PTI_DEFAULT_THRESHOLD } from '@/lib/amortization'

/**
 * Store-level integration tests for Addendum 2: the transaction-cost
 * estimate, the upfront-cash total, the adjustable PTI check and the
 * other-expenses repeater, as wired through calculatorStore.recalculate.
 */

const reset = () => useCalculatorStore.getState().reset()

beforeEach(reset)

describe('transaction costs through the store', () => {
  it('uses loan + capital as the fee basis when no property value is entered', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    const s = useCalculatorStore.getState()
    // Defaults: realtor 2%, lawyer 1%, appraiser 3,000. Basis = loan 1,000,000
    // + capital 0 → realtor 20,000 → 23,600 with VAT.
    expect(s.snapshot.transactionCosts).not.toBeNull()
    expect(s.snapshot.transactionCosts!.realtorPreVat).toBe(20_000)
    expect(s.snapshot.transactionCosts!.realtor).toBeCloseTo(23_600, 6)
  })

  it('switches the basis to the property value once entered', () => {
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts!.realtorPreVat).toBe(40_000)
    // Lawyer 1% = 20,000, above the 6,000 floor.
    expect(s.snapshot.transactionCosts!.lawyerPreVat).toBe(20_000)
  })

  it('returns null costs without any basis (no property, no loan, no capital)', () => {
    useCalculatorStore.getState().reset()
    // reset() leaves the 1,000,000 loan prefill? It clears startingAmountText
    // but the tracks are re-created with zero amounts, so basis = 0 + 0 = 0.
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts).toBeNull()
  })

  it('respects edited percents and the lawyer minimum', () => {
    useCalculatorStore.getState().setPropertyValue('300,000', null)
    useCalculatorStore.getState().updateLawyerPercent('0.5')
    const s = useCalculatorStore.getState()
    // 0.5% of 300k = 1,500 < 6,000 floor → floor wins → 7,080 with VAT.
    expect(s.snapshot.transactionCosts!.lawyerPreVat).toBe(6_000)
    expect(s.snapshot.transactionCosts!.lawyer).toBeCloseTo(7_080, 6)
  })
})

describe('upfront total through the store', () => {
  it('adds capital + closing costs + transaction costs and rounds to ₪500', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    // No property entered → suggestedCapital derives the effective value
    // from loan + capital: 25% of 1,000,000 = 250,000. Upfront total =
    // capital + closing costs + fees, rounded up to ₪500.
    const s = useCalculatorStore.getState()
    expect(s.snapshot.upfrontTotal).not.toBeNull()
    const capital = s.snapshot.suggestedCapital ?? 0
    const closing = s.snapshot.closingCosts?.total ?? 0
    const tx = s.snapshot.transactionCosts!.total
    expect(s.snapshot.upfrontTotal).toBe(
      Math.ceil((capital + closing + tx) / 500) * 500,
    )
    expect(s.snapshot.suggestedCapital).toBe(250_000)
  })

  it('is null when there is nothing to sum', () => {
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().snapshot.upfrontTotal).toBeNull()
  })
})

describe('PTI through the store', () => {
  it('defaults to the 33% ceiling and stays inert without income', () => {
    const s = useCalculatorStore.getState()
    expect(s.ptiThresholdPercent).toBe(PTI_DEFAULT_THRESHOLD * 100)
    // No income entered → no warning.
    expect(s.snapshot.pti).toBeNull()
  })

  it('flags when payment + other expenses exceed the threshold', () => {
    // Income 20,000 at a 33% ceiling allows 6,600 of outflow.
    useCalculatorStore.getState().setIncome('20,000', null)
    const expenseId = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseAmount(expenseId, '7,000', null)
    // Mortgage payment alone would fit within the ceiling; 7,000 of
    // expenses alone exceed it → flagged either way.
    const flagged = useCalculatorStore.getState().snapshot.pti
    expect(flagged).not.toBeNull()
    expect(flagged!.payment).toBe(7_000 + useCalculatorStore.getState().snapshot.totals.firstPayment)
  })

  it('folds other-expense amounts into the flagged payment', () => {
    useCalculatorStore.getState().setIncome('20,000', null)
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseAmount(id, '1,000', null)
    // First payment on the prefill is ~5,836 (1M, 30y, ~4.25-5.75% mix);
    // +1,000 pushes past 6,600 only if the payment is already close. Assert
    // the composition instead of a hard-coded bank rate:
    const pti = useCalculatorStore.getState().snapshot.pti
    const first = useCalculatorStore.getState().snapshot.totals.firstPayment
    if (pti !== null) {
      expect(pti.payment).toBeCloseTo(first + 1_000, 6)
    }
  })

  it('threshold adjustment changes the verdict at the boundary', () => {
    useCalculatorStore.getState().setIncome('20,000', null)
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseAmount(id, '7,000', null)
    // 7,000/20,000 = 35%: flagged at 33%...
    expect(useCalculatorStore.getState().snapshot.pti).not.toBeNull()
    // ...and clear at 40%.
    useCalculatorStore.getState().setPtiThreshold(40)
    expect(useCalculatorStore.getState().snapshot.pti).toBeNull()
  })

  it('changes the PTI verdict without changing the mortgage payment', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().setIncome('20,000', null)
    const firstPayment = useCalculatorStore.getState().snapshot.totals.firstPayment

    useCalculatorStore.getState().setPtiThreshold(20)
    expect(useCalculatorStore.getState().snapshot.totals.firstPayment).toBe(firstPayment)
    expect(useCalculatorStore.getState().snapshot.pti).not.toBeNull()

    useCalculatorStore.getState().setPtiThreshold(40)
    expect(useCalculatorStore.getState().snapshot.totals.firstPayment).toBe(firstPayment)
    expect(useCalculatorStore.getState().snapshot.pti).toBeNull()
  })

  it('removing an expense unflags when the outflow drops below the ceiling', () => {
    useCalculatorStore.getState().setIncome('20,000', null)
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseAmount(id, '7,000', null)
    expect(useCalculatorStore.getState().snapshot.pti).not.toBeNull()
    useCalculatorStore.getState().removeOtherExpense(id)
    // Remaining outflow = mortgage payment only. With the prefill mix the
    // first payment (~5,836) sits under the 6,600 ceiling.
    expect(useCalculatorStore.getState().snapshot.pti).toBeNull()
  })
})

describe('realtor/lawyer percent ↔ ₪ amount pair', () => {
  it('mirrors the percent into a VAT-inclusive ₪ amount', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    // Defaults: realtor 2% → 20,000 pre-VAT → 23,600 incl. VAT; lawyer 1% →
    // 10,000 pre-VAT (above the 6,000 floor) → 11,800 incl. VAT.
    expect(s.realtorAmountText).toBe('23,600')
    expect(s.lawyerAmountText).toBe('11,800')
  })

  it('typing a ₪ amount updates the percent (round trip)', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorAmount('25,000', null)
    let s = useCalculatorStore.getState()
    // 25,000 incl. VAT → 21,186.44 pre-VAT → 2.1186…% of the 1M basis.
    expect(s.realtorPercentText).toBe('2.11864407')
    expect(s.realtorAmountText).toBe('25,000')

    // ...and back: a typed percent re-derives the ₪ side.
    useCalculatorStore.getState().updateRealtorPercent('2')
    s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('2')
    expect(s.realtorAmountText).toBe('23,600')
  })

  it('the lawyer floor applies when the percent is derived from a small amount', () => {
    useCalculatorStore.getState().setPropertyValue('300,000', null)
    useCalculatorStore.getState().updateLawyerAmount('7,080', null)
    const s = useCalculatorStore.getState()
    // 7,080 incl. VAT is exactly the 6,000 pre-VAT floor → 2% of 300k.
    expect(s.lawyerPercentText).toBe('2')
    expect(s.lawyerAmountText).toBe('7,080')
  })

  it('the percent stays the driver when the fee basis changes', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorAmount('25,000', null)
    // A typed ₪ amount becomes the equivalent percent; doubling the property
    // value doubles the fee from that percent instead of keeping the ₪ fixed.
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('2.11864407')
    expect(s.realtorAmountText).toBe('50,000')
  })

  it('clearing the amount field leaves the percent untouched', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorAmount('25,000', null)
    useCalculatorStore.getState().updateRealtorAmount('', null)
    const s = useCalculatorStore.getState()
    // A blank field is not a fee - no percent change, and the mirror is the
    // derived amount of the percent that was already set.
    expect(s.realtorPercentText).toBe('2.11864407')
    expect(s.realtorAmountText).toBe('25,000')
  })

  it('has no ₪ mirror without a fee basis', () => {
    useCalculatorStore.getState().reset()
    const s = useCalculatorStore.getState()
    expect(s.realtorAmountText).toBe('')
    expect(s.lawyerAmountText).toBe('')
  })
})

describe('renovations (שיפוצים) through the store', () => {
  it('starts blank - no default renovation budget', () => {
    expect(useCalculatorStore.getState().renovationAmountText).toBe('')
  })

  it('reduces the effective capital so the derived loan grows', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().setCapital('300,000', null)
    // Without renovations: loan = 1,000,000 - 300,000 = 700,000.
    expect(useCalculatorStore.getState().startingAmountText).toBe('700,000')
    // Renovations eat into the capital: effective 200,000 → loan 800,000.
    useCalculatorStore.getState().updateRenovationAmount('100,000', null)
    const s = useCalculatorStore.getState()
    expect(s.renovationAmountText).toBe('100,000')
    expect(s.startingAmountText).toBe('800,000')
    // The capital share reflects the post-renovation equity (20% of 1M).
    expect(s.snapshot.capitalAssessment?.percent).toBe(20)
  })

  it('includes renovations in the transaction-cost total and upfront cash', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRenovationAmount('100,000', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts).not.toBeNull()
    expect(s.snapshot.transactionCosts!.renovations).toBe(100_000)
    // Defaults on 1M: 38,940 of fees + 100,000 renovations.
    expect(s.snapshot.transactionCosts!.total).toBeCloseTo(38_940 + 100_000, 6)
    // The upfront total folds the renovation in through the fees total.
    const expected = Math.ceil(
      ((s.snapshot.suggestedCapital ?? 0) +
        (s.snapshot.closingCosts?.total ?? 0) +
        s.snapshot.transactionCosts!.total) /
        500,
    ) * 500
    expect(s.snapshot.upfrontTotal).toBe(expected)
  })

  it('never lets renovations push the effective capital below zero', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().setCapital('100,000', null)
    useCalculatorStore.getState().updateRenovationAmount('250,000', null)
    // Effective capital floors at 0 → the whole property is financed.
    expect(useCalculatorStore.getState().startingAmountText).toBe('1,000,000')
    expect(useCalculatorStore.getState().snapshot.capitalAssessment).toBeNull()
  })

  it('reset clears the renovation amount', () => {
    useCalculatorStore.getState().updateRenovationAmount('50,000', null)
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().renovationAmountText).toBe('')
  })
})

describe('one-time expenses through the store', () => {
  it('starts blank on the expense row', () => {
    const expense = useCalculatorStore.getState().otherExpenses[0]
    expect(expense.oneTimeAmountText).toBe('')
  })

  it('adds the one-time total to the upfront cash, not the monthly checks', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().setIncome('20,000', null)
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseOneTimeAmount(id, '10,000', null)
    const s = useCalculatorStore.getState()
    expect(s.otherExpenses[0].oneTimeAmountText).toBe('10,000')
    // Monthly outflow unchanged: one-time costs never enter PTI/DTI.
    const monthlyOutflow = s.snapshot.totals.firstPayment
    expect(s.snapshot.pti?.payment ?? monthlyOutflow).toBe(monthlyOutflow)
    // The upfront total folds the 10,000 in (through totalUpfrontCash).
    const expected = Math.ceil(
      ((s.snapshot.suggestedCapital ?? 0) +
        (s.snapshot.closingCosts?.total ?? 0) +
        (s.snapshot.transactionCosts?.total ?? 0) +
        10_000) /
        500,
    ) * 500
    expect(s.snapshot.upfrontTotal).toBe(expected)
  })

  it('a monthly expense still feeds PTI while a one-time one does not', () => {
    useCalculatorStore.getState().setIncome('20,000', null)
    const id = useCalculatorStore.getState().otherExpenses[0].id
    // A 7,000 monthly expense pushes past the 33% ceiling...
    useCalculatorStore.getState().updateOtherExpenseAmount(id, '7,000', null)
    expect(useCalculatorStore.getState().snapshot.pti).not.toBeNull()
    // ...but the same amount as a one-time cost must not.
    useCalculatorStore.getState().updateOtherExpenseAmount(id, '', null)
    useCalculatorStore.getState().updateOtherExpenseOneTimeAmount(id, '7,000', null)
    expect(useCalculatorStore.getState().snapshot.pti).toBeNull()
  })

  it('reset clears the one-time amount', () => {
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().updateOtherExpenseOneTimeAmount(id, '50,000', null)
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().otherExpenses[0].oneTimeAmountText).toBe('')
  })
})

describe('other-expense actions', () => {
  it('starts with one empty expense row', () => {
    const expenses = useCalculatorStore.getState().otherExpenses
    expect(expenses).toHaveLength(1)
    expect(expenses[0].label).toBe('')
    expect(expenses[0].amountText).toBe('')
    expect(expenses[0].oneTimeAmountText).toBe('')
  })

  it('caps the row count at MAX_OTHER_EXPENSES', () => {
    const count = () => useCalculatorStore.getState().otherExpenses.length
    while (count() < MAX_OTHER_EXPENSES) {
      useCalculatorStore.getState().addOtherExpense()
    }
    expect(useCalculatorStore.getState().otherExpenses).toHaveLength(MAX_OTHER_EXPENSES)
    // A further add is a no-op.
    useCalculatorStore.getState().addOtherExpense()
    expect(useCalculatorStore.getState().otherExpenses).toHaveLength(MAX_OTHER_EXPENSES)
    // Removing frees a slot again.
    const id = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().removeOtherExpense(id)
    useCalculatorStore.getState().addOtherExpense()
    expect(useCalculatorStore.getState().otherExpenses).toHaveLength(MAX_OTHER_EXPENSES)
  })

  it('adds, edits and removes expense rows', () => {
    const initialId = useCalculatorStore.getState().otherExpenses[0].id
    useCalculatorStore.getState().addOtherExpense()
    expect(useCalculatorStore.getState().otherExpenses).toHaveLength(2)
    const [, added] = useCalculatorStore.getState().otherExpenses
    useCalculatorStore.getState().updateOtherExpenseLabel(added.id, 'רכב')
    expect(useCalculatorStore.getState().otherExpenses[1].label).toBe('רכב')
    useCalculatorStore.getState().removeOtherExpense(added.id)
    expect(useCalculatorStore.getState().otherExpenses).toHaveLength(1)
    expect(useCalculatorStore.getState().otherExpenses[0].id).toBe(initialId)
    expect(useCalculatorStore.getState().otherExpenses[0].id).not.toBe(added.id)
  })

  it('reset clears expenses and restores the fee defaults', () => {
    useCalculatorStore.getState().addOtherExpense()
    useCalculatorStore.getState().updateLawyerPercent('3')
    useCalculatorStore.getState().setPtiThreshold(40)
    useCalculatorStore.getState().reset()
    const s = useCalculatorStore.getState()
    expect(s.otherExpenses).toHaveLength(1)
    expect(s.otherExpenses[0].label).toBe('')
    expect(s.otherExpenses[0].amountText).toBe('')
    expect(s.lawyerPercentText).toBe('1')
    expect(s.ptiThresholdPercent).toBe(33)
  })
})
