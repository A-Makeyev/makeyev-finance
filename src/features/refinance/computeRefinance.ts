import {
  combineMonthlySchedules,
  combineSchedules,
  computeTrackResult,
  FALLBACK_INFLATION,
  MAX_TRACKS,
  MAX_YEARS,
  type AmortizationMethod,
  type CombinedMonthlyRow,
  type CombinedScheduleRow,
  type TrackType,
} from '@/lib/amortization'
import { compareCashFlows, type CashFlowComparison } from '@/features/compare/cashflow'
import { resetMonthsFor } from '@/lib/forecast'
import { parseDateOnly } from '@/lib/rateValidity'
import {
  existingMortgageTrackSchema,
  projectedResetMonths,
  type ExistingMortgageTrack,
} from './existingMortgage'

/**
 * Keep-versus-refinance projection for the /refinance page.
 *
 * The existing side is projected from each track's CURRENT balance and
 * remaining payments at its CURRENT rate. It is deliberately not a replay of
 * the original contract: historical resets are preserved in the record for
 * reference, but this projection assumes no future rate change unless the user
 * enters one. The page says that explicitly.
 *
 * The proposed side is one or more new unlinked tracks. The principal is the
 * total known balance plus the payoff fee when the fee is capitalized. Each
 * proposed track takes a PERCENTAGE share of that principal, so changing a
 * track's share never has to be reconciled against a separately typed total:
 * the amounts always sum to the principal exactly (largest-remainder
 * allocation keeps their whole-shekel values balanced).
 */

export const FEE_MODES = ['cash', 'capitalized'] as const
export type FeeMode = (typeof FEE_MODES)[number]

/** One proposed track, already parsed from its text inputs. */
export interface ProposedTrackInput {
  type: TrackType | null
  /** Share of the new principal in percent (0-100). */
  sharePercent: number | null
  /** Annual nominal rate in percent. */
  annualRatePercent: number | null
  termYears: number | null
  method: AmortizationMethod | null
  /** Contractual reset cadence in months; null falls back to the type default. */
  resetMonths: number | null
  /** Percent left for one payment at maturity; null/absent means none. */
  balloonPercent?: number | null
}

export interface RefinanceInput {
  existingLabel: string
  proposedLabel: string
  tracks: ExistingMortgageTrack[]
  proposedTracks: ProposedTrackInput[]
  /** A verified payoff fee from the bank, not a model estimate. */
  feeAmount: number
  feeMode: FeeMode
  /**
   * The date the projection starts (month 1), normally today. The existing
   * tracks' contractual resets are aligned to it, so a track whose next reset
   * is in 14 months resets in projected month 14, not at some cadence counted
   * from an arbitrary month zero.
   */
  asOfDate: string
  /**
   * Expected cumulative rate change in percentage points at EACH contractual
   * reset, applied to both sides. 0 (the default) holds every current rate
   * flat, which is the only defensible base case for an unknown future rate.
   */
  resetStepPercent?: number
}

export interface RefinanceSideSummary {
  monthlyPayment: number
  totalPaid: number
  totalInterest: number
  termMonths: number
  /** Principal due as one payment at maturity across the side's tracks. */
  balloonDue: number
  monthly: CombinedMonthlyRow[]
  schedule: CombinedScheduleRow[]
}

export interface RefinanceProjection {
  ready: boolean
  /** Field keys that block the calculation, e.g. `track-1:balance`. */
  missing: string[]
  totalBalance: number
  existing: RefinanceSideSummary | null
  proposed: RefinanceSideSummary | null
  /** The proposed principal after capitalization, before any cash fee. */
  proposedPrincipal: number
  /** Each proposed track's principal, in the same order as the input. */
  proposedAllocations: number[]
  comparison: CashFlowComparison | null
  /**
   * True when either side leaves a balloon. The cash-flow comparison only
   * covers the monthly payments, so its break-even is not a full-payoff
   * figure in that case and the page must say so.
   */
  hasBalloon: boolean
}

