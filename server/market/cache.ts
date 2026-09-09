/**
 * Minimal TTL cache for market snapshots.
 *
 * Deliberately dependency-free and synchronous so it can be replaced by Redis
 * or another shared cache later without touching the service or the UI: the
 * surface is get/set/delete plus a `freshUntil` stamp and an in-flight
 * promise map that collapses concurrent refreshes into one upstream fetch.
 */
export interface CacheEntry<T> {
  value: T
  /** Epoch ms after which the entry is considered stale. */
  freshUntil: number
  writtenAt: number
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>()
  private readonly inFlight = new Map<string, Promise<T>>()
  private readonly ttlMs: number
  private readonly now: () => number

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs
    this.now = now
  }

  get(key: string): CacheEntry<T> | undefined {
    return this.store.get(key)
  }

  isFresh(entry: CacheEntry<T>, now = this.now()): boolean {
    return entry.freshUntil > now
  }

  set(key: string, value: T, ttlMs = this.ttlMs): CacheEntry<T> {
    const now = this.now()
    const entry: CacheEntry<T> = { value, freshUntil: now + ttlMs, writtenAt: now }
    this.store.set(key, entry)
    return entry
  }

  delete(key: string): void {
    this.store.delete(key)
    this.inFlight.delete(key)
  }

  /**
   * Returns the cached value when fresh; otherwise runs `refresh` once per
   * key, deduplicating concurrent callers onto the same promise. On refresh
   * failure the cached value is kept (callers decide how to flag staleness).
   */
  /**
   * Returns the cached value when fresh; otherwise runs `refresh` once per
   * key, deduplicating concurrent callers onto the same promise. On refresh
   * failure the cached value is kept (callers decide how to flag staleness).
   * `ttlFor` optionally picks a per-entry TTL from the fresh value, so a
   * degraded snapshot can expire (and heal) sooner than a complete one.
   */
  async wrap(
    key: string,
    refresh: () => Promise<T>,
    ttlFor?: (value: T) => number | undefined,
  ): Promise<T> {
    const cached = this.store.get(key)
    if (cached && this.isFresh(cached)) return cached.value

    const existing = this.inFlight.get(key)
    if (existing) return existing

    const promise = refresh()
      .then((value) => {
        this.set(key, value, ttlFor?.(value) ?? this.ttlMs)
        return value
      })
      .finally(() => {
        this.inFlight.delete(key)
      })
    this.inFlight.set(key, promise)
    return promise
  }
}
