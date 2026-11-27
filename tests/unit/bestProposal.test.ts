import { describe, expect, it } from 'vitest'
import { selectBestProposals } from '@/features/refinance/bestProposal'

function proposal(id: string, net: number | null) {
  return {
    id,
    comparison: net === null ? null : { netCashFlowDelta: net },
  }
}

describe('selectBestProposals', () => {
  it('has nothing to mark with fewer than two priced proposals', () => {
    expect(selectBestProposals([])).toEqual({ ids: new Set() })
    expect(selectBestProposals([proposal('a', 10_000), proposal('b', null)])).toEqual({
      ids: new Set(),
    })
  })

  it('marks the single strongest net cash flow', () => {
    const result = selectBestProposals([
      proposal('a', 10_000),
      proposal('b', 25_000),
      proposal('c', null),
    ])
    expect([...result.ids]).toEqual(['b'])
  })

  it('marks every proposal in a partial tie', () => {
    const result = selectBestProposals([
      proposal('a', 25_000),
      proposal('b', 25_000),
      proposal('c', 10_000),
    ])
    expect([...result.ids].sort()).toEqual(['a', 'b'])
  })

  it('marks nothing on a full tie', () => {
    const result = selectBestProposals([
      proposal('a', 25_000),
      proposal('b', 25_000),
      proposal('c', 25_000),
    ])
    // No offer is financially better, so no offer is recommended.
    expect([...result.ids]).toEqual([])
  })

  it('treats sub-agora noise as equal at the comparison precision', () => {
    const result = selectBestProposals([
      proposal('a', 25_000),
      proposal('b', 25_000.003),
    ])
    expect([...result.ids]).toEqual([])
  })
})
