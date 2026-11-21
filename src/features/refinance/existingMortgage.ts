import { z } from 'zod'
import {
  GRACE_MODES,
  MAX_TRACKS,
  MAX_YEARS,
  TRACK_TYPES,
  type TrackType,
} from '@/lib/amortization'
import { parseDateOnly } from '@/lib/rateValidity'

/**
 * The existing mortgage, modelled separately from a new mix.
 *
 * An existing loan is a different kind of record from a proposed scenario: it
 * describes a contract that already exists, and it must never be overwritten
 * when the user builds a refinance. This module therefore has its own schema,
 * its own unknown-value convention, and no dependency on the calculator or
 * comparison stores.
 *
 * UNKNOWN IS EXPLICIT
 * Every field that may be missing from a payoff statement is `null`, never 0,
 * an empty string, or a guessed default. `dataStatus` records how much of the
 * record has actually been reviewed. A total payoff balance is only produced
 * when every track's current balance is known; a partial sum is not a payoff
 * figure and must not be presented as one.
 *
 * Dates are date-only strings in YYYY-MM-DD form, normalized by `parseDateOnly`
 * so a calendar date never shifts through a time zone.
 */

export const EXISTING_MORTGAGE_DATA_STATUSES = [
  'verified',
  'userReviewed',
  'partial',
  'unknown',
] as const
export type ExistingMortgageDataStatus = (typeof EXISTING_MORTGAGE_DATA_STATUSES)[number]

export const LINKAGE_TYPES = ['unlinked', 'cpi'] as const
export type LinkageType = (typeof LINKAGE_TYPES)[number]

export const RATE_BASES = ['annualNominal', 'annualEffective'] as const
export type RateBasis = (typeof RATE_BASES)[number]

export const MAX_EXISTING_TRACKS = MAX_TRACKS
export const MAX_HISTORICAL_RESETS = 120
const MAX_MONEY = 1_000_000_000_000
const MAX_RATE_PERCENT = 100
const MAX_TEXT = 60

/** The linkage a track type implies; null when the type itself is unknown. */
export function linkageForTrackType(type: TrackType | null): LinkageType | null {
  if (type === null) return null
  return type === 'fixedIndexed' ||
    type === 'variableIndexed' ||
    type === 'variableIndexed5y'
    ? 'cpi'
    : 'unlinked'
}

const dateOnly = z
  .string()
  .max(10)
  .refine((value) => parseDateOnly(value) !== null, {
    message: 'date must be a real YYYY-MM-DD value',
  })

const money = z.number().finite().min(0).max(MAX_MONEY)
const rate = z.number().finite().min(0).max(MAX_RATE_PERCENT)
const termMonths = z.number().int().min(1).max(MAX_YEARS * 12)
const resetCadence = z.number().int().min(0).max(120)

export const historicalResetSchema = z
  .object({
    /** The contractual reset date. */
    date: dateOnly,
    /** The rate before the reset, when the document states it. */
    rateBefore: rate.nullable(),
    /** The rate after the reset, when the document states it. */
    rateAfter: rate.nullable(),
  })
  .strict()