const EMPTY: RefinanceProjection = {
  ready: false,
  missing: [],
  totalBalance: 0,
  existing: null,
  proposed: null,
  proposedPrincipal: 0,
  proposedAllocations: [],
  comparison: null,
  hasBalloon: false,
}

function summary(
  results: NonNullable<ReturnType<typeof computeTrackResult>>[],
): RefinanceSideSummary {
  const monthly = combineMonthlySchedules(results)
  const schedule = combineSchedules(results)
  return {
    // The first month's actual cash payment across every track.
    monthlyPayment: monthly[0]?.paid ?? 0,
    totalPaid: monthly.reduce((sum, row) => sum + row.paid, 0),
    totalInterest: schedule.reduce((sum, row) => sum + row.interest, 0),
    termMonths: monthly.length,
    balloonDue: results.reduce((sum, result) => sum + result.balloonAmount, 0),
    monthly,
    schedule,
  }
}

/**
 * Splits `total` across `shares` so the parts sum to `total` exactly.
 *
 * Whole units are apportioned by the largest-remainder method (ties go to the
 * earlier track) and any fractional remainder lands on the first track. No part
 * is ever negative, which `round`-per-part plus a remainder can violate for
 * small totals.
 */
export function allocateByShares(total: number, shares: number[]): number[] {
  const count = shares.length
  if (count === 0) return []
  const shareSum = shares.reduce((sum, share) => sum + share, 0)
  if (!(shareSum > 0) || !(total > 0)) return shares.map(() => 0)

  const raw = shares.map((share) => (total * share) / shareSum)
  const amounts = raw.map((value) => Math.floor(value))
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)

  const gap = total - amounts.reduce((sum, amount) => sum + amount, 0)
  const wholeUnits = Math.floor(gap)
  for (let unit = 0; unit < wholeUnits; unit++) {
    amounts[order[unit % count].index] += 1
  }
  // A fractional total (a balance ending in agorot) leaves a sub-shekel gap;
  // the first track absorbs it so the allocation reconciles to the principal.
  amounts[order[0].index] += gap - wholeUnits
  return amounts
}

/**
 * Prices both sides. Returns `ready: false` with the blocking fields when any
 * existing track lacks a value needed to project it, or any proposed track
 * lacks a type, share, rate, term or method. It never fills a missing value
 * with a default.
 */
