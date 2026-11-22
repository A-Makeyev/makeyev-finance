import { z } from 'zod'
import { MAX_REFINANCE_OFFERS, MAX_TRACKS, MAX_YEARS, TRACK_TYPES } from '@/lib/amortization'
import { existingMortgageTrackSchema } from '@/features/refinance/existingMortgage'

/**
 * The persisted shape of a saved refinance plan, and the validation of
 * anything arriving from the client.
 *
 * Mirrors the saved-comparison schema: the server re-validates every field
 * because a hidden or disabled control in the UI is not access control. The
 * existing tracks reuse the existing-mortgage schema, so their explicit
 * unknown-value convention (`null`, never a guess) survives a round trip.
 *
 * Version 2 stores several independently named proposals against one shared
 * existing mortgage and one shared reset assumption. Version 1 stored a single
 * proposal at the top level; it is still accepted on read and normalized to a
 * one-proposal version 2 record, so saved work keeps loading.
 */

export const MAX_SAVED_REFINANCES = 4
export const MAX_REFINANCE_PROPOSALS = MAX_REFINANCE_OFFERS

export const MAX_REFINANCE_LABEL_LENGTH = 60

/** Saves are a deliberate action, but the endpoint still gets its own budget. */
export const REFINANCE_SAVE_RATE_LIMIT = { windowSeconds: 60, max: 20 } as const

const AMORTIZATION_METHODS = ['spitzer', 'equalPrincipal'] as const
const FEE_MODES = ['cash', 'capitalized'] as const
const MAX_MONEY = 1_000_000_000_000

export const refinanceProposedTrackSchema = z
  .object({
    type: z.enum(TRACK_TYPES),
    /** Share of the new principal, in percent; every proposed track must fund. */
    sharePercent: z.number().finite().gt(0).max(100),
    annualRatePercent: z.number().finite().min(0).max(100),
    termYears: z.number().int().min(1).max(MAX_YEARS),
    method: z.enum(AMORTIZATION_METHODS),
    resetMonths: z.number().int().min(0).max(120),
  })
  .strict()

/** One named proposal: its own tracks, fee and fee payment mode. */
export const refinanceProposalSnapshotSchema = z
  .object({
    /** Optional display name; the UI falls back to a localized "Proposal N". */
    label: z.string().trim().max(MAX_REFINANCE_LABEL_LENGTH),
    proposedTracks: z.array(refinanceProposedTrackSchema).min(1).max(MAX_TRACKS),
    feeAmount: z.number().finite().min(0).max(MAX_MONEY),
    feeMode: z.enum(FEE_MODES),
  })
  .strict()

const existingTracks = z.array(existingMortgageTrackSchema).min(1).max(MAX_TRACKS)
const resetStepPercent = z.number().finite().min(-100).max(100).default(0)

/** The current stored shape. */
export const refinanceSnapshotSchema = z
  .object({
    version: z.literal(2),
    existingTracks,
    proposals: z
      .array(refinanceProposalSnapshotSchema)
      .min(1)
      .max(MAX_REFINANCE_PROPOSALS),
    existingResetStepPercent: resetStepPercent,
  })
  .strict()

/** The original single-proposal shape, read-only for backward compatibility. */
export const refinanceSnapshotV1Schema = z
  .object({
    version: z.literal(1),
    existingTracks,
    proposedTracks: z.array(refinanceProposedTrackSchema).min(1).max(MAX_TRACKS),
    feeAmount: z.number().finite().min(0).max(MAX_MONEY),
    feeMode: z.enum(FEE_MODES),
    existingResetStepPercent: resetStepPercent,
  })
  .strict()

export const storedRefinanceSnapshotSchema = z.union([
  refinanceSnapshotV1Schema,
  refinanceSnapshotSchema,
])

export const savedRefinanceInputSchema = z
  .object({
    label: z.string().trim().min(1).max(MAX_REFINANCE_LABEL_LENGTH),
    snapshot: refinanceSnapshotSchema,
  })
  .strict()

/**
 * Reads either stored version and returns the current shape. A version 1
 * proposal had no name, so it becomes one unnamed proposal; the UI shows its
 * localized default name while editing and the saved plan's own label in the
 * profile.
 */
export function normalizeRefinanceSnapshot(snapshot: unknown): RefinanceSnapshotInput {
  const parsed = storedRefinanceSnapshotSchema.parse(snapshot)
  if (parsed.version === 2) return parsed

  return {
    version: 2,
    existingTracks: parsed.existingTracks,
    proposals: [
      {
        label: '',
        proposedTracks: parsed.proposedTracks,
        feeAmount: parsed.feeAmount,
        feeMode: parsed.feeMode,
      },
    ],
    existingResetStepPercent: parsed.existingResetStepPercent,
  }
}

export type SavedRefinanceInput = z.infer<typeof savedRefinanceInputSchema>
export type RefinanceSnapshotInput = z.infer<typeof refinanceSnapshotSchema>
export type RefinanceProposalSnapshotInput = z.infer<typeof refinanceProposalSnapshotSchema>
export type StoredRefinanceSnapshotInput = z.infer<typeof storedRefinanceSnapshotSchema>
