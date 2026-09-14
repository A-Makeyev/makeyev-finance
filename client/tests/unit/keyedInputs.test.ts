import { beforeEach, describe, expect, it } from 'vitest'
import { useCalculatorStore } from '@/stores/calculatorStore'

/**
 * The keyed-digits route the calculator's inputs are actually used through:
 * each keystroke walks the stored text through ₪1, ₪10, ₪100 ... and the
 * derived figures must end on the same state as entering the value at once.
 * The property-value case (the mix drift) is covered by
 * propertyValueTyping.test.ts; these tests pin the loan, capital and income
 * fields to the same invariant: no drift, no lingering error, no stale
 * snapshot carried over from an intermediate keystroke state.
 */

const reset = () => useCalculatorStore.getState().reset()

beforeEach(reset)

type Setter = (raw: string, caret: number | null) => unknown

function typeInto(setter: Setter, digits: string): void {
  for (let length = 1; length <= digits.length; length++) {
    setter(digits.slice(0, length), null)
  }
}

interface KeyedState {
  tracks: string[]
  error: unknown
  firstPayment: number
  purchaseTax: number
  pti: unknown
}

function keyedState(): KeyedState {
  const s = useCalculatorStore.getState()
  return {
    tracks: s.tracks.map((track) => track.amountText),
    error: s.error,
    firstPayment: s.snapshot.totals.firstPayment,
    purchaseTax: s.snapshot.closingCosts?.purchaseTax ?? 0,
    pti: s.snapshot.pti,
  }
}

describe('loan typed key by key', () => {
  it('drives the same mix, payment and tax as entering the loan at once', () => {
    typeInto(useCalculatorStore.getState().setStartingAmount.bind(useCalculatorStore.getState()), '100000000')
    const typed = keyedState()

    reset()
    useCalculatorStore.getState().setStartingAmount('100,000,000', null)
    const pasted = keyedState()

    expect(typed).toEqual(pasted)
    expect(typed.error).toBeNull()
    // The recommended 40/34/26 mix, scaled: 66% variable, inside the 2/3 cap.
    expect(typed.tracks).toEqual(['40,000,000', '34,000,000', '26,000,000'])
    // No property typed, so the tax basis is the loan: 10% x the slice over
    // ₪20,183,565 puts the 💡 line and the ladder behind it at 9,310,215.
    expect(typed.purchaseTax).toBeCloseTo(9_310_214.925, 6)
  })
})

describe('capital typed key by key after the property', () => {
  it('scales the mix down and keeps the tax from the typed property', () => {
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    typeInto(useCalculatorStore.getState().setCapital.bind(useCalculatorStore.getState()), '500000')
    const typed = keyedState()

    reset()
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    useCalculatorStore.getState().setCapital('500,000', null)
    const pasted = keyedState()

    expect(typed).toEqual(pasted)
    expect(typed.error).toBeNull()
    // Loan = 2,000,000 - 500,000 = 1,500,000 in the preset's proportions.
    expect(typed.tracks).toEqual(['600,000', '510,000', '390,000'])
    // The tax still comes off the typed property value: 21,255 at 3.5% = 744.
    expect(typed.purchaseTax).toBeCloseTo(743.925, 6)
  })
})

describe('income typed key by key after the loan', () => {
  it('ends with the same checks as entering the income at once', () => {
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    typeInto(useCalculatorStore.getState().setIncome.bind(useCalculatorStore.getState()), '30000')
    const typed = keyedState()

    reset()
    useCalculatorStore.getState().setStartingAmount('1,000,000', null)
    useCalculatorStore.getState().setIncome('30,000', null)
    const pasted = keyedState()

    // Income never touches the tracks or the tax; the point is no stale
    // payment/PTI state survives the keystroke path.
    expect(typed).toEqual(pasted)
    expect(typed.error).toBeNull()
    expect(typed.tracks).toEqual(['400,000', '340,000', '260,000'])
    expect(typed.firstPayment).toBeCloseTo(7_718.13, 2)
  })
})