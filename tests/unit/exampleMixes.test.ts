/**
 * Reference scenarios taken from the real Israeli bank quotes in `examples/`
 * (pre-approvals dated October-November 2026). They are the "sample scenarios"
 * the app's engine is checked against: each track is entered with the amount,
 * term and NOMINAL annual rate printed on the quote, and the expected payment
 * is the quote's own first-month payment.
 *
 * The nominal/effective distinction is the point of several cases: Israeli
 * quotes print the matched (effective) annual rate first and the nominal rate
 * underneath ("4.34% מתואמת / 4.33% נומינלית"). The calculator's rate field is
 * nominal - it divides by 12 - and its `effectiveAnnualRatePercent` helper is
 * what reproduces the quote's matched figure. Feeding a quote's matched rate
 * into the field therefore overstates the payment by roughly 0.1pp.
 *
 * Some tracks are "משתנה כל שנתיים" (2+2) or "כל 18 חודשים"; the app has no
 * reset-frequency field, so the closest existing type is used. The amortization
 * math is identical (a constant rate per period), so the payment checks still
 * hold; the missing reset cadence is recorded in docs/MASTER PLAN.md.
 *
 * Prime tracks depend on the bank's pricing basis. Leumi and Discount price
 * prime at the nominal rate divided by 12 (both reproduce to the agora), and
 * Hapoalim's mixes imply the same. Mizrahi prices prime at the MATCHED rate
 * divided by 12: its six prime tracks in this batch imply 0.074-0.082pp above
 * the printed nominal, which is exactly the nominal-to-effective gap (4.25%
 * nominal is 4.3338% matched). Each prime track below carries the basis its
 * bank used, so the assertions stay tight instead of tolerating 1%.
 *
 * Totals: the quote's per-track lifetime total (row 10) is NOT always the
 * first payment times the term - it runs up to ~0.05% above it even for a
 * fixed, unindexed track, and much higher for variable tracks whose quote
 * projects future rate rises. The fixed tracks are asserted here with that
 * tolerance; variable-track totals are deliberately not asserted.
 */
import { describe, expect, it } from 'vitest'
import {
  computeTrackResult,
  effectiveAnnualRatePercent,
  type TrackType,
} from '@/lib/amortization'

interface ReferenceTrack {
  /** The track name as the quote labels it. */
  label: string
  /** App track type closest to the quoted track. */
  type: TrackType
  principal: number
  months: number
  /** Nominal annual rate, percent (the lower of the quote's two figures). */
  nominalRate: number
  /**
   * How the bank priced this prime track: nominal/12 (Leumi, Discount,
   * Hapoalim) or matched/12 (Mizrahi). Ignored for non-prime tracks.
   */
  primeBasis?: 'nominal' | 'effective'
  /** The quote's first-month payment. */
  payment: number
  /** The quote's per-track lifetime total, when it is usable for a fixed track. */
  total?: number
}

interface ReferenceMix {
  /** Source image file under examples/. */
  source: string
  bank: string
  loan: number
  /** The quote's combined first-month payment. */
  firstPayment: number
  tracks: ReferenceTrack[]
}

