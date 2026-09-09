import { TtlCache } from './cache.ts'
import { marketConfig } from './config.ts'
import { FinnhubProvider } from './FinnhubProvider.ts'
import { FrankfurterProvider } from './FrankfurterProvider.ts'
import { getMarketAsset, MARKET_ASSETS, MARKET_TRACKER_ASSET_IDS } from './assets.ts'
import { loadSnapshot, saveSnapshot } from './persistence.ts'
import {
  MarketDataError,
  type MarketAsset,
  type MarketQuote,
  type MarketSnapshot,
} from './types.ts'

/**
 * MarketDataService - the provider-agnostic layer between the HTTP route and
 * the upstream providers. Owns the snapshot cache (one cached normalized
 * snapshot per asset-id set) and the per-asset error policy.
 *
 * Request budget: the Finnhub legs have no daily cap (60 calls/min); the
 * Frankfurter FX leg is keyless and unlimited. A full snapshot costs the
 * site nothing to serve, and the cache TTL (default 6h) keeps even the
 * per-minute counters at zero for most of the day.
 *
 * Failure policy: one asset's failure never removes the whole snapshot -
 * failed rows drop out of the response (the UI keeps showing already-known
 * structure) while healthy rows render normally.
 */
export interface MarketDataServiceOptions {
  /** Overrides the Finnhub provider (tests). undefined = build from config. */
  finnhubProvider?: FinnhubProvider
  /** Overrides the Frankfurter FX provider (tests). undefined = build fresh. */
  frankfurterProvider?: FrankfurterProvider
  /**
   * Replaces provider ROUTING entirely (tests): every asset goes to this
   * provider regardless of its registry entry. Takes precedence over the
   * per-provider options above.
   */
  providerOverride?: MarketProvider
  ttlMs?: number
  now?: () => number
  /** Disables disk persistence (tests). */
  persist?: boolean
}

/** Minimal common surface the service needs from any provider (exported for tests). */
export interface MarketProvider {
  available: boolean
  getQuote(asset: MarketAsset, signal?: AbortSignal): Promise<MarketQuote>
}

/**
 * Age after which a persisted snapshot is no longer offered. Prices are a
 * "current markets" display, not an archive: beyond a week on disk they are
 * misleading, so the strip falls back to placeholders instead.
 */
const PERSISTED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * How long a partial snapshot (some assets failed upstream) stays cached.
 * Short on purpose: both providers are effectively uncapped (Finnhub free
 * key has no daily limit; Frankfurter is keyless), so a shortfall recovers
 * cheaply on the next poll instead of pinning "-" rows for the full TTL.
 */
const PARTIAL_TTL_MS = 5 * 60 * 1000

export class MarketDataService {
  private readonly providers: Partial<Record<MarketAsset['provider'], MarketProvider>>
  private readonly cache: TtlCache<MarketSnapshot>
  private readonly now: () => number
  private readonly persist: boolean

  constructor(options: MarketDataServiceOptions = {}) {
    this.providers = options.providerOverride
      ? { finnhub: options.providerOverride, frankfurter: options.providerOverride }
      : {
          finnhub: options.finnhubProvider ?? new FinnhubProvider(),
          frankfurter: options.frankfurterProvider ?? new FrankfurterProvider(),
        }
    this.now = options.now ?? Date.now
    this.persist = options.persist ?? true
    this.cache = new TtlCache<MarketSnapshot>(
      options.ttlMs ?? marketConfig.MARKET_DATA_CACHE_TTL,
      this.now,
    )
  }

  /**
   * Whether at least one backing provider can serve anything (key present).
   * Per-asset availability is checked in fetchSnapshot: an asset whose
   * provider is unconfigured fails individually instead of disabling the
   * whole snapshot.
   */
  get available(): boolean {
    return Object.values(this.providers).some((provider) => provider?.available)
  }

