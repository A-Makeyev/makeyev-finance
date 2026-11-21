import { z } from 'zod'
import { MAX_TRACKS, MAX_YEARS, TRACK_TYPES } from '@/lib/amortization'
import { existingMortgageTrackSchema } from '@/features/refinance/existingMortgage'

/**
 * The persisted shape of a saved refinance proposal, and the validation of
 * anything arriving from the client.
 *
 * Mirrors the saved-comparison schema: the server re-validates every field
 * because a hidden or disabled control in the UI is not access control. The
 * existing tracks reuse the existing-mortgage schema, so their explicit
 * unknown-value convention (`null`, never a guess) survives a round trip.
 */

export const MAX_SAVED_REFINANCES = 4

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

export const refinanceSnapshotSchema = z
  .object({
    version: z.literal(1),
    existingTracks: z.array(existingMortgageTrackSchema).min(1).max(MAX_TRACKS),
    proposedTracks: z.array(refinanceProposedTrackSchema).min(1).max(MAX_TRACKS),
    feeAmount: z.number().finite().min(0).max(MAX_MONEY),
    feeMode: z.enum(FEE_MODES),
    /** The reset-rate assumption that priced the projection. Optional with a
     *  default so proposals saved before it existed still load at 0. */
    existingResetStepPercent: z.number().finite().min(-100).max(100).default(0),
  })
  .strict()

export const savedRefinanceInputSchema = z
  .object({
    label: z.string().trim().min(1).max(MAX_REFINANCE_LABEL_LENGTH),
    snapshot: refinanceSnapshotSchema,
  })
  .strict()

export type SavedRefinanceInput = z.infer<typeof savedRefinanceInputSchema>
export type RefinanceSnapshotInput = z.infer<typeof refinanceSnapshotSchema>
