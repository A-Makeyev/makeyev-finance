/**
 * Picks the refinance proposal to recommend from the priced ones.
 *
 * The strongest net cash flow against the existing mortgage wins. Fewer than
 * two priced proposals means there is nothing to beat, so nothing is marked.
 * A subset tie (say two of four) marks every offer in it: they really are
 * equally good. When EVERY priced proposal ties, none is marked - a badge on
 * all of them says nothing, and crowning the first would recommend an offer
 * for no financial reason.
 */
export interface BestProposalResult {
  /** Ids to badge as the best value; empty when there is nothing to beat. */
  ids: Set<string>
}

export function selectBestProposals(
  proposals: ReadonlyArray<{
    id: string
    comparison: { netCashFlowDelta: number } | null
  }>,
): BestProposalResult {
  const ids = new Set<string>()
  const priced = proposals.filter((proposal) => proposal.comparison)
  if (priced.length < 2) return { ids }

  const bestNet = Math.max(...priced.map((proposal) => proposal.comparison!.netCashFlowDelta))
  if (!Number.isFinite(bestNet)) return { ids }

  for (const proposal of priced) {
    if (Math.abs(proposal.comparison!.netCashFlowDelta - bestNet) < 0.005) {
      ids.add(proposal.id)
    }
  }
  if (ids.size === priced.length) return { ids: new Set() }
  return { ids }
}
