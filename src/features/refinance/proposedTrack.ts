import {
  MAX_TRACKS,
  defaultResetMonthsFor,
  type AmortizationMethod,
  type TrackType,
} from '@/lib/amortization'
import { parseAmountText } from '@/lib/format'
import type { SavedTrackInput } from '@/stores/calculatorStore'
import type { ProposedTrackInput } from './computeRefinance'
import type { RefinanceProposedTrackSnapshot } from './snapshot'

/**
 * The proposed side's editing state.
 *
 * Values stay TEXT while the user types (the same rule as the calculator's
 * track fields), so a decimal point or a trailing zero is never eaten by a
 * parse-and-reformat round trip. `computeRefinance` receives the parsed
 * numbers, and a blank field stays null and blocks the projection instead of
 * silently becoming zero.
 *
 * Shares are percentages of the new principal, not shekel amounts: the
 * principal is the sum of the existing balances (plus a capitalized fee), and
 * a percentage keeps the proposed tracks reconciled to it no matter how that
 * balance changes.
 */
export interface ProposedTrackState {
  id: string
  type: TrackType
  shareText: string
  rateText: string
  yearsText: string
  method: AmortizationMethod
  /** Contractual reset cadence; the type's default is used when loaded. */
  resetMonths: number
}

export const MAX_PROPOSED_TRACKS = MAX_TRACKS

/** A decimal text -> number, or null when the field is blank or malformed. */
export function parseNumericText(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/** A share as text: two decimals at most, no trailing zeroes. */
function shareText(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Equal shares that sum to 100, the last one absorbing the rounding. */
export function equalShareTexts(count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return ['100']
  const base = Math.floor((100 / count) * 100) / 100
  const shares = Array.from({ length: count }, () => shareText(base))
  shares[count - 1] = shareText(100 - base * (count - 1))
  return shares
}

let idCounter = 0

function nextId(): string {
  idCounter += 1
  return `proposed-${idCounter}`
}

export function emptyProposedTrack(share = 100): ProposedTrackState {
  return {
    id: nextId(),
    type: 'fixed',
    shareText: shareText(share),
    rateText: '5',
    yearsText: '20',
    method: 'spitzer',
    resetMonths: 0,
  }
}

/** One proposed track per existing track, splitting the shares evenly. */
export function initialProposedTracks(count = 1): ProposedTrackState[] {
  const shares = equalShareTexts(Math.max(1, count))
  return shares.map((share) => emptyProposedTrack(Number(share)))
}

/**
 * An added track redistributes the shares evenly across every track, so the
 * new one never lands at 0% and the set always reads as a coherent mix.
 */
export function addProposedTrack(tracks: ProposedTrackState[]): ProposedTrackState[] {
  if (tracks.length >= MAX_PROPOSED_TRACKS) return tracks
  const shares = equalShareTexts(tracks.length + 1)
  const shared = tracks.map((track, index) => ({ ...track, shareText: shares[index] }))
  return [...shared, { ...emptyProposedTrack(Number(shares[shares.length - 1])) }]
}

/** Keeps at least one proposed track: the proposal cannot be empty. */
export function removeProposedTrack(
  tracks: ProposedTrackState[],
  id: string,
): ProposedTrackState[] {
  if (tracks.length <= 1) return tracks
  const remaining = tracks.filter((track) => track.id !== id)
  const shares = equalShareTexts(remaining.length)
  return remaining.map((track, index) => ({ ...track, shareText: shares[index] }))
}

/** Parsed input for the price model, in the same order as the state. */
export function toProposedTrackInputs(tracks: ProposedTrackState[]): ProposedTrackInput[] {
  return tracks.map((track) => ({
    type: track.type,
    sharePercent: parseNumericText(track.shareText),
    annualRatePercent: parseNumericText(track.rateText),
    termYears: parseNumericText(track.yearsText),
    method: track.method,
    resetMonths: track.resetMonths,
  }))
}

/**
 * Turns a saved mix into a proposed mix WITHOUT inventing money: the saved
 * tracks' proportions become the proposal's shares, and their rates, terms and
 * methods are kept. The proposal's principal still comes from the existing
 * balances, so a mix saved for a different loan size is loaded as the same
 * shape rather than as its old shekel amounts.
 */
export function proposedTracksFromSavedMix(tracks: SavedTrackInput[]): ProposedTrackState[] {
  const funded = tracks.filter((track) => parseAmountText(track.amountText) > 0)
  const total = funded.reduce((sum, track) => sum + parseAmountText(track.amountText), 0)
  if (funded.length === 0 || total <= 0) return []
  return funded.slice(0, MAX_PROPOSED_TRACKS).map((track) => {
    const type = track.type
    return {
      id: nextId(),
      type,
      shareText: shareText((parseAmountText(track.amountText) / total) * 100),
      rateText: track.rateText,
      yearsText: track.yearsText,
      method: track.method,
      resetMonths: track.resetMonths ?? defaultResetMonthsFor(type),
    }
  })
}

/** The editing state for a stored proposal's proposed tracks. */
export function proposedTracksFromSnapshot(
  tracks: RefinanceProposedTrackSnapshot[],
): ProposedTrackState[] {
  return tracks.slice(0, MAX_PROPOSED_TRACKS).map((track) => ({
    id: nextId(),
    type: track.type,
    shareText: String(track.sharePercent),
    rateText: String(track.annualRatePercent),
    yearsText: String(track.termYears),
    method: track.method,
    resetMonths: track.resetMonths,
  }))
}