  /**
   * Quotes for the requested asset ids (defaults to every registered asset).
   * Results come from the cache when fresh; a cache miss triggers exactly one
   * provider batch, shared by all concurrent callers.
   *
   * Stale-on-error: if a post-TTL refresh fails but an expired snapshot
   * exists, that snapshot is served with `stale: true` so the UI can show
   * clearly-identified cached numbers instead of an outage. A successful
   * refetch is by definition fresh and never marked stale.
   *
   * A partial snapshot (some assets failed upstream) is cached briefly
   * (PARTIAL_TTL_MS) and its quotes carry `stale: true`, so the UI never
   * presents partially-refreshed numbers as complete current data. Missing
   * rows show placeholders until the short TTL expires and the asset
   * retries.
   */
  async getQuotes(
    assetIds: readonly string[] = MARKET_ASSETS.map((a) => a.id),
  ): Promise<MarketSnapshot> {
    const ids = assetIds.length > 0 ? assetIds : MARKET_TRACKER_ASSET_IDS
    const assets = ids.map((id) => getMarketAsset(id)).filter((a) => a !== undefined)

    const key = cacheKeyFor(assets.map((a) => a.id))
    try {
      const snapshot = await this.cache.wrap(
        key,
        () => this.fetchAndRemember(assets),
        (value) => (value.quotes.length < assets.length ? PARTIAL_TTL_MS : undefined),
      )
      return this.markPartial(snapshot, assets.length)
    } catch (error) {
      // Order: fresh cache (never happens here - the failure came from the
      // refresh) > in-memory expired > persisted-on-disk > rethrow. Each
      // tier keeps the strip alive one step longer, always flagged stale.
      const entry = this.cache.get(key)
      if (entry) {
        return { quotes: entry.value.quotes.map((quote) => ({ ...quote, stale: true })) }
      }
      const persisted = this.persistedFallback(assets)
      if (persisted) return persisted
      throw error
    }
  }

  /** Fetches from the provider; a COMPLETE snapshot is written to disk. */
  private async fetchAndRemember(
    assets: NonNullable<ReturnType<typeof getMarketAsset>>[],
  ): Promise<MarketSnapshot> {
    const snapshot = await this.fetchSnapshot(assets)
    if (this.persist && snapshot.quotes.length === assets.length) {
      saveSnapshot(snapshot, this.now)
    }
    return snapshot
  }

  /** Last complete snapshot from disk, flagged stale, if recent enough. */
  private persistedFallback(
    assets: NonNullable<ReturnType<typeof getMarketAsset>>[],
  ): MarketSnapshot | undefined {
    if (!this.persist) return undefined
    const persisted = loadSnapshot()
    if (!persisted) return undefined
    const age = this.now() - persisted.savedAt
    if (age < 0 || age > PERSISTED_MAX_AGE_MS) return undefined
    const wanted = new Set(assets.map((asset) => asset.id))
    const quotes = persisted.snapshot.quotes.filter((quote) => wanted.has(quote.assetId))
    if (quotes.length === 0) return undefined
    return { quotes: quotes.map((quote) => ({ ...quote, stale: true })) }
  }

  /** Partial snapshots are disclosed: their quotes carry `stale: true`. */
  private markPartial(snapshot: MarketSnapshot, expected: number): MarketSnapshot {
    if (snapshot.quotes.length >= expected) return snapshot
    return { quotes: snapshot.quotes.map((quote) => ({ ...quote, stale: true })) }
  }

  private async fetchSnapshot(
    assets: NonNullable<ReturnType<typeof getMarketAsset>>[],
  ): Promise<MarketSnapshot> {
    // Per-asset isolation: Promise.allSettled so one bad symbol or a rate
    // limit on one provider cannot discard good quotes from the others. Each
    // asset goes to the provider its registry entry names (Finnhub for the
    // ETFs and Bitcoin, Frankfurter for USD/ILS).
    const settled = await Promise.allSettled(
      assets.map((asset) => {
        const provider = this.providers[asset.provider]
        if (!provider) {
          return Promise.reject(
            new MarketDataError('missing-key', `no provider configured for ${asset.provider}`),
          )
        }
        return provider.getQuote(asset)
      }),
    )

    const quotes: MarketQuote[] = []
    const failures: string[] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        quotes.push(result.value)
      } else {
        const asset = assets[index]
        const code =
          result.reason instanceof MarketDataError ? result.reason.code : 'provider-error'
        failures.push(`${asset.id}:${code}`)
      }
    })

    if (quotes.length === 0 && failures.length > 0) {
      // Nothing succeeded at all - surface the first failure to the route so
      // it can answer 503 instead of an empty 200.
      const firstReason = settled.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      )!.reason
      throw firstReason instanceof Error ? firstReason : new Error(String(firstReason))
    }

    if (failures.length > 0) {
      console.warn(`[market] partial snapshot failures: ${failures.join(', ')}`)
    }

    // Deterministic order: the asset registry order, not resolution order.
    const byId = new Map(quotes.map((quote) => [quote.assetId, quote]))
    return {
      quotes: assets
        .map((asset) => byId.get(asset.id))
        .filter((quote): quote is MarketQuote => quote !== undefined),
    }
  }
}

/** Distinct asset-id sets get distinct cache slots. */
function cacheKeyFor(ids: readonly string[]): string {
  return [...ids].sort().join(',')
}
