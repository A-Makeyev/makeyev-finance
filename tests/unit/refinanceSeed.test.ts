import { describe, expect, it } from 'vitest'
import {
  clearRefinanceSeedRequest,
  existingTracksFromCalculatorTracks,
  isRefinanceSeedRequested,
  requestRefinanceSeed,
} from '@/features/refinance/pendingSeed'
import type { TrackState } from '@/stores/calculatorStore'

function track(overrides: Partial<TrackState> = {}): TrackState {
  return {
    id: 'track-1',
    type: 'fixed',
    amountText: '1,000,000',
    yearsText: '20',
    rateText: '4.5',
    resetMonths: 0,
    graceMonths: 0,
    graceMode: 'interestOnly',
    marginText: '',
    method: 'spitzer',
    isAutoRate: true,
    loanShareMemory: null,
    ...overrides,
  }
}

describe('existingTracksFromCalculatorTracks', () => {
  it('maps the mix onto the existing mortgage: balance, rate, remaining months', () => {
    const [seeded] = existingTracksFromCalculatorTracks([
      track({ type: 'variable5y', amountText: '800,000', yearsText: '22', rateText: '4.25' }),
    ])

    expect(seeded.currentBalance).toBe(800_000)
    expect(seeded.contractedAnnualRate).toBe(4.25)
    expect(seeded.remainingMonths).toBe(264)
    expect(seeded.type).toBe('variable5y')
    // A resetting type keeps its contractual cadence, so the projection can
    // place the existing track's resets.
    expect(seeded.resetMonths).toBe(60)
    expect(seeded.linkage).toBe('unlinked')
    expect(seeded.method).toBe('spitzer')
    expect(seeded.dataStatus).toBe('userReviewed')
  })

  it('keeps an entered 0% rate and derives CPI linkage from the track type', () => {
    const [seeded] = existingTracksFromCalculatorTracks([
      track({ type: 'fixedIndexed', rateText: '0' }),
    ])
    expect(seeded.contractedAnnualRate).toBe(0)
    expect(seeded.linkage).toBe('cpi')
  })

  it('drops a track that is not a contract yet instead of seeding zeros', () => {
    const seeded = existingTracksFromCalculatorTracks([
      track({ id: 'blank-amount', amountText: '' }),
      track({ id: 'blank-rate', rateText: '  ' }),
      track({ id: 'bad-term', yearsText: '0' }),
      track({ id: 'kept' }),
    ])
    expect(seeded).toHaveLength(1)
    expect(seeded[0].id).toBe('kept')
  })

  it('caps the remaining term at the calculator maximum', () => {
    const [seeded] = existingTracksFromCalculatorTracks([track({ yearsText: '30' })])
    expect(seeded.remainingMonths).toBe(360)
  })
})

describe('refinance seed request', () => {
  it('stays requested until the refinance page clears it', () => {
    clearRefinanceSeedRequest()
    expect(isRefinanceSeedRequested()).toBe(false)
    requestRefinanceSeed()
    expect(isRefinanceSeedRequested()).toBe(true)
    clearRefinanceSeedRequest()
    expect(isRefinanceSeedRequested()).toBe(false)
  })
})
