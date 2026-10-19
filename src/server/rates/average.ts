import type { AverageRatesResponse } from '@/lib/averageRates'
import { AverageRatesService } from './AverageRatesService'

/**
 * Internal API for GET /api/rates/average.
 *
 * The route is deliberately a thin wrapper over this handler so the contract
 * can be tested without booting Next. Upstream BOI failures are reported per
 * table inside a 200 response; only an unexpected service failure is a 500.
 */

export interface AverageRatesServiceLike {
  getSnapshot(): Promise<AverageRatesResponse>
}

export interface AverageRatesResult {
  status: number
  body: AverageRatesResponse | { error: string }
}

let service: AverageRatesServiceLike | null = null

function getService(): AverageRatesServiceLike {
  if (!service) service = new AverageRatesService()
  return service
}

export function setAverageRatesService(next: AverageRatesServiceLike | null): void {
  service = next
}

export async function handleAverageRates(): Promise<AverageRatesResult> {
  try {
    const snapshot = await getService().getSnapshot()
    return { status: 200, body: snapshot }
  } catch {
    return { status: 500, body: { error: 'rates unavailable' } }
  }
}