const MIXES: ReferenceMix[] = [
  {
    source: 'WhatsApp Image 2026-11-06 at 10.50.35.jpeg',
    bank: 'Mizrahi Tefahot',
    loan: 900_000,
    firstPayment: 5_875.94,
    tracks: [
      {
        label: 'קבועה לא צמודה',
        type: 'fixed',
        principal: 301_000,
        months: 204,
        nominalRate: 4.53,
        payment: 2_118.49,
        total: 432_291.56,
      },
      {
        label: 'משתנה לא צמודה, כל שנתיים, אג"ח',
        type: 'variable',
        principal: 349_000,
        months: 240,
        nominalRate: 4.45,
        payment: 2_198.54,
      },
      {
        label: 'משתנה פריים',
        type: 'prime',
        primeBasis: 'effective',
        principal: 250_000,
        months: 240,
        nominalRate: 4.25,
        payment: 1_558.91,
      },
    ],
  },
  {
    source: 'WhatsApp Image 2026-11-06 at 10.49.58.jpeg',
    bank: 'Leumi',
    loan: 1_000_000,
    firstPayment: 10_165.13,
    tracks: [
      {
        label: 'קבועה לא צמודה',
        type: 'fixed',
        principal: 334_000,
        months: 120,
        nominalRate: 4.55,
        payment: 3_469.58,
        total: 416_469.84,
      },
      {
        label: 'משתנה פריים',
        type: 'prime',
        primeBasis: 'nominal',
        principal: 666_000,
        months: 120,
        nominalRate: 3.85,
        payment: 6_695.55,
      },
    ],
  },
  {
    // This quote prints both rates per track; the effective one is asserted
    // against effectiveAnnualRatePercent below.
    source: 'WhatsApp Image 2026-11-06 at 10.49.39.jpeg',
    bank: 'Discount',
    loan: 1_185_000,
    firstPayment: 7_084.68,
    tracks: [
      {
        label: 'קבועה לא צמודה',
        type: 'fixed',
        principal: 395_001,
        months: 240,
        nominalRate: 4.55,
        payment: 2_509.64,
        total: 602_435.53,
      },
      {
        label: 'פריים דיור',
        type: 'prime',
        primeBasis: 'nominal',
        principal: 354_999,
        months: 264,
        nominalRate: 3.95,
        payment: 2_014.61,
      },
      {
        label: '2+2 משתנה לא צמודה',
        type: 'variable',
        principal: 435_000,
        months: 264,
        nominalRate: 4.34,
        payment: 2_560.43,
      },
    ],
  },
  {
    source: 'WhatsApp Image 2026-11-06 at 10.51.03.jpeg',
    bank: 'Mizrahi Tefahot',
    loan: 1_200_000,
    firstPayment: 6_463.19,
    tracks: [
      {
        label: 'קבועה לא צמודה',
        type: 'fixed',
        principal: 400_500,
        months: 240,
        nominalRate: 4.65,
        payment: 2_566.30,
        total: 616_033.54,
      },
      {
        label: 'משתנה לא צמודה, כל שנתיים, אג"ח',
        type: 'variable',
        principal: 499_500,
        months: 360,
        nominalRate: 4.23,
        payment: 2_451.39,
      },
      {
        label: 'משתנה פריים',
        type: 'prime',
        primeBasis: 'effective',
        principal: 300_000,
        months: 360,
        nominalRate: 4.0,
        payment: 1_445.50,
      },
    ],
  },
  {
    source: 'WhatsApp Image 2026-11-06 at 09.20.11.jpeg',
    bank: 'Leumi',
    loan: 350_000,
    firstPayment: 5_516.16,
    tracks: [
      {
        label: 'משתנה לא צמודה, כל שנתיים',
        type: 'variable',
        principal: 210_000,
        months: 72,
        nominalRate: 4.42,
        payment: 3_325.83,
      },
      {
        label: 'קבועה לא צמודה',
        type: 'fixed',
        principal: 140_000,
        months: 72,
        nominalRate: 4.0,
        payment: 2_190.33,
        total: 157_703,
      },
    ],
  },
]

/** Payment tolerance for fixed, variable and nominal-basis prime tracks (agorot). */
const PAYMENT_TOLERANCE = 0.03
/** Matched-basis prime tracks reproduce to a relative 0.05% (rounding of the matched rate). */
const MATCHED_PRIME_TOLERANCE = 0.0005

/** The annual rate the bank actually divided by 12 for this track. */
function quoteAnnualRate(track: ReferenceTrack): number {
  return track.type === 'prime' && track.primeBasis === 'effective'
    ? effectiveAnnualRatePercent(track.nominalRate)
    : track.nominalRate
}

function quotePayment(track: ReferenceTrack): number {
  const result = computeTrackResult({
    principal: track.principal,
    years: track.months / 12,
    annualRatePercent: quoteAnnualRate(track),
    type: track.type,
    method: 'spitzer',
  })
  return result?.firstPayment ?? NaN
}

