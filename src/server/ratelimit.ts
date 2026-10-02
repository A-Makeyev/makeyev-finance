import { getDb } from './auth/mongo'

/**
 * A Mongo-backed fixed-window rate limiter for OUR OWN route handlers.
 *
 * Why this exists instead of reusing Better Auth's `rateLimit.customRules`:
 * that limiter only intercepts requests to Better Auth's own
 * `/api/auth/*` handler. `/api/mixes` and `/api/comments` never pass through
 * it, so without this they would be completely unthrottled. Same shape as the
 * auth rules (window + max), different mechanism.
 *
 * Multi-instance safe: the counter lives in Mongo and is bumped by a single
 * atomic upsert, so two Render instances share one budget instead of each
 * allowing the full limit. A TTL index sweeps expired windows.
 */

const COLLECTION = 'rate_limit_counters'

interface CounterDoc {
  _id: string
  count: number
  expiresAt: Date
}

let indexesEnsured: Promise<void> | null = null

function ensureIndexes(): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = getDb()
      .then((db) =>
        db
          .collection<CounterDoc>(COLLECTION)
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        // Do not cache a failed index build: the next request retries instead
        // of the process being poisoned for its lifetime.
        indexesEnsured = null
        throw error
      })
  }
  return indexesEnsured
}

/** Start of the fixed window containing `nowMs`, in whole seconds. Pure. */
export function windowStartSeconds(nowMs: number, windowSeconds: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds
}

/** Pure: the Nth request in a window is allowed while N <= max. */
export function isWithinLimit(count: number, max: number): boolean {
  return count <= max
}

export interface RateLimitRule {
  /** A stable name for the surface being limited, e.g. 'mixes'. */
  bucket: string
  /** What is being limited: a user id, or an ip for anonymous callers. */
  key: string
  windowSeconds: number
  max: number
}

/**
 * Records one hit and reports whether it is within the limit. Returns true
 * for the first `max` hits in the current window.
 *
 * Fails OPEN on a database error, deliberately: a Mongo hiccup must not turn
 * a write endpoint into a 500 for every user. The auth checks themselves do
 * the real gating; this is abuse control, not authorization.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  now: number = Date.now(),
): Promise<boolean> {
  try {
    await ensureIndexes()
    const db = await getDb()
    const start = windowStartSeconds(now, rule.windowSeconds)
    const result = await db.collection<CounterDoc>(COLLECTION).findOneAndUpdate(
      { _id: `${rule.bucket}:${rule.key}:${start}` },
      {
        $inc: { count: 1 },
        // Keep the document a little past its window so the TTL index can
        // retire it without racing the requests still counting into it.
        $setOnInsert: { expiresAt: new Date((start + rule.windowSeconds * 2) * 1000) },
      },
      { upsert: true, returnDocument: 'after' },
    )
    return isWithinLimit(result?.count ?? 1, rule.max)
  } catch (error) {
    console.error(
      `[ratelimit] check failed for ${rule.bucket}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
    return true
  }
}
