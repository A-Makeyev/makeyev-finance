import { describe, expect, it } from 'vitest'
import { TYPICAL_PRIME_MARGIN_PERCENT, suggestPrimeMargin } from '@/lib/marketMargin'

describe('suggestPrimeMargin', () => {
  it('shows the spread when a prime track is priced away from prime', () => {
    expect(suggestPrimeMargin('prime', '4.05', 4.75)).toBe('-0.70')
    expect(suggestPrimeMargin('prime', '5.50', 4.75)).toBe('0.75')
  })

  it('falls back to the typical market margin while the rate is empty or at prime', () => {
    expect(TYPICAL_PRIME_MARGIN_PERCENT).toBe(-0.7)
    expect(suggestPrimeMargin('prime', '', 4.75)).toBe('-0.70')
    expect(suggestPrimeMargin('prime', '4.75', 4.75)).toBe('-0.70')
  })

  it('leaves non-prime tracks without a suggestion', () => {
    expect(suggestPrimeMargin('fixed', '5.00', 4.75)).toBe('')
    expect(suggestPrimeMargin('variable', '4.50', 4.75)).toBe('')
  })

  it('keeps the market suggestion when the live prime rate is unavailable', () => {
    expect(suggestPrimeMargin('prime', '4.05', null)).toBe('-0.70')
    expect(suggestPrimeMargin('prime', '4.05', Number.NaN)).toBe('-0.70')
  })

  it('ignores unusable rates instead of printing NaN', () => {
    expect(suggestPrimeMargin('prime', 'abc', 4.75)).toBe('-0.70')
    expect(suggestPrimeMargin('prime', '0', 4.75)).toBe('-0.70')
    expect(suggestPrimeMargin('prime', '200', 4.75)).toBe('-0.70')
  })
})
