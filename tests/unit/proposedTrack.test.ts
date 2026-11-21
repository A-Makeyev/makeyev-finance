import { describe, expect, it } from 'vitest'
import { addProposedTrack, equalShareTexts, initialProposedTracks, proposedTracksFromSavedMix,
  proposedTracksFromSnapshot, removeProposedTrack, toProposedTrackInputs } from '@/features/refinance/proposedTrack'
import { MAX_TRACKS } from '@/lib/amortization'

describe('proposal editing and saved mixes', () => {
  it('preserves entered share precision when reopening a saved proposal', () => {
    const tracks = [33.333, 66.667].map(sharePercent => ({
      type: 'fixed' as const, sharePercent, annualRatePercent: 4,
      termYears: 10, method: 'spitzer' as const, resetMonths: 0,
    }))
    expect(toProposedTrackInputs(proposedTracksFromSnapshot(tracks))).toEqual(tracks)
  })
  it('allocates equal shares with the rounding remainder on the last track', () => {
    expect(equalShareTexts(3)).toEqual(['33.33', '33.33', '33.34'])
    expect(equalShareTexts(6)).toEqual(['16.66', '16.66', '16.66', '16.66', '16.66', '16.7'])
  })
  it('keeps one to six tracks and preserves rates when adding or removing', () => {
    let tracks = initialProposedTracks()
    tracks[0].rateText = '3.75'
    for (let i = 0; i < MAX_TRACKS; i++) tracks = addProposedTrack(tracks)
    expect(tracks).toHaveLength(MAX_TRACKS)
    expect(tracks[0].rateText).toBe('3.75')
    tracks = removeProposedTrack(tracks, tracks[2].id)
    tracks = addProposedTrack(tracks)
    expect(new Set(tracks.map(track => track.id)).size).toBe(MAX_TRACKS)
    const single = initialProposedTracks()
    expect(removeProposedTrack(single, single[0].id)).toEqual(single)
  })
  it('loads saved proportions, rate, term, method and cadence without old amounts', () => {
    const mix = [
      { type: 'fixed' as const, amountText: '600,000', rateText: '4.25', yearsText: '15', method: 'spitzer' as const, resetMonths: 0 },
      { type: 'prime' as const, amountText: '400,000', rateText: '5.5', yearsText: '25', method: 'equalPrincipal' as const, resetMonths: 12 },
    ]
    const tracks = proposedTracksFromSavedMix(mix)
    expect(toProposedTrackInputs(tracks)).toEqual([
      { type: 'fixed', sharePercent: 60, annualRatePercent: 4.25, termYears: 15, method: 'spitzer', resetMonths: 0 },
      { type: 'prime', sharePercent: 40, annualRatePercent: 5.5, termYears: 25, method: 'equalPrincipal', resetMonths: 12 },
    ])
  })
})
