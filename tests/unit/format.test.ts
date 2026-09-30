import { describe, expect, it } from 'vitest'
import {
  constrainYearsText,
  formatAmountWithCaret,
  formatCurrency,
  formatGroupedNumber,
  formatRatePercent,
  formatRatio,
  isFeeAboveNorm,
  parseAmountText,
} from '@/lib/format'

describe('formatAmountWithCaret', () => {
  it('groups thousands and keeps a single dot', () => {
    expect(formatAmountWithCaret('1234567', null).text).toBe('1,234,567')
    expect(formatAmountWithCaret('1.2.3', null).text).toBe('1.23')
    expect(formatAmountWithCaret('', null).text).toBe('')
    expect(formatAmountWithCaret('₪,  ', null).text).toBe('')
  })

  it('restores the caret by digit count before the cursor', () => {
    // '123|4567' → 3 digits before caret; new text places cursor after the 3rd digit
    const result = formatAmountWithCaret('1234567', 3)
    expect(result.text).toBe('1,234,567')
    expect(result.caret).toBe(4)
  })

  it('keeps the caret after a typed separator position', () => {
    const result = formatAmountWithCaret('1000', 4)
    expect(result.text).toBe('1,000')
    expect(result.caret).toBe(5) // end of text
  })

  it('handles decimal typing without caret jumps', () => {
    expect(formatAmountWithCaret('12.', 3)).toEqual({ text: '12.', caret: 3 })
  })
})

describe('parseAmountText', () => {
  it('strips currency symbols, commas and whitespace', () => {
    expect(parseAmountText('₪1,234,567')).toBe(1_234_567)
    expect(parseAmountText(' 2 500 ')).toBe(2500)
    expect(parseAmountText('')).toBe(0)
    expect(parseAmountText('abc')).toBe(0)
  })
})

describe('number formatting parity with legacy', () => {
  it('uses he-IL ILS with no decimals for display', () => {
    expect(formatCurrency(1_000_000)).toContain('1,000,000')
    expect(formatCurrency(0)).toMatch(/0/)
  })

  it('degrades non-finite values to ₪0 instead of "NaN ₪" / "∞ ₪"', () => {
    expect(formatCurrency(NaN)).toBe(formatCurrency(0))
    expect(formatCurrency(Infinity)).toBe(formatCurrency(0))
    expect(formatCurrency(-Infinity)).toBe(formatCurrency(0))
  })
  it('uses en-US grouping inside inputs (legacy convention)', () => {
    expect(formatGroupedNumber(1234567)).toBe('1,234,567')
  })
})

describe('isFeeAboveNorm', () => {
  it('flags a realtor percent strictly above the 2% norm', () => {
    expect(isFeeAboveNorm('realtor', '2')).toBe(false)
    expect(isFeeAboveNorm('realtor', '2.01')).toBe(true)
    expect(isFeeAboveNorm('realtor', '3.5')).toBe(true)
    expect(isFeeAboveNorm('realtor', '0')).toBe(false)
  })

  it('flags a lawyer percent strictly above the 0.5% norm', () => {
    expect(isFeeAboveNorm('lawyer', '0.5')).toBe(false)
    expect(isFeeAboveNorm('lawyer', '1')).toBe(true)
    expect(isFeeAboveNorm('lawyer', '0')).toBe(false)
  })

  it('accepts blank-field text as the default (not above the norm)', () => {
    expect(isFeeAboveNorm('realtor', '')).toBe(false)
    expect(isFeeAboveNorm('lawyer', '')).toBe(false)
  })
})

describe('formatRatePercent', () => {
  it('keeps whole numbers whole and normal rates at 2 decimals', () => {
    expect(formatRatePercent(8)).toBe('8')
    expect(formatRatePercent(8.271)).toBe('8.27')
    expect(formatRatePercent(1.5)).toBe('1.5')
    expect(formatRatePercent(0)).toBe('0')
  })

  it('preserves precision on the real preset rates', () => {
    expect(formatRatePercent(5.75)).toBe('5.75')
    expect(formatRatePercent(4.25)).toBe('4.25')
    expect(formatRatePercent(3.0)).toBe('3')
  })

  it('rounds every rate to max 2 decimals', () => {
    expect(formatRatePercent(1.21231)).toBe('1.21')
    expect(formatRatePercent(8.271)).toBe('8.27')
    expect(formatRatePercent(2.11864407)).toBe('2.12')
  })

  it('applies the same 2-decimal cap to tiny rates', () => {
    expect(formatRatePercent(0.0372)).toBe('0.04')
    expect(formatRatePercent(0.1)).toBe('0.1')
    expect(formatRatePercent(0.0005)).toBe('0')
  })
})

describe('formatRatio', () => {
  it('keeps four decimals and trims trailing zeros', () => {
    expect(formatRatio(1.0617)).toBe('1.0617')
    expect(formatRatio(1.1422)).toBe('1.1422')
    expect(formatRatio(1)).toBe('1')
    expect(formatRatio(1.5)).toBe('1.5')
  })

  it('falls back to 0 for non-finite values', () => {
    expect(formatRatio(NaN)).toBe('0')
    expect(formatRatio(Infinity)).toBe('0')
  })
})

describe('constrainYearsText', () => {
  it('clamps to [1..30] on digits only', () => {
    expect(constrainYearsText('45', 30)).toBe('30')
    expect(constrainYearsText('007', 30)).toBe('7')
    expect(constrainYearsText('abc', 30)).toBe('')
    expect(constrainYearsText('', 30)).toBe('')
    expect(constrainYearsText('1', 30)).toBe('1')
  })
})