export function computeRefinance(input: RefinanceInput): RefinanceProjection {
  // Shared assumptions are validated once: if these are invalid, neither side
  // can be priced. A proposal's own fee is validated with that proposal, so a
  // bad fee never hides the existing side or another proposal.
  const resetStepPercent = input.resetStepPercent ?? 0
  if (!Number.isFinite(resetStepPercent) || resetStepPercent < -100 || resetStepPercent > 100) {
    return { ...EMPTY, missing: ['resetStep:invalid'] }
  }
  if (parseDateOnly(input.asOfDate) === null) {
    return { ...EMPTY, missing: ['asOf:invalid'] }
  }
  const existingMissing: string[] = []
  const proposedMissing: string[] = []
  const results: NonNullable<ReturnType<typeof computeTrackResult>>[] = []
  let totalBalance = 0

  for (const track of input.tracks) {
    const key = track.id
    // A clear blocking key for the one unsupported combination, instead of
    // lumping it into the generic schema error.
    if ((track.balloonPercent ?? null) !== null && (track.graceMonths ?? 0) > 0) {
      existingMissing.push(`${key}:balloonGrace`)
      continue
    }
    if (!existingMortgageTrackSchema.safeParse(track).success) {
      existingMissing.push(`${key}:invalid`)
      continue
    }
    if (track.currentBalance === null || track.currentBalance <= 0) {
      existingMissing.push(`${key}:balance`)
      continue
    }
    // The current balance already contains any balloon remainder, so it is
    // the payoff base the fee is computed from; nothing extra is added here.
    totalBalance += track.currentBalance
    if (track.contractedAnnualRate === null) existingMissing.push(`${key}:rate`)
    if (track.type === null) existingMissing.push(`${key}:type`)
    if (track.method === null) existingMissing.push(`${key}:method`)
    if (track.remainingMonths === null) existingMissing.push(`${key}:remainingMonths`)
    if (
      track.contractedAnnualRate === null ||
      track.type === null ||
      track.method === null ||
      track.remainingMonths === null
    ) {
      continue
    }

    const result = computeTrackResult({
      principal: track.currentBalance,
      years: track.remainingMonths / 12,
      termMonths: track.remainingMonths,
      annualRatePercent: track.contractedAnnualRate,
      type: track.type,
      method: track.method,
      resetMonths: track.resetMonths ?? 0,
      annualInflation: FALLBACK_INFLATION,
      // Reset-aware: the recorded calendar decides WHEN, the stated
      // assumption decides BY HOW MUCH. A step of 0 keeps the rate flat.
      rateResetMonths: projectedResetMonths(track, input.asOfDate, track.remainingMonths),
      rateStepPercent: resetStepPercent,
      balloonPercent: track.balloonPercent ?? null,
    })
    if (!result) {
      existingMissing.push(`${key}:invalid`)
      continue
    }
    results.push(result)
  }

  if (input.tracks.length === 0) existingMissing.push('existing:empty')
  if (input.tracks.length > MAX_TRACKS) existingMissing.push('existing:tooMany')

  // The existing side is priced independently of the proposal. A half-entered
  // proposal must not hide a complete keep-side projection, and in a set of
  // proposals each one can be compared as soon as it is complete.
  const existingComplete =
    existingMissing.length === 0 && results.length === input.tracks.length
  const existing = existingComplete ? summary(results) : null

  if (input.proposedTracks.length === 0) proposedMissing.push('proposed:empty')
  if (input.proposedTracks.length > MAX_TRACKS) proposedMissing.push('proposed:tooMany')
  const feeValid =
    Number.isFinite(input.feeAmount) &&
    input.feeAmount >= 0 &&
    input.feeAmount <= 1_000_000_000_000
  if (!feeValid) proposedMissing.push('fee:invalid')

  // Validate every proposed track before pricing any of them, so one bad rate
  // does not hide the rest of the fields the user still has to fill.
  input.proposedTracks.forEach((track, index) => {
    if (track.type === null) proposedMissing.push(`proposed:${index}:type`)
    if (
      track.sharePercent === null ||
      !Number.isFinite(track.sharePercent) ||
      track.sharePercent <= 0 ||
      track.sharePercent > 100
    ) {
      proposedMissing.push(`proposed:${index}:share`)
    }
    if (
      track.annualRatePercent === null ||
      !Number.isFinite(track.annualRatePercent) ||
      track.annualRatePercent < 0 ||
      track.annualRatePercent > 100
    ) {
      proposedMissing.push(`proposed:${index}:rate`)
    }
    if (
      track.termYears === null ||
      !Number.isInteger(track.termYears) ||
      track.termYears < 1 ||
      track.termYears > MAX_YEARS
    ) {
      proposedMissing.push(`proposed:${index}:term`)
    }
    if (track.method === null) proposedMissing.push(`proposed:${index}:method`)
    const balloonPercent = track.balloonPercent ?? null
    if (
      balloonPercent !== null &&
      (!Number.isFinite(balloonPercent) || balloonPercent <= 0 || balloonPercent > 100)
    ) {
      proposedMissing.push(`proposed:${index}:balloon`)
    }
  })

  const shareSum = input.proposedTracks.reduce(
    (sum, track) => sum + (track.sharePercent !== null && track.sharePercent > 0 ? track.sharePercent : 0),
    0,
  )
  if (input.proposedTracks.length > 0 && !(shareSum > 0)) {
    proposedMissing.push('proposed:shares')
  }

  // A rejected fee must never look like a free payoff, so it is not
  // capitalized and blocks the comparison until it is corrected.
  const capitalized = feeValid && input.feeMode === 'capitalized' ? input.feeAmount : 0
  const proposedPrincipal = totalBalance + capitalized
  const allocations =
    proposedPrincipal > 0 && input.proposedTracks.length > 0
      ? allocateByShares(
          proposedPrincipal,
          input.proposedTracks.map((track) =>
            track.sharePercent !== null && track.sharePercent > 0 ? track.sharePercent : 0,
          ),
        )
      : input.proposedTracks.map(() => 0)

  const proposedResults: NonNullable<ReturnType<typeof computeTrackResult>>[] = []
  if (existingComplete && proposedMissing.length === 0) {
    input.proposedTracks.forEach((track, index) => {
      const result = computeTrackResult({
        principal: allocations[index],
        years: track.termYears as number,
        termMonths: (track.termYears as number) * 12,
        annualRatePercent: track.annualRatePercent as number,
        type: track.type as TrackType,
        method: track.method as AmortizationMethod,
        resetMonths: track.resetMonths ?? undefined,
        annualInflation: FALLBACK_INFLATION,
        // The proposal's own new reset calendar starts at its first payment
        // month, and the same market assumption applies to it.
        rateResetMonths: resetMonthsFor(
          track.resetMonths ?? 0,
          track.termYears as number,
        ),
        rateStepPercent: resetStepPercent,
        balloonPercent: track.balloonPercent ?? null,
      })
      if (!result) {
        proposedMissing.push(`proposed:${index}:invalid`)
        return
      }
      proposedResults.push(result)
    })
  }

  const missing = [...new Set([...existingMissing, ...proposedMissing])]
  const ready =
    existingComplete &&
    proposedMissing.length === 0 &&
    proposedResults.length === input.proposedTracks.length

  if (!ready || existing === null) {
    return {
      ...EMPTY,
      missing,
      totalBalance,
      existing,
      proposedPrincipal,
      proposedAllocations: allocations,
    }
  }

  const proposed = summary(proposedResults)
  const comparison = compareCashFlows(
    {
      label: input.existingLabel,
      months: existing.monthly,
      // Staying put does not pay a refinance fee.
      fees: 0,
    },
    {
      label: input.proposedLabel,
      months: proposed.monthly,
      // A capitalized fee is already inside the principal; a cash fee is paid
      // once at closing, so it is added here and nowhere else.
      fees: input.feeMode === 'cash' ? input.feeAmount : 0,
    },
  )

  return {
    ready: true,
    missing: [],
    totalBalance,
    existing,
    proposed,
    proposedPrincipal,
    proposedAllocations: allocations,
    comparison,
    hasBalloon: existing.balloonDue > 0 || proposed.balloonDue > 0,
  }
}

