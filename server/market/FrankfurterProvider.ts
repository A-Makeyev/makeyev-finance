import { MarketDataError, type MarketAsset, type MarketQuote } from './types.ts'

/**
 * Frankfurter provider - ECB reference exchange rates, keyless and free.
 *
 * Why this provider exists (verified live 2026-09-09): Finnhub's forex
 * (/quote on OANDA:USD_ILS, FXCM:USD/ILS) is premium-only on the free key,
 * but the user asked for USD/ILS in the strip. Frankfurter (api.frankfurter.dev)
 * publishes the ECB's daily reference rates with no API key and no rate
 * limit, so the FX leg costs nothing and cannot exhaust any quota.
 *
 * Data shape: daily closes (ECB publishes on TARGET business days, ~16:00
 * CET), so USD/ILS updates once per day - not real-time, but the honest
 * free source for it. The change % compares the two most recent published
 * days, which is the standard convention for FX "daily change".
 *
 * Error handling contract: every failure surfaces as a MarketDataError with
 * a typed code; raw payloads never escape this module. No key exists, so
 * nothing to leak.
 */

const BASE_URL = 'https://api.frankfurter.dev/v1'

interface FrankfurterSeriesWire {
  base?: string
  rates?: Record<string, Record<string, number>>
}

export interface FrankfurterProviderOptions {
  /**currency pair, e.g. 'USD' base with 'ILS' quote (from the asset). */
  fetchImpl?: typeof fetch
  now?: () => Date
}

export class FrankfurterProvider {
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date

  constructor(options: FrankfurterProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
    this.now = options.now ?? (() => new Date())
  }

  /** Keyless service: always usable. */
  get available(): boolean {
    return true
  }

  async getQuote(asset: MarketAsset, signal?: AbortSignal): Promise<MarketQuote> {
    if (asset.type !== 'currency' || asset.currency !== 'USD' || asset.symbol !== 'USDILS') {
      throw new MarketDataError(
        'unsupported-symbol',
        `Frankfurter provider only serves USD/ILS, got ${asset.symbol}`,
      )
    }

    // Ask for ~10 calendar days back: enough to span an ECB holiday weekend
    // (Easter, Golden Week) and still return at least two business days.
    const start = new Date(this.now().getTime() - 10 * 24 * 60 * 60 * 1000)
    const startIso = start.toISOString().slice(0, 10)
    const url = `${BASE_URL}/${startIso}..?base=USD&symbols=ILS`

    let payload: FrankfurterSeriesWire
    try {
      const response = await this.fetchImpl(url, { signal })
      if (!response.ok) {
        throw new MarketDataError('provider-error', `Frankfurter HTTP ${response.status}`)
      }
      payload = (await response.json()) as FrankfurterSeriesWire
    } catch (error) {
      if (error instanceof MarketDataError) throw error
      throw new MarketDataError(
        'provider-error',
        `Frankfurter request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const series = Object.entries(payload?.rates ?? {})
      .map(([date, rates]) => ({ date, rate: rates?.ILS }))
      .filter((point): point is { date: string; rate: number } => typeof point.rate === 'number')
      .sort((a, b) => a.date.localeCompare(b.date))

    if (series.length < 2) {
      throw new MarketDataError(
        'malformed-response',
        `Frankfurter returned fewer than two USD/ILS points`,
      )
    }

    const last = series[series.length - 1]
    const prev = series[series.length - 2]
    const change = last.rate - prev.rate
    const changePercent = (change / prev.rate) * 100

    return {
      assetId: asset.id,
      name: asset.name,
      price: last.rate,
      change,
      changePercent,
      currency: asset.currency,
      timestamp: new Date(`${last.date}T16:00:00Z`).toISOString(),
      // ECB reference rates are a daily close; never present as real-time.
      marketStatus: 'closed',
    }
  }
}
