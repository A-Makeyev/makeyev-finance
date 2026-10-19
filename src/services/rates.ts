import { useQuery } from '@tanstack/react-query'
import type { AverageRatesResponse } from '@/lib/averageRates'

/**
 * Client-side access to the average-rate tables.
 *
 * The browser only sees the normalized rows served by GET /api/rates/average.
 * Upstream workbooks, parsing and caching stay on the server.
 */

export const AVERAGE_RATES_URL = '/api/rates/average'

export async function fetchAverageRates(signal?: AbortSignal): Promise<AverageRatesResponse> {
  const response = await fetch(AVERAGE_RATES_URL, { signal })
  if (!response.ok) {
    throw new Error(`Average rates request failed: ${response.status}`)
  }
  return (await response.json()) as AverageRatesResponse
}

export function useAverageRates() {
  return useQuery({
    queryKey: ['rates', 'average'],
    queryFn: ({ signal }) => fetchAverageRates(signal),
    retry: false,
    refetchOnWindowFocus: false,
    // The source changes about once a month; an hour of client cache is
    // plenty, while a manual retry after an error still refetches.
    staleTime: 60 * 60 * 1000,
  })
}
