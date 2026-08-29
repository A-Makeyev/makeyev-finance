import { describe, expect, it } from 'vitest'
import {
  constrainYearsText,
  formatAmountWithCaret,
  formatCurrency,
  formatGroupedNumber,
  formatRatePercent,
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
  it('uses en-US grouping inside inputs (legacy convention)', () => {
    expect(formatGroupedNumber(1234567)).toBe('1,234,567')
  })
})

describe('formatRatePercent', () => {
  it('keeps whole numbers whole and normal rates at 1 decimal', () => {
    expect(formatRatePercent(8)).toBe('8')
    expect(formatRatePercent(8.271)).toBe('8.3')
    expect(formatRatePercent(1.5)).toBe('1.5')
    expect(formatRatePercent(0)).toBe('0')
  })

  it('never rounds tiny rates to 0.0% — shows 3 decimals instead', () => {
    expect(formatRatePercent(0.0372)).toBe('0.037')
    expect(formatRatePercent(0.1)).toBe('0.1')
    expect(formatRatePercent(0.0005)).toBe('0.001')
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
