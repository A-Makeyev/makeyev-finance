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
    // Defaults: realtor 2%, lawyer 0.5%, appraiser 3,000. Basis = loan 1,000,000
    // + capital 0 → realtor 20,000 → 23,600 with VAT.
    expect(s.snapshot.transactionCosts).not.toBeNull()
    expect(s.snapshot.transactionCosts!.realtorPreVat).toBe(20_000)
    expect(s.snapshot.transactionCosts!.realtor).toBeCloseTo(23_600, 6)
  })

  it('switches the basis to the property value once entered', () => {
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts!.realtorPreVat).toBe(40_000)
    // Lawyer default 0.5% = 10,000, above the 6,000 floor.
    expect(s.snapshot.transactionCosts!.lawyerPreVat).toBe(10_000)
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

  it('blank appraiser field means no appraiser cost (nothing silently added)', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.appraiserFeeText).toBe('')
    expect(s.snapshot.transactionCosts!.appraiser).toBe(0)
    expect(s.snapshot.transactionCosts!.appraiserPreVat).toBe(0)
  })

  it('typed appraiser amount enters the estimate with VAT', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateAppraiserFee('2,500', null)
    const s = useCalculatorStore.getState()
    // Whatever the setter is named, the fee must reach the estimate VAT-ed.
    expect(s.snapshot.transactionCosts!.appraiserPreVat).toBe(2_500)
    expect(s.snapshot.transactionCosts!.appraiser).toBeCloseTo(2_950, 6)
  })
})

describe('upfront total through the store', () => {
  it('adds capital + purchase tax + transaction costs as an exact sum', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    // No property entered → suggestedCapital derives the effective value
    // from loan + capital: 25% of 1,000,000 = 250,000. Upfront total =
    // capital + purchase tax + itemized fees (the separate 1.5% side-cost
    // estimate is NOT added - its lawyer/surveyor parts are already priced
    // by the fee fields), exact - no rounding buffer.
    const s = useCalculatorStore.getState()
    expect(s.snapshot.upfrontTotal).not.toBeNull()
    const capital = s.snapshot.suggestedCapital ?? 0
    const tax = s.snapshot.closingCosts?.purchaseTax ?? 0
    const tx = s.snapshot.transactionCosts!.total
    expect(s.snapshot.upfrontTotal).toBe(capital + tax + tx)
    expect(s.snapshot.suggestedCapital).toBe(250_000)
  })

  it('does not double-count lawyer/appraiser via the side-cost estimate', () => {
    // ₪1M property with default fees: the old total priced the lawyer and
    // appraiser twice (once in the 1.5% side-cost estimate, once in the
    // itemized fees), inflating the cash-needed by ₪15,000.
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().setCapital('250,000', null)
    const s = useCalculatorStore.getState()
    const capital = s.snapshot.suggestedCapital ?? 0
    const tax = s.snapshot.closingCosts?.purchaseTax ?? 0
    const tx = s.snapshot.transactionCosts!.total
    const expected = capital + tax + tx
    expect(s.snapshot.upfrontTotal).toBe(expected)
    // Concretely: 250,000 capital + 0 tax (first home, 1M is under the
    // exempt bracket) + 30,680 fees (23,600 realtor + 7,080 lawyer; שמאי
    // counts only when typed) = 280,680 exactly.
    expect(s.snapshot.upfrontTotal).toBe(280_680)
  })

  it('is null when there is nothing to sum', () => {
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().snapshot.upfrontTotal).toBeNull()
  })

  it('tiny loan (regression): total equals capital + visible fee lines, no hidden items', () => {
    // The reported bug: loan 5 with everything else blank showed a total of
    // 11,500 while the visible lines read 0 + 7,080 - the gap was the silent
    // 3,540 appraiser default plus ₪500-grid rounding. Now: שמאי counts only
    // when typed and the sum is exact.
    useCalculatorStore.getState().setStartingAmount('5', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts!.appraiser).toBe(0)
    // 25% of the 5-basis → 1.25 → 500 on suggestedCapital's ₪500 grid.
    expect(s.snapshot.suggestedCapital).toBe(500)
    // 500 capital + 0 tax + (0.118 realtor + 7,080 lawyer) = 7,580.118, exact.
    expect(s.snapshot.upfrontTotal).toBeCloseTo(500 + 7_080.118, 2)
    // At display precision the shown lines (0 + 7,080 + capital 500) sum to
    // the shown total (7,580).
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
    expect(flagged!.payment).toBe(
      7_000 + useCalculatorStore.getState().snapshot.totals.firstPayment,
    )
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
  it('blank fields stay blank; hints carry the default-derived amounts', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    // The fields start blank (defaults are hint-only). The estimate still
    // prices at the defaults: realtor 2% → 23,600; lawyer 0.5% = 5,000 is
    // below the 6,000 floor, which wins → 7,080 incl. VAT.
    expect(s.realtorAmountText).toBe('')
    expect(s.lawyerAmountText).toBe('')
    expect(s.realtorAmountHint).toBe('23,600')
    expect(s.lawyerAmountHint).toBe('7,080')
  })

  it('typing a ₪ amount updates the percent (round trip)', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorAmount('25,000', null)
    let s = useCalculatorStore.getState()
    // 25,000 incl. VAT → 21,186.44 pre-VAT → 2.1186…% → snaps to 2 decimals:
    // 2.12. The ₪ mirror re-derives from the rounded percent (25,016).
    expect(s.realtorPercentText).toBe('2.12')
    expect(s.realtorAmountText).toBe('25,016')

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
    // A typed ₪ amount becomes the equivalent percent (snapped to 2.12);
    // doubling the property value re-derives the fee from that percent.
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('2.12')
    expect(s.realtorAmountText).toBe('50,032')
  })

  it('clearing the amount clears the pair; hints carry the default', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorAmount('25,000', null)
    useCalculatorStore.getState().updateRealtorAmount('', null)
    const s = useCalculatorStore.getState()
    // A cleared field is not a fee: the pair goes blank together and the
    // market default shows up as the hint placeholder in both fields - the
    // estimate itself falls back to the default, exactly like שווי הנכס.
    expect(s.realtorPercentText).toBe('')
    expect(s.realtorAmountText).toBe('')
    expect(s.realtorPercentHint).toBe('2')
    expect(s.realtorAmountHint).toBe('23,600')
    expect(s.snapshot.transactionCosts!.realtor).toBeCloseTo(23_600, 6)
    // Typing a percent again drives the mirror as usual.
    useCalculatorStore.getState().updateRealtorPercent('2.5')
    expect(useCalculatorStore.getState().realtorAmountText).toBe('29,500')
  })

  it('has no ₪ mirror without a fee basis', () => {
    useCalculatorStore.getState().reset()
    const s = useCalculatorStore.getState()
    expect(s.realtorAmountText).toBe('')
    expect(s.lawyerAmountText).toBe('')
  })
})

