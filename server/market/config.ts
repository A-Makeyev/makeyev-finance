/**
 * Server market-data configuration. Only this module reads market-related
 * environment variables; everything else takes values from here.
 *
 * Security: FINNHUB_API_KEY is a server-only secret. It lives in the
 * git-ignored .env (loaded by node --env-file / dotenv in server.js), is
 * never imported by client code, and is never included in any API response.
 */
import { z } from 'zod'

const configSchema = z.object({
  FINNHUB_API_KEY: z.string().min(1).optional(),
  /** Cache TTL in ms. Default 6h: upstreams are effectively uncapped (Finnhub free key = 60 calls/min, no daily cap; Frankfurter is keyless), so this is just politeness. */
  MARKET_DATA_CACHE_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(6 * 60 * 60 * 1000),
  /** Client refresh interval in ms. Default 15min: 96 polls/day stay fully served from cache. */
  MARKET_DATA_REFRESH_INTERVAL: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
})

function readRawEnv(): Record<string, string | undefined> {
  // Node loads .env into process.env (see server.js); tests may also inject
  // values directly into process.env. Vite's `import.meta.env` is deliberately
  // NOT consulted - these variables must never reach the client bundle.
  return {
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    MARKET_DATA_CACHE_TTL: process.env.MARKET_DATA_CACHE_TTL,
    MARKET_DATA_REFRESH_INTERVAL: process.env.MARKET_DATA_REFRESH_INTERVAL,
  }
}

export const marketConfig = (() => {
  const parsed = configSchema.safeParse(readRawEnv())
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid market configuration:\n${issues}`)
})()

/**
 * A key must be present to build a provider; absent = disabled provider.
 * Read lazily (not at module load) so tests and runtime reloads observe the
 * current process.env rather than a snapshot taken at import time.
 */
export function getFinnhubKey(): string | undefined {
  const key = process.env.FINNHUB_API_KEY
  return key && key.trim() !== '' ? key : undefined
}
