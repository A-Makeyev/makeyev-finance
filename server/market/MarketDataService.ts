import { TtlCache } from './cache.ts'
import { cacheTtlForAsset } from './config.ts'
import { FinnhubProvider } from './FinnhubProvider.ts'
import { FrankfurterProvider } from './FrankfurterProvider.ts'
import { YahooProvider } from './YahooProvider.ts'
import { getMarketAsset, MARKET_ASSETS, MARKET_TRACKER_ASSET_IDS } from './assets.ts'
import { loadSnapshot, saveSnapshot } from './persistence.ts'
import {
  MarketDataError,
  type MarketAsset,
  type MarketProviderName,
  type MarketQuote,
  type MarketSnapshot,
} from './types.ts'

/**
 * MarketDataService - the provider-agnostic layer between the HTTP route and
 * the upstream providers.
 *
 * Caching is per PROVIDER + CADENCE GROUP, not per snapshot: assets are split
 * by their registry provider and by whether they are marked `realtime`, each
 * group gets its own TTL, and the response is assembled in the requested
 * order. That is what lets the strip run every row at the speed its own market
 * prints - the Finnhub rows and the gold contract refetch within seconds
 * because their data is live, while TA-35 (Yahoo, a delayed TASE feed) and
 * USD/ILS (Frankfurter, a daily ECB rate) keep much longer TTLs and are never
 * polled faster than their data actually changes. Splitting one provider into
 * two groups matters exactly where a provider serves both kinds of data:
 * polling the delayed index at the futures cadence would quadruple the requests
 * for a number that cannot have changed.
 *
 * Request budget: a group costs one upstream call per asset. At the defaults
 * (see config.ts) the Finnhub group spends 18 of its 60 free calls/min, and the
 * Yahoo groups together spend about 244 requests/hour. A group's cache is
 * shared by every visitor, so traffic does not multiply upstream calls - only
 * time does - and with nobody on the site nothing is polled at all.
 *
 * Failure policy: one asset's failure never removes the whole snapshot -
 * failed rows drop out of the response (the UI keeps showing already-known
 * structure) while healthy rows render normally, and the shortfall is
 * disclosed with stale flags. A shortfall is cached only briefly (see
 * PARTIAL_TTL_MS), so a rate-limited provider gets a breather instead of being
 * hammered, and it heals on a later poll.
 */
export interface MarketDataServiceOptions {
  /** Overrides the Finnhub provider (tests). undefined = build from config. */
  finnhubProvider?: FinnhubProvider
  /** Overrides the Frankfurter FX provider (tests). undefined = build fresh. */
  frankfurterProvider?: FrankfurterProvider
  /** Overrides the Yahoo chart provider (tests). undefined = build fresh. */
  yahooProvider?: YahooProvider
  /**
   * Replaces provider ROUTING entirely (tests): every asset goes to this
   * provider regardless of its registry entry. Takes precedence over the
   * per-provider options above.
   */
  providerOverride?: MarketProvider
  /** Test override: ONE ttl for every provider group (ignores the config). */
  ttlMs?: number
  /**
   * Test override: per-provider TTLs, falling back to ttlMs then the config.
   * A `realtime` asset takes its provider's realtime TTL, and falls back to
   * this value when no realtime override is given.
   */
  providerTtls?: Partial<Record<MarketProviderName, number>>
  /** Test override: per-provider TTLs for the `realtime` group (see above). */
  realtimeTtls?: Partial<Record<MarketProviderName, number>>
  now?: () => number
  /** Disables disk persistence (tests). */
  persist?: boolean
}

/** Minimal common surface the service needs from any provider (exported for tests). */
export interface MarketProvider {
  available: boolean
  getQuote(asset: MarketAsset, signal?: AbortSignal): Promise<MarketQuote>
}

/** Quotes fetched from one provider in one round trip, plus its failures. */
interface ProviderBatch {
  quotes: MarketQuote[]
  /** Asset ids this batch could not fetch (drives the shorter heal TTL). */
  failedIds: string[]
  /**
   * First failure. Cached with the batch so a failing provider gets a breather
   * instead of being retried on every single request, and so the route can
   * still answer with the right status code.
   */
  error?: Error
  /**
   * True when these quotes came from an EARLIER fetch (a failed refresh must
   * not wipe numbers we already have). The UI is told they are not current.
   */
  stale?: boolean
}

