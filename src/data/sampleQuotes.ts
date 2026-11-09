import { effectiveAnnualRatePercent, type TrackType } from '@/lib/amortization'
import { formatGroupedNumber } from '@/lib/format'
import type { SavedTrackInput } from '@/stores/calculatorStore'

/**
 * The six reference quotes recorded in `tests/unit/exampleMixes.test.ts` that the engine is tested
 * against. They are loaded into the calculator as an UNSAVED mix (never as a
 * preset): presets are shared with the comparison page and an article, while
 * these are dated bank offers. Original image filenames are recorded in that
 * test; not all source images are present in every checkout.
 *
 * The rate stored is the one the APP divides by 12. That is the quote's
 * nominal figure for fixed, unlinked-variable, Leumi/Discount prime tracks,
 * and the matched figure for Mizrahi prime tracks (its sheets price prime on
 * the matched basis). Amounts and terms are exactly as printed.
 */
export type SampleQuoteBank = 'mizrahi' | 'leumi' | 'discount'

export interface SampleQuote {
  id: string
  bank: SampleQuoteBank
  /** The quote date as printed on the sheet (DD/MM/YYYY). */
  date: string
  loan: number
  /** The quote's own combined first-month payment, for the verification test. */
  firstPayment: number
  tracks: SavedTrackInput[]
}

function track(
  type: TrackType,
  amount: number,
  years: number,
  rate: number,
  resetMonths = 0,
): SavedTrackInput {
  return {
    type,
    amountText: formatGroupedNumber(amount),
    yearsText: String(years),
    rateText: rate.toFixed(2),
    resetMonths,
    graceMonths: 0,
    graceMode: 'interestOnly',
    marginText: '',
    method: 'spitzer',
  }
}

/** The annual rate the bank actually divided by 12 for this track. */
function primeRate(nominalRate: number): number {
  return effectiveAnnualRatePercent(nominalRate)
}

export const SAMPLE_QUOTES: SampleQuote[] = [
  {
    id: 'mizrahi-900k-2026-11-06',
    bank: 'mizrahi',
    date: '06/11/2026',
    loan: 900_000,
    firstPayment: 5_875.94,
    tracks: [
      track('fixed', 301_000, 17, 4.53),
      track('variable', 349_000, 20, 4.45, 24),
      // Mizrahi prices prime on the matched basis: 4.25% nominal -> 4.33%.
      track('prime', 250_000, 20, primeRate(4.25)),
    ],
  },
  {
    id: 'leumi-1m-2026-11-06',
    bank: 'leumi',
    date: '06/11/2026',
    loan: 1_000_000,
    firstPayment: 10_165.13,
    tracks: [
      track('fixed', 334_000, 10, 4.55),
      track('prime', 666_000, 10, 3.85),
    ],
  },
  {
    id: 'leumi-1.3m-2026-11-06',
    bank: 'leumi',
    date: '06/11/2026',
    loan: 1_300_000,
    firstPayment: 7_935.42,
    tracks: [
      track('fixed', 434_000, 15, 4.45),
      // Annual variable (מק"מ), so the reset is 12 months, not the 24 the
      // five-year type defaults to.
      track('variable', 433_000, 25, 4.23, 12),
      track('prime', 433_000, 25, 4.0),
    ],
  },
  {
    id: 'discount-1185k-2026-11-06',
    bank: 'discount',
    date: '06/11/2026',
    loan: 1_185_000,
    firstPayment: 7_084.68,
    tracks: [
      track('fixed', 395_001, 20, 4.55),
      track('prime', 354_999, 22, 3.95),
      track('variable', 435_000, 22, 4.34, 24),
    ],
  },
  {
    id: 'mizrahi-1.2m-2026-11-06',
    bank: 'mizrahi',
    date: '06/11/2026',
    loan: 1_200_000,
    firstPayment: 6_463.19,
    tracks: [
      track('fixed', 400_500, 20, 4.65),
      track('variable', 499_500, 30, 4.23, 24),
      // 4.00% nominal -> 4.07% matched.
      track('prime', 300_000, 30, primeRate(4.0)),
    ],
  },
  {
    id: 'leumi-350k-2026-11-06',
    bank: 'leumi',
    date: '06/11/2026',
    loan: 350_000,
    firstPayment: 5_516.16,
    tracks: [
      track('variable', 210_000, 6, 4.42, 24),
      track('fixed', 140_000, 6, 4.0),
    ],
  },
]

/** The scenario term is the longest track term, so every per-track term fits. */
export function sampleQuoteTermYears(quote: SampleQuote): number {
  return Math.max(...quote.tracks.map((track) => Number(track.yearsText) || 0))
}
