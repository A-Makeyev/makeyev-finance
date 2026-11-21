import type { AmortizationMethod, TrackType } from '@/lib/amortization'
import type { ExistingMortgageTrack } from './existingMortgage'
import type { FeeMode, ProposedTrackInput } from './computeRefinance'
import { refinanceSnapshotSchema } from '@/server/refinances/schema'

/**
 * The snapshot a saved refinance proposal stores.
 *
 * It keeps the existing mortgage's tracks (which may still contain unknown
 * `null`s, exactly as entered) and the proposed tracks as NUMBERS, not display
 * text: a proposal is a priced mix, so every proposed share, rate and term must
 * already be known before it can be saved. Loading the snapshot re-prices both
 * sides through the shared engine, so no computed figure is ever stored.
 */
export interface RefinanceProposedTrackSnapshot {
  type: TrackType
  sharePercent: number
  annualRatePercent: number
  termYears: number
  method: AmortizationMethod
  resetMonths: number
}

export interface RefinanceSnapshot {
  version: 1
  existingTracks: ExistingMortgageTrack[]
  proposedTracks: RefinanceProposedTrackSnapshot[]
  feeAmount: number
  feeMode: FeeMode
}

/**
 * A snapshot for storage, or null when the proposed side is not yet fully
 * entered. Only completed proposals are savable: the server requires every
 * share, rate and term, and a half-typed field must not become a zero.
 */
export function buildRefinanceSnapshot(input: {
  existingTracks: ExistingMortgageTrack[]
  proposedTracks: ProposedTrackInput[]
  feeAmount: number
  feeMode: FeeMode
}): RefinanceSnapshot | null {
  if (input.proposedTracks.length === 0) return null
  const proposedTracks: RefinanceProposedTrackSnapshot[] = []
  for (const track of input.proposedTracks) {
    if (
      track.type === null ||
      track.sharePercent === null ||
      !(track.sharePercent > 0) ||
      track.annualRatePercent === null ||
      track.termYears === null ||
      !Number.isInteger(track.termYears) ||
      track.method === null
    ) {
      return null
    }
    proposedTracks.push({
      type: track.type,
      sharePercent: track.sharePercent,
      annualRatePercent: track.annualRatePercent,
      termYears: track.termYears,
      method: track.method,
      resetMonths: track.resetMonths ?? 0,
    })
  }
  const parsed = refinanceSnapshotSchema.safeParse({
    version: 1,
    existingTracks: input.existingTracks,
    proposedTracks,
    feeAmount: input.feeAmount,
    feeMode: input.feeMode,
  })
  return parsed.success ? parsed.data : null
}