/**
 * Age after which a persisted snapshot is no longer offered. Prices are a
 * "current markets" display, not an archive: beyond a week on disk they are
 * misleading, so the strip falls back to placeholders instead.
 */
const PERSISTED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * How long a partial batch (some assets failed upstream) stays cached, capped
 * at the provider's own TTL. Short on purpose: a missing row should heal on
 * the next poll instead of pinning a "-" for the full TTL, and it never makes
 * a fast provider wait longer than its normal refresh.
 */
const PARTIAL_TTL_MS = 5 * 60 * 1000

/**
 * Minimum spacing between snapshot disk writes. The snapshot is only an
 * outage/restart fallback, so writing it on every 60s refresh (~1,440 writes a
 * day) buys nothing over writing it a few times an hour.
 */
const PERSIST_MIN_INTERVAL_MS = 5 * 60 * 1000

export class MarketDataService {
  private readonly providers: Partial<Record<MarketProviderName, MarketProvider>>
  private readonly cache: TtlCache<ProviderBatch>
  private readonly now: () => number
  private readonly persist: boolean
  private readonly ttlByProvider: Record<MarketProviderName, number>
  private readonly realtimeTtlByProvider: Record<MarketProviderName, number>
  private lastPersistAt: number | undefined

  constructor(options: MarketDataServiceOptions = {}) {
    this.providers = options.providerOverride
      ? {
          finnhub: options.providerOverride,
          frankfurter: options.providerOverride,
          yahoo: options.providerOverride,
        }
      : {
          finnhub: options.finnhubProvider ?? new FinnhubProvider(),
          frankfurter: options.frankfurterProvider ?? new FrankfurterProvider(),
          yahoo: options.yahooProvider ?? new YahooProvider(),
        }
    this.now = options.now ?? Date.now
    this.persist = options.persist ?? true
    // Fast tier first, then the provider's own override, then the single-TTL
    // test override, then the configured cadence for this asset.
    const ttlFor = (provider: MarketProviderName, realtime: boolean): number =>
      (realtime ? options.realtimeTtls?.[provider] : undefined) ??
      options.providerTtls?.[provider] ??
      options.ttlMs ??
      cacheTtlForAsset({ provider, realtime })
    this.ttlByProvider = {
      finnhub: ttlFor('finnhub', false),
      frankfurter: ttlFor('frankfurter', false),
      yahoo: ttlFor('yahoo', false),
    }
    this.realtimeTtlByProvider = {
      finnhub: ttlFor('finnhub', true),
      frankfurter: ttlFor('frankfurter', true),
      yahoo: ttlFor('yahoo', true),
    }
    // Every write goes through wrap's ttlFor, so this default is only a
    // fallback for a batch cached without one; it just has to be >= the rest.
    this.cache = new TtlCache<ProviderBatch>(
      Math.max(
        ...Object.values(this.ttlByProvider),
        ...Object.values(this.realtimeTtlByProvider),
      ),
      this.now,
    )
  }

  /**
   * Whether at least one backing provider can serve anything (key present).
   * Per-asset availability is checked in fetchBatch: an asset whose provider is
   * unconfigured fails individually instead of disabling the whole snapshot.
   */
  get available(): boolean {
    return Object.values(this.providers).some((provider) => provider?.available)
  }