/** One named proposed mix in a set of alternatives. */
export interface RefinanceProposalInput {
  id: string
  label: string
  proposedTracks: ProposedTrackInput[]
  feeAmount: number
  feeMode: FeeMode
}

export interface RefinanceProposalProjection extends RefinanceProjection {
  id: string
  label: string
}

export interface RefinanceSetProjection {
  /** The shared keep side, once its tracks are complete. */
  existing: RefinanceSideSummary | null
  totalBalance: number
  proposals: RefinanceProposalProjection[]
}

/**
 * Prices several named proposals against the same existing mortgage.
 *
 * Each proposal is independent: one incomplete or invalid proposal returns its
 * own blocking fields while the others, and the shared existing side, still
 * price normally. The existing summary is taken from the first projection that
 * could produce it; every copy is identical because it depends only on the
 * shared tracks and assumptions.
 */
export function computeRefinanceSet(input: {
  existingLabel: string
  tracks: ExistingMortgageTrack[]
  proposals: RefinanceProposalInput[]
  asOfDate: string
  resetStepPercent?: number
}): RefinanceSetProjection {
  const proposals = input.proposals.map((proposal) => ({
    id: proposal.id,
    label: proposal.label,
    ...computeRefinance({
      existingLabel: input.existingLabel,
      proposedLabel: proposal.label,
      tracks: input.tracks,
      proposedTracks: proposal.proposedTracks,
      feeAmount: proposal.feeAmount,
      feeMode: proposal.feeMode,
      asOfDate: input.asOfDate,
      resetStepPercent: input.resetStepPercent,
    }),
  }))

  const priced = proposals.find((proposal) => proposal.existing !== null)
  return {
    existing: priced?.existing ?? null,
    totalBalance: priced?.totalBalance ?? 0,
    proposals,
  }
}
