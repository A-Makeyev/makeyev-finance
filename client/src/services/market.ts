import { useQuery } from '@tanstack/react-query'
import type { MarketSnapshotResponse } from './marketTypes'

/**
 * Client-side market data access.
 *
 * The UI consumes ONLY the normalized MarketQuote schema served by
 * GET /api/market/quotes - never a raw provider payload (API keys stay
 * server-side; see server/market/). Future pages (watchlist, portfolio,
 * stocks/crypto trackers) call fetchMarketQuotes through react-query the
 * same way the navigation tracker does.
 */

export type { MarketQuote, MarketSnapshotResponse } from './marketTypes'

export const MARKET_QUOTES_URL = '/api/market/quotes'

/** How often a failed strip quietly retries (rate-limit outages, blips). */
const ERROR_RETRY_MS = 5 * 60 * 1000

export async function fetchMarketQuotes(
  assetIds?: readonly string[],
  signal?: AbortSignal,
): Promise<MarketSnapshotResponse> {
  const query =
    assetIds && assetIds.length > 0 ? `?ids=${assetIds.map(encodeURIComponent).join(',')}` : ''
  const response = await fetch(`${MARKET_QUOTES_URL}${query}`, { signal })
  if (!response.ok) {
    throw new Error(`Market quotes request failed: ${response.status}`)
  }
  return (await response.json()) as MarketSnapshotResponse
}

/**
 * React-query hook. Semantics match the app's legacy external-data rules:
 * silent failure, no refetch on focus, periodic refresh from the
 * server-provided interval (never hard-coded in components). After an
 * error it polls slowly until the server recovers, so the strip heals
 * itself with no retry control.
 */
export function useMarketQuotes(assetIds?: readonly string[]) {
  return useQuery({
    queryKey: ['market', 'quotes', assetIds ? assetIds.join(',') : 'all'],
    queryFn: ({ signal }) => fetchMarketQuotes(assetIds, signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: (query) =>
      query.state.data?.refreshIntervalMs ?? (query.state.error ? ERROR_RETRY_MS : false),
  })
}