  /**
   * Quotes for the requested asset ids (defaults to every registered asset).
   * Assets are grouped by provider and cadence, each group is served from its
   * own cache when fresh, and the response is assembled in the requested order.
   * Stale data is always disclosed: a group served after a failed refresh, or
   * the shortfall of a partial snapshot, carries `stale: true`.
   */
  async getQuotes(
    assetIds: readonly string[] = MARKET_ASSETS.map((a) => a.id),
  ): Promise<MarketSnapshot> {
    const ids = assetIds.length > 0 ? assetIds : MARKET_TRACKER_ASSET_IDS
    const assets = ids.map((id) => getMarketAsset(id)).filter((a) => a !== undefined)
    if (assets.length === 0) return { quotes: [] }

    const settled = await Promise.allSettled(
      groupAssets(assets, (asset) => this.ttlForAsset(asset)).map((group) =>
        this.getProviderBatch(group.provider, group.assets, group.ttl),
      ),
    )

    const byAssetId = new Map<string, MarketQuote>()
    const groupErrors: Error[] = []
    let firstError: unknown
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        for (const quote of result.value.quotes) byAssetId.set(quote.assetId, quote)
        if (result.value.error) groupErrors.push(result.value.error)
      } else if (firstError === undefined) {
        firstError = result.reason
      }
    })

    // Registry (requested) order, never provider resolution order.
    const quotes = assets
      .map((asset) => byAssetId.get(asset.id))
      .filter((quote): quote is MarketQuote => quote !== undefined)

    if (quotes.length === 0) {
      const failure = firstError ?? groupErrors[0]
      throw failure instanceof Error
        ? failure
        : new MarketDataError('provider-error', 'no provider returned a quote')
    }

    const missing = assets.filter((asset) => !byAssetId.has(asset.id))
    if (missing.length > 0) {
      console.warn(`[market] partial snapshot failures: ${missing.map((a) => a.id).join(', ')}`)
    } else {
      // Only complete snapshots are worth persisting (see PERSIST_MIN_INTERVAL_MS).
      this.persistThrottled({ quotes })
    }

    return this.markPartial({ quotes }, assets.length)
  }

  /**
   * One provider's quotes for one asset set, cached under that group's TTL.
   *
   * Fallback tiers, in order: fresh cache > expired in-memory batch (flagged
   * stale) > persisted-on-disk batch (flagged stale) > the provider error. Each
   * tier keeps the strip alive one step longer, and nothing is ever presented
   * as current when it is not.
   */
  private async getProviderBatch(
    provider: MarketProviderName,
    assets: MarketAsset[],
    ttl: number,
  ): Promise<{ quotes: MarketQuote[]; error?: Error }> {
    // The TTL is part of the key, so the live and delayed groups of one
    // provider can never read each other's batch.
    const key = `${provider}:${ttl}:${assets
      .map((asset) => asset.id)
      .sort()
      .join(',')}`
    const partialTtl = Math.min(PARTIAL_TTL_MS, ttl)

    let failure: Error | undefined
    try {
      const batch = await this.cache.wrap(
        key,
        // mergeBatch keeps the previous quotes when this refresh fetched
        // nothing, so a failing provider cannot wipe numbers we already have.
        async () => mergeBatch(await this.fetchBatch(provider, assets), this.cache.get(key)?.value),
        (value) => (value.failedIds.length > 0 ? partialTtl : ttl),
      )
      if (batch.quotes.length > 0) {
        return {
          quotes: batch.stale ? withStaleFlag(batch.quotes) : batch.quotes,
          error: batch.error,
        }
      }
      failure = batch.error
    } catch (error) {
      // A misconfigured provider (no key): treat it like an upstream failure so
      // the disk snapshot below still gets its chance to keep the strip alive.
      failure = error instanceof Error ? error : new Error(String(error))
    }

    const persisted = this.persistedQuotes(assets)
    if (persisted) return { quotes: withStaleFlag(persisted), error: failure }
    if (failure) throw failure
    return {
      quotes: [],
      error: new MarketDataError('provider-error', `no quotes from ${provider}`),
    }
  }

  /**
   * Fetches every asset in one provider group. A per-asset failure is recorded
   * rather than thrown so the group's healthy quotes survive, and a group where
   * NOTHING succeeded still resolves so its failure can be cached briefly;
   * only a misconfigured provider rejects.
   */
  private async fetchBatch(
    provider: MarketProviderName,
    assets: MarketAsset[],
  ): Promise<ProviderBatch> {
    const impl = this.providers[provider]
    if (!impl) {
      // A configuration problem, not an upstream one: never cached as data.
      throw new MarketDataError('missing-key', `no provider configured for ${provider}`)
    }

    // Per-asset isolation: Promise.allSettled so one bad symbol or a rate
    // limit on one asset cannot discard good quotes from its siblings.
    const settled = await Promise.allSettled(assets.map((asset) => impl.getQuote(asset)))

    const quotes: MarketQuote[] = []
    const failedIds: string[] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') quotes.push(result.value)
      else failedIds.push(assets[index].id)
    })

    if (quotes.length > 0) return { quotes, failedIds }

    const firstReason = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )!.reason
    return {
      quotes,
      failedIds,
      error: firstReason instanceof Error ? firstReason : new Error(String(firstReason)),
    }
  }

  /** Last complete snapshot from disk (for these ids), if recent enough. */
  private persistedQuotes(assets: MarketAsset[]): MarketQuote[] | undefined {
    if (!this.persist) return undefined
    const persisted = loadSnapshot()
    if (!persisted) return undefined
    const age = this.now() - persisted.savedAt
    if (age < 0 || age > PERSISTED_MAX_AGE_MS) return undefined
    const wanted = new Set(assets.map((asset) => asset.id))
    const quotes = persisted.snapshot.quotes.filter((quote) => wanted.has(quote.assetId))
    return quotes.length > 0 ? quotes : undefined
  }

  /** Persists a complete snapshot, at most once per PERSIST_MIN_INTERVAL_MS. */
  private persistThrottled(snapshot: MarketSnapshot): void {
    if (!this.persist) return
    const now = this.now()
    if (this.lastPersistAt !== undefined && now - this.lastPersistAt < PERSIST_MIN_INTERVAL_MS) {
      return
    }
    this.lastPersistAt = now
    saveSnapshot(snapshot, this.now)
  }

  /** Partial snapshots are disclosed: their quotes carry `stale: true`. */
  private markPartial(snapshot: MarketSnapshot, expected: number): MarketSnapshot {
    if (snapshot.quotes.length >= expected) return snapshot
    return { quotes: snapshot.quotes.map((quote) => ({ ...quote, stale: true })) }
  }

  /**
   * The TTL this asset's group is cached under: its provider's fast tier when
   * the registry marks the instrument `realtime`, otherwise the provider's
   * default tier.
   */
  private ttlForAsset(asset: MarketAsset): number {
    return asset.realtime
      ? this.realtimeTtlByProvider[asset.provider]
      : this.ttlByProvider[asset.provider]
  }
}

