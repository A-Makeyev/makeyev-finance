import { z } from 'zod'

/**
 * Client environment schema for the Next app.
 *
 * Next exposes client-side variables through NEXT_PUBLIC_*; this module is the
 * single adaptation point, so the rest of the code reads clean names without a
 * bundler prefix. All of these are PUBLIC by design - they are baked into the
 * client bundle either way (the bare spellings are inlined via `next.config.ts`
 * `env`; see the note there). Server-only secrets must never live here. See
 * SECURITY.md for the extraction ledger from the legacy codebase.
 *
 * Mail has no client variables at all now: the browser calls our own
 * `/api/contact`, and Resend is reached from the server only.
 */
const envSchema = z.object({
  BOI_INTEREST_URL: z.string().url().default('https://www.boi.org.il/PublicApi/GetInterest'),
  CBS_API_BASE: z.string().url().default('https://api.cbs.gov.il/index/data/price'),
})

/**
 * First non-empty value, else undefined.
 *
 * Callers MUST pass literal `process.env.X` accesses. This module is bundled for
 * the browser, which only receives env values through the bundler's static
 * substitution of `process.env.NAME`; a dynamic `process.env[name]` cannot be
 * substituted and silently read as undefined.
 */
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== '') return value
  }
  return undefined
}

/**
 * Precedence per variable: NEXT_PUBLIC_* (the Next convention) first, then
 * the bare name (what deploy configs and .env carry).
 */
const rawEnv = {
  BOI_INTEREST_URL: firstNonEmpty(
    process.env.NEXT_PUBLIC_BOI_INTEREST_URL,
    process.env.BOI_INTEREST_URL,
  ),
  CBS_API_BASE: firstNonEmpty(process.env.NEXT_PUBLIC_CBS_API_BASE, process.env.CBS_API_BASE),
}

export type AppEnv = z.infer<typeof envSchema>

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(rawEnv)
  if (parsed.success) return parsed.data

  const message = `Invalid environment configuration - falling back to defaults:\n${parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')}`
  console.warn(`[env] ${message}`)
  // A malformed URL must degrade to a working endpoint, not be passed through.
  return {
    BOI_INTEREST_URL: 'https://www.boi.org.il/PublicApi/GetInterest',
    CBS_API_BASE: 'https://api.cbs.gov.il/index/data/price',
  }
}

export const env = loadEnv()
