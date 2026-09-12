/**
 * Server market-data configuration. Only this module reads market-related
 * environment variables; everything else takes values from here.
 *
 * Security: FINNHUB_API_KEY is a server-only secret. It lives in the
 * git-ignored .env (loaded by node --env-file / dotenv in server.js), is
 * never imported by client code, and is never included in any API response.
 */
import { z } from 'zod'
import type { MarketAsset } from './types.ts'

const configSchema = z.object({
  FINNHUB_API_KEY: z.string().min(1).optional(),
  /**
   * Cache TTL for providers without their own override, in ms. Default 15min:
   * this is the DAILY sources tier (Frankfurter publishes one ECB reference
   * rate per business day), so a short TTL cannot make the number change any
   * sooner - it only bounds how long a freshly published rate can sit
   * uncollected, and Frankfurter is keyless and uncapped.
   */
  MARKET_DATA_CACHE_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  /**
   * Cache TTL for the Finnhub rows, in ms. Default 10s: Finnhub's free key
   * serves real-time IEX quotes, allows 60 calls/min with no daily cap, and one
   * snapshot costs three calls. At 10s that is 18 of the 60 calls/min (30%), so
   * the strip updates up to six times a minute while leaving room for retries,
   * a second server instance and a couple more watchlist rows. Going to 5s
   * would double the spend for a barely perceptible gain and would leave no
   * headroom at all.
   */
  MARKET_DATA_FINNHUB_CACHE_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1000),
  /**
   * Cache TTL for the LIVE Yahoo rows (registry entries marked `realtime`, i.e.
   * the gold contract), in ms. Default 15s: futures print continuously, so the
   * row follows them. One symbol costs one request per refresh, so 15s is about
   * 240 requests/hour against an endpoint whose informal throttling starts in
   * the low thousands per hour - far enough inside it that a 429, which would
   * blank the row, stays unlikely.
   */
  MARKET_DATA_YAHOO_REALTIME_CACHE_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 1000),
  /**
   * Cache TTL for the DELAYED Yahoo rows (registry entries without `realtime`,
   * i.e. the TA-35 index), in ms. Default 15min: Yahoo republishes the TASE
   * feed about a quarter of an hour behind, so polling faster only burns an
   * undocumented, IP-throttled endpoint to re-read the same delayed number.
   */
  MARKET_DATA_YAHOO_CACHE_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  /**
   * Client refresh interval in ms. Default 10s, matching the fastest provider
   * TTL: a shorter interval would only re-serve cached rows, a longer one would
   * leave upstream data sitting on the server. The server cache means upstream
   * calls stay pinned to the provider TTL no matter how many visitors poll,
   * and stops entirely when nobody is watching.
   */
  MARKET_DATA_REFRESH_INTERVAL: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1000),
})

function readRawEnv(): Record<string, string | undefined> {
  // Node loads .env into process.env (see server.js); tests may also inject
  // values directly into process.env. Vite's `import.meta.env` is deliberately
  // NOT consulted - these variables must never reach the client bundle.
  return {
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    MARKET_DATA_CACHE_TTL: process.env.MARKET_DATA_CACHE_TTL,
    MARKET_DATA_FINNHUB_CACHE_TTL: process.env.MARKET_DATA_FINNHUB_CACHE_TTL,
    MARKET_DATA_YAHOO_REALTIME_CACHE_TTL: process.env.MARKET_DATA_YAHOO_REALTIME_CACHE_TTL,
    MARKET_DATA_YAHOO_CACHE_TTL: process.env.MARKET_DATA_YAHOO_CACHE_TTL,
    MARKET_DATA_REFRESH_INTERVAL: process.env.MARKET_DATA_REFRESH_INTERVAL,
  }
}

export type MarketConfig = z.infer<typeof configSchema>

/**
 * Pure: validates a raw env map into config. Exported so tests can assert the
 * built-in DEFAULTS (`parseMarketConfig({})`) rather than whatever the machine
 * running the tests happens to have in its .env.
 */
export function parseMarketConfig(raw: Record<string, string | undefined>): MarketConfig {
  const parsed = configSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid market configuration:\n${issues}`)
}

export const marketConfig: MarketConfig = parseMarketConfig(readRawEnv())

/**
 * How long a fetched batch stays fresh. The cadence is a property of the
 * INSTRUMENT, not just its provider: providers differ by how fast their data
 * moves (Finnhub is real-time, Frankfurter's ECB rate changes once a business
 * day) and one provider can serve both kinds of data at once - Yahoo carries
 * the live gold contract and the delayed TASE index - so an asset marked
 * `realtime` in the registry gets its provider's fast tier instead of the
 * default one. Each asset is polled at the speed its own market prints, never
 * faster:
 *
 *   realtime  SPY / QQQ / BTC (Finnhub, 10s), GOLD (Yahoo futures, 15s)
 *   delayed   TA-35 (Yahoo TASE feed, 15min)
 *   daily     USD/ILS (Frankfurter ECB rate, 15min)
 */
export function cacheTtlForAsset(
  asset: Pick<MarketAsset, 'provider' | 'realtime'>,
  config: MarketConfig = marketConfig,
): number {
  switch (asset.provider) {
    case 'finnhub':
      return config.MARKET_DATA_FINNHUB_CACHE_TTL
    case 'frankfurter':
      return config.MARKET_DATA_CACHE_TTL
    case 'yahoo':
      return asset.realtime
        ? config.MARKET_DATA_YAHOO_REALTIME_CACHE_TTL
        : config.MARKET_DATA_YAHOO_CACHE_TTL
  }
}

/**
 * A key must be present to build a provider; absent = disabled provider.
 * Read lazily (not at module load) so tests and runtime reloads observe the
 * current process.env rather than a snapshot taken at import time.
 */
export function getFinnhubKey(): string | undefined {
  const key = process.env.FINNHUB_API_KEY
  return key && key.trim() !== '' ? key : undefined
}