/**
 * Keeps the last good quotes when a refresh yields nothing, flagged stale so
 * the UI never presents them as current. A refresh that DID return quotes
 * always wins, so recovered data is never held back by an old batch.
 */
function mergeBatch(fresh: ProviderBatch, previous: ProviderBatch | undefined): ProviderBatch {
  if (fresh.quotes.length > 0 || previous === undefined || previous.quotes.length === 0) {
    return fresh
  }
  return {
    quotes: previous.quotes,
    failedIds: fresh.failedIds,
    error: fresh.error,
    stale: true,
  }
}

function withStaleFlag(quotes: MarketQuote[]): MarketQuote[] {
  return quotes.map((quote) => ({ ...quote, stale: true }))
}

/**
 * Splits the requested assets by provider AND cadence, preserving first-seen
 * order. Each group is fetched and cached on its own TTL and its own key, so a
 * fast provider is never held back by a slow one - and neither is a live row by
 * a delayed row from the same source.
 */
function groupAssets(
  assets: MarketAsset[],
  ttlForAsset: (asset: MarketAsset) => number,
): Array<{ provider: MarketProviderName; ttl: number; assets: MarketAsset[] }> {
  const groups = new Map<
    string,
    { provider: MarketProviderName; ttl: number; assets: MarketAsset[] }
  >()
  for (const asset of assets) {
    const ttl = ttlForAsset(asset)
    const key = `${asset.provider}:${ttl}`
    const existing = groups.get(key)
    if (existing) existing.assets.push(asset)
    else groups.set(key, { provider: asset.provider, ttl, assets: [asset] })
  }
  return [...groups.values()]
}