export const existingMortgageTrackSchema = z
  .object({
    id: z.string().min(1).max(MAX_TEXT),
    label: z.string().trim().max(MAX_TEXT).nullable(),
    /** Null when the document does not establish the exact track type. */
    type: z.enum(TRACK_TYPES).nullable(),
    /** Captured explicitly so a document that states linkage can still be used
        when the exact track type is unknown. Must agree with `type` when both
        are known. */
    linkage: z.enum(LINKAGE_TYPES).nullable(),

    /** Current outstanding principal at `asOfDate`. Null means not verified. */
    currentBalance: money.nullable(),
    originalPrincipal: money.nullable(),
    originalStartDate: dateOnly.nullable(),
    originalTermMonths: termMonths.nullable(),
    /** Remaining payments as of `asOfDate`, when the statement states them. */
    remainingMonths: termMonths.nullable(),

    /** The rate data needed to price a payoff fee. */
    contractedAnnualRate: rate.nullable(),
    marginPercent: rate.nullable(),
    rateBasis: z.enum(RATE_BASES).nullable(),

    method: z.enum(['spitzer', 'equalPrincipal']).nullable(),
    resetMonths: resetCadence.nullable(),
    lastRateResetDate: dateOnly.nullable(),
    nextRateResetDate: dateOnly.nullable(),
    /** Historical resets in ascending date order. Archived, never recomputed. */
    historicalResets: z.array(historicalResetSchema).max(MAX_HISTORICAL_RESETS),

    graceMonths: z.number().int().min(0).max(MAX_YEARS * 12).nullable(),
    graceMode: z.enum(GRACE_MODES).nullable(),

    /** Contractual end date. The date the loan is paid off if held to term. */
    maturityDate: dateOnly.nullable(),
    dataStatus: z.enum(EXISTING_MORTGAGE_DATA_STATUSES),
  })
  .strict()
  .superRefine((track, context) => {
    const implied = linkageForTrackType(track.type)
    if (implied !== null && track.linkage !== null && implied !== track.linkage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkage'],
        message: 'linkage contradicts the track type',
      })
    }

    for (let index = 1; index < track.historicalResets.length; index++) {
      if (track.historicalResets[index].date <= track.historicalResets[index - 1].date) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['historicalResets', index, 'date'],
          message: 'historical resets must be in ascending date order',
        })
      }
    }

    if (
      track.lastRateResetDate !== null &&
      track.nextRateResetDate !== null &&
      track.nextRateResetDate <= track.lastRateResetDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextRateResetDate'],
        message: 'next reset must be after the last reset',
      })
    }

    if (track.graceMonths !== null && track.originalTermMonths !== null) {
      if (track.graceMonths > track.originalTermMonths) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['graceMonths'],
          message: 'grace cannot exceed the original term',
        })
      }
    }
  })

export const existingMortgageSchema = z
  .object({
    id: z.string().min(1).max(MAX_TEXT),
    label: z.string().trim().min(1).max(MAX_TEXT),
    /** The statement date the balances belong to. */
    asOfDate: dateOnly,
    /** Explicitly unknown unless a verified payoff statement provides it. */
    totalPayoffBalance: money.nullable(),
    tracks: z
      .array(existingMortgageTrackSchema)
      .min(1)
      .max(MAX_EXISTING_TRACKS),
    sourceDocumentIds: z.array(z.string().min(1).max(MAX_TEXT)).max(20),
    dataStatus: z.enum(EXISTING_MORTGAGE_DATA_STATUSES),
  })
  .strict()

export type HistoricalReset = z.infer<typeof historicalResetSchema>
export type ExistingMortgageTrack = z.infer<typeof existingMortgageTrackSchema>
export type ExistingMortgage = z.infer<typeof existingMortgageSchema>

/**
 * A payoff total is either verified as a whole or unknown. A sum of the known
 * tracks would look like a payoff figure while silently omitting the rest, so
 * any unknown balance makes the total null.
 */
export function totalKnownBalance(mortgage: ExistingMortgage): number | null {
  let total = 0
  for (const track of mortgage.tracks) {
    if (track.currentBalance === null) return null
    total += track.currentBalance
  }
  return total
}

/** The contract term in months from start to maturity, when both are known. */
export function originalTermMonthsFromDates(
  track: Pick<ExistingMortgageTrack, 'originalStartDate' | 'maturityDate'>,
): number | null {
  const startMs = track.originalStartDate ? parseDateOnly(track.originalStartDate) : null
  const maturityMs = track.maturityDate ? parseDateOnly(track.maturityDate) : null
  if (startMs === null || maturityMs === null || maturityMs <= startMs) return null
  const start = new Date(startMs)
  const maturity = new Date(maturityMs)
  return (
    (maturity.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (maturity.getUTCMonth() - start.getUTCMonth())
  )
}

/** A new track: every contract field unknown until the user or a document fills it. */
export function emptyExistingMortgageTrack(id: string): ExistingMortgageTrack {
  return {
    id,
    label: null,
    type: null,
    linkage: null,
    currentBalance: null,
    originalPrincipal: null,
    originalStartDate: null,
    originalTermMonths: null,
    remainingMonths: null,
    contractedAnnualRate: null,
    marginPercent: null,
    rateBasis: null,
    method: null,
    resetMonths: null,
    lastRateResetDate: null,
    nextRateResetDate: null,
    historicalResets: [],
    graceMonths: null,
    graceMode: null,
    maturityDate: null,
    dataStatus: 'unknown',
  }
}