describe('example mixes from the bank quotes', () => {
  it.each(MIXES.flatMap((mix) => mix.tracks.map((track) => [mix.bank, track] as const)))(
    '%s: %s pays the quoted first payment',
    (_bank, track) => {
      const payment = quotePayment(track)
      expect(Number.isFinite(payment)).toBe(true)
      if (track.type === 'prime' && track.primeBasis === 'effective') {
        expect(Math.abs(payment - track.payment) / track.payment).toBeLessThan(
          MATCHED_PRIME_TOLERANCE,
        )
      } else {
        expect(Math.abs(payment - track.payment)).toBeLessThan(PAYMENT_TOLERANCE)
      }
    },
  )

  it('prices the fixed and unlinked-variable tracks to the agora', () => {
    // The tracks where the quote's printed rate reproduces its payment exactly.
    const exact = MIXES.flatMap((mix) => mix.tracks).filter(
      (track) => track.type === 'fixed' || track.type === 'variable',
    )
    expect(exact.length).toBeGreaterThanOrEqual(6)
    for (const track of exact) {
      const result = computeTrackResult({
        principal: track.principal,
        years: track.months / 12,
        annualRatePercent: track.nominalRate,
        type: track.type,
        method: 'spitzer',
      })
      expect(result).not.toBeNull()
      expect(Math.abs(result!.firstPayment - track.payment)).toBeLessThan(PAYMENT_TOLERANCE)
    }
  })

  it.each(MIXES.map((mix) => [mix.bank, mix] as const))(
    '%s: the mix first payment is the sum of its tracks',
    (_bank, mix) => {
      const total = mix.tracks.reduce((sum, track) => sum + quotePayment(track), 0)
      // Every track uses the basis its bank used, so the mix adds up tightly.
      expect(Math.abs(total - mix.firstPayment) / mix.firstPayment).toBeLessThan(0.0005)
      // The tracks add up to the loan the quote states.
      expect(mix.tracks.reduce((sum, track) => sum + track.principal, 0)).toBe(mix.loan)
    },
  )

  it.each(
    MIXES.flatMap((mix) =>
      mix.tracks.filter((track) => track.total !== undefined).map((track) => [track] as const),
    ),
  )(
    'fixed track total stays within 0.05%% of the quote ($label)',
    (track) => {
      const result = computeTrackResult({
        principal: track.principal,
        years: track.months / 12,
        annualRatePercent: track.nominalRate,
        type: track.type,
        method: 'spitzer',
      })
      expect(result).not.toBeNull()
      // The quote's lifetime total is never below the payment times the term;
      // the small excess is unexplained by the quote (no per-track fee line),
      // so it is tolerated rather than modelled.
      expect(result!.totalPaid).toBeGreaterThanOrEqual(
        track.payment * track.months - PAYMENT_TOLERANCE * track.months,
      )
      expect(Math.abs(result!.totalPaid - track.total!) / track.total!).toBeLessThan(0.0005)
    },
  )

  it('reproduces the quote matched (effective) rate from the nominal one', () => {
    // Discount prints 4.65% מתואמת / 4.55% נומינלית and 4.43% / 4.34%.
    expect(effectiveAnnualRatePercent(4.55)).toBeCloseTo(4.65, 2)
    expect(effectiveAnnualRatePercent(4.34)).toBeCloseTo(4.43, 2)
  })

  it('documents each bank prime basis: Leumi nominal, Mizrahi matched', () => {
    const mizrahiPrime = MIXES.find((mix) => mix.bank === 'Mizrahi Tefahot')!.tracks.find(
      (track) => track.type === 'prime',
    )!
    const leumiPrime = MIXES.find((mix) => mix.bank === 'Leumi')!.tracks.find(
      (track) => track.type === 'prime',
    )!
    // Leumi's payment is nominal/12.
    expect(quotePayment(leumiPrime)).toBeCloseTo(leumiPrime.payment, 2)
    // Mizrahi's is matched/12: 4.25 nominal -> 4.3338 matched -> 1,559.28.
    expect(quotePayment(mizrahiPrime)).toBeCloseTo(mizrahiPrime.payment, 0)
    // Pricing that track on the nominal rate understates it by about 0.7%.
    const nominalOnly = computeTrackResult({
      principal: mizrahiPrime.principal,
      years: mizrahiPrime.months / 12,
      annualRatePercent: mizrahiPrime.nominalRate,
      type: 'prime',
      method: 'spitzer',
    })!.firstPayment
    expect((mizrahiPrime.payment - nominalOnly) / mizrahiPrime.payment).toBeGreaterThan(0.005)
  })
})
