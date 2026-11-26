import type { AmortizationMethod, TrackType } from '@/lib/amortization'
import type { ExistingMortgageTrack } from './existingMortgage'
import type { FeeMode, ProposedTrackInput } from './computeRefinance'
import { MAX_REFINANCE_PROPOSALS, refinanceSnapshotSchema } from '@/server/refinances/schema'

/**
 * The snapshot a saved refinance plan stores.
 *
 * It keeps the existing mortgage's tracks (which may still contain unknown
 * `null`s, exactly as entered) and every named proposal as NUMBERS, not display
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
  /** Percent left for one payment at maturity; null means fully amortizing. */
  balloonPercent: number | null
}

export interface RefinanceProposalSnapshot {
  /** Optional; empty means the UI shows a localized "Proposal N". */
  label: string
  proposedTracks: RefinanceProposedTrackSnapshot[]
  feeAmount: number
  feeMode: FeeMode
}

export interface RefinanceSnapshot {
  version: 3
  existingTracks: ExistingMortgageTrack[]
  proposals: RefinanceProposalSnapshot[]
  /** The cumulative rate change assumed at each reset when it was saved. */
  existingResetStepPercent: number
}

export interface RefinanceProposalSnapshotInput {
  label: string
  proposedTracks: ProposedTrackInput[]
  feeAmount: number
  feeMode: FeeMode
}

/**
 * A snapshot for storage, or null when any proposal is not yet fully entered.
 * Only completed proposals are savable: the server requires every share, rate
 * and term, and a half-typed field must not become a zero. Saving is all or
 * nothing so a stored plan never silently loses a proposal.
 */
export function buildRefinanceSnapshot(input: {
  existingTracks: ExistingMortgageTrack[]
  proposals: RefinanceProposalSnapshotInput[]
  /** Defaults to 0 (flat rates) for callers that have no assumption to pass. */
  existingResetStepPercent?: number
}): RefinanceSnapshot | null {
  if (
    input.proposals.length === 0 ||
    input.proposals.length > MAX_REFINANCE_PROPOSALS
  ) {
    return null
  }

  const proposals: RefinanceProposalSnapshot[] = []
  for (const proposal of input.proposals) {
    if (proposal.proposedTracks.length === 0) return null
    const proposedTracks: RefinanceProposedTrackSnapshot[] = []
    for (const track of proposal.proposedTracks) {
      const balloonPercent = track.balloonPercent ?? null
      if (
        track.type === null ||
        track.sharePercent === null ||
        !(track.sharePercent > 0) ||
        track.annualRatePercent === null ||
        track.termYears === null ||
        !Number.isInteger(track.termYears) ||
        track.method === null ||
        (balloonPercent !== null &&
          (!Number.isFinite(balloonPercent) || balloonPercent <= 0 || balloonPercent > 100))
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
        balloonPercent,
      })
    }
    proposals.push({
      label: proposal.label.trim(),
      proposedTracks,
      feeAmount: proposal.feeAmount,
      feeMode: proposal.feeMode,
    })
  }

  const parsed = refinanceSnapshotSchema.safeParse({
    version: 3,
    existingTracks: input.existingTracks,
    proposals,
    existingResetStepPercent: input.existingResetStepPercent ?? 0,
  })
  return parsed.success ? parsed.data : null
}
