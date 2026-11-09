/**
 * The sample quotes the calculator menu loads must reproduce the printed
 * offers: the track amounts add up to the quoted loan, and the engine's
 * first-month payments add up to the quote's own combined first payment.
 *
 * These are the same dated bank offers as exampleMixes.test.ts, but this test
 * reads the actual `SAMPLE_QUOTES` objects the UI loads, so a typo in that
 * data cannot slip past the reference suite.
 */
import { describe, expect, it } from 'vitest'
import { computeTrackResult } from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
import { SAMPLE_QUOTES, sampleQuoteTermYears } from '@/data/sampleQuotes'

function firstPaymentOf(track: (typeof SAMPLE_QUOTES)[number]['tracks'][number]): number {
  const result = computeTrackResult({
    principal: parseAmountText(track.amountText),
    years: Number(track.yearsText),
    annualRatePercent: Number(track.rateText),
    type: track.type,
    method: track.method,
    graceMonths: track.graceMonths,
    graceMode: track.graceMode,
  })
  expect(result, `${track.type} ${track.amountText}`).not.toBeNull()
  return result!.firstPayment
}

describe('sample quotes loaded by the calculator', () => {
  it('has unique ids', () => {
    expect(new Set(SAMPLE_QUOTES.map((quote) => quote.id)).size).toBe(SAMPLE_QUOTES.length)
  })

  it.each(SAMPLE_QUOTES.map((quote) => [quote.id, quote] as const))(
    '%s: track amounts add up to the quoted loan',
    (_id, quote) => {
      const total = quote.tracks.reduce(
        (sum, track) => sum + parseAmountText(track.amountText),
        0,
      )
      expect(total).toBe(quote.loan)
    },
  )

  it.each(SAMPLE_QUOTES.map((quote) => [quote.id, quote] as const))(
    '%s: first-month payments add up to the quoted payment',
    (_id, quote) => {
      const total = quote.tracks.reduce((sum, track) => sum + firstPaymentOf(track), 0)
      // The quote's prime rates are stored rounded to two decimals, so the
      // matched-basis tracks can differ by a fraction of a shekel.
      expect(Math.abs(total - quote.firstPayment) / quote.firstPayment).toBeLessThan(0.0005)
    },
  )

  it.each(SAMPLE_QUOTES.map((quote) => [quote.id, quote] as const))(
    '%s: the scenario term covers every track',
    (_id, quote) => {
      const longest = Math.max(...quote.tracks.map((track) => Number(track.yearsText) || 0))
      expect(sampleQuoteTermYears(quote)).toBe(longest)
    },
  )
})
