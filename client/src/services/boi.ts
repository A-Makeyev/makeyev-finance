import { PRIME_MARGIN } from '@/lib/amortization'
import { env } from '@/config/env'

export interface BoiInterestResponse {
  currentInterest?: number | string
}

/**
 * Fetches the Bank of Israel key rate and returns the prime lending rate
 * (key rate + 1.5% margin, rounded to 2 decimals) - identical math to legacy
 * calculator.js:432-440. Returns null when unavailable; callers must treat
 * that as "no live rate" (silent degradation, never blocks the calculator).
 */
export async function fetchPrimeRatePercent(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch(env.VITE_BOI_INTEREST_URL, { signal })
    const data = (await response.json()) as BoiInterestResponse
    const keyRate = Number(data?.currentInterest)
    if (!Number.isFinite(keyRate) || keyRate <= 0) return null
    return Math.round((keyRate + PRIME_MARGIN) * 100) / 100
  } catch {
    // Legacy behaviour: `.catch(() => {})` - silent failure.
    return null
  }
}