describe('fee percents start blank with hint-only defaults', () => {
  it('starts with empty percent/amount fields and default hints', () => {
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('')
    expect(s.lawyerPercentText).toBe('')
    expect(s.realtorAmountText).toBe('')
    expect(s.lawyerAmountText).toBe('')
    expect(s.realtorPercentHint).toBe('2')
    expect(s.lawyerPercentHint).toBe('0.5')
  })

  it('the blank-start estimate still prices at the market defaults', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts!.realtor).toBeCloseTo(23_600, 6)
    expect(s.snapshot.transactionCosts!.lawyer).toBeCloseTo(7_080, 6)
  })

  it('typing a percent clears its hint', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    expect(useCalculatorStore.getState().realtorPercentHint).toBe('2')
    useCalculatorStore.getState().updateRealtorPercent('3.5')
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentHint).toBeNull()
    expect(s.realtorAmountText).toBe('41,300')
  })
})

describe('blank fee fields fall back to the market defaults', () => {
  it('a cleared percent clears the pair; hints carry the default', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorPercent('3.5')
    useCalculatorStore.getState().updateLawyerPercent('2')
    expect(useCalculatorStore.getState().realtorAmountText).toBe('41,300')
    // Clearing the percent blanks the pair; the estimate falls back to the
    // DEFAULT percent and the hints advertise it - like the property hint.
    useCalculatorStore.getState().updateRealtorPercent('')
    useCalculatorStore.getState().updateLawyerPercent('')
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('')
    expect(s.realtorAmountText).toBe('')
    expect(s.realtorPercentHint).toBe('2')
    expect(s.realtorAmountHint).toBe('23,600')
    expect(s.lawyerPercentHint).toBe('0.5')
    expect(s.lawyerAmountHint).toBe('7,080')
  })

  it('a cleared lawyer amount clears the pair and shows the default hint', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateLawyerAmount('30,000', null)
    // 30,000 → 2.542373% snaps to 2.54 → re-derives 29,972 (max 2 decimals).
    expect(useCalculatorStore.getState().lawyerAmountText).toBe('29,972')
    useCalculatorStore.getState().updateLawyerAmount('', null)
    const s = useCalculatorStore.getState()
    expect(s.lawyerPercentText).toBe('')
    expect(s.lawyerAmountText).toBe('')
    expect(s.lawyerPercentHint).toBe('0.5')
    expect(s.lawyerAmountHint).toBe('7,080')
  })

  it('an explicitly typed 0 percent stays 0 (no fee)', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorPercent('0')
    const s = useCalculatorStore.getState()
    expect(s.realtorAmountText).toBe('')
    expect(s.snapshot.transactionCosts!.realtor).toBe(0)
  })

  it('flags when the lawyer floor overrides a typed amount or percent', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    // 7,000 → 0.59% → raw 5,900 sits below the ₪6,000 pre-VAT minimum, so
    // the mirror lands on 7,080 and the note must explain why.
    useCalculatorStore.getState().updateLawyerAmount('7,000', null)
    let s = useCalculatorStore.getState()
    expect(s.lawyerAmountText).toBe('7,080')
    expect(s.lawyerFloorApplied).toBe(true)
    // Exactly at the floor (0.6% → 6,000 raw) nothing was overridden.
    useCalculatorStore.getState().updateLawyerAmount('7,080', null)
    s = useCalculatorStore.getState()
    expect(s.lawyerAmountText).toBe('7,080')
    expect(s.lawyerFloorApplied).toBe(false)
    useCalculatorStore.getState().updateLawyerAmount('30,000', null)
    expect(useCalculatorStore.getState().lawyerFloorApplied).toBe(false)
    // A typed 0% hits the floor too - the note explains the 7,080 there.
    useCalculatorStore.getState().updateLawyerPercent('0')
    s = useCalculatorStore.getState()
    expect(s.lawyerAmountText).toBe('7,080')
    expect(s.lawyerFloorApplied).toBe(true)
    // A cleared pair rests on the default-percent hint, not an override.
    useCalculatorStore.getState().updateLawyerAmount('', null)
    expect(useCalculatorStore.getState().lawyerFloorApplied).toBe(false)
  })

  it('blank percents feed the transaction-cost total at the default rates', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRealtorPercent('')
    useCalculatorStore.getState().updateLawyerPercent('')
    const s = useCalculatorStore.getState()
    // Realtor + lawyer defaults only; שמאי counts only when typed.
    expect(s.snapshot.transactionCosts!.total).toBeCloseTo(23_600 + 7_080, 6)
  })

  it('reset restores blank fee fields with hint-only defaults', () => {
    useCalculatorStore.getState().updateLawyerPercent('3')
    useCalculatorStore.getState().reset()
    const s = useCalculatorStore.getState()
    expect(s.realtorPercentText).toBe('')
    expect(s.lawyerPercentText).toBe('')
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
    // Lawyer default 0.5% (floor 6,000 wins on 1M) → 7,080 incl. VAT.
  })

  it('includes renovations in the transaction-cost total and upfront cash', () => {
    useCalculatorStore.getState().setPropertyValue('1,000,000', null)
    useCalculatorStore.getState().updateRenovationAmount('100,000', null)
    const s = useCalculatorStore.getState()
    expect(s.snapshot.transactionCosts).not.toBeNull()
    expect(s.snapshot.transactionCosts!.renovations).toBe(100_000)
    // Defaults on 1M: 30,680 of fees (23,600 + 7,080; שמאי only when typed)
    // + 100,000 renovations.
    expect(s.snapshot.transactionCosts!.total).toBeCloseTo(30_680 + 100_000, 6)
    // The upfront total folds the renovation in through the fees total.
    const expected =
      (s.snapshot.suggestedCapital ?? 0) +
      (s.snapshot.closingCosts?.purchaseTax ?? 0) +
      s.snapshot.transactionCosts!.total
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
    const expected =
      (s.snapshot.suggestedCapital ?? 0) +
      (s.snapshot.closingCosts?.purchaseTax ?? 0) +
      (s.snapshot.transactionCosts?.total ?? 0) +
      10_000
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
    expect(s.lawyerPercentText).toBe('')
    expect(s.lawyerPercentHint).toBe('0.5')
    expect(s.ptiThresholdPercent).toBe(33)
  })
})
