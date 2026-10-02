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
 */
const envSchema = z.object({
  EMAILJS_SERVICE_ID: z.string().min(1),
  EMAILJS_TEMPLATE_ID: z.string().min(1),
  EMAILJS_PUBLIC_KEY: z.string().min(1),
  BOI_INTEREST_URL: z.string().url().default('https://www.boi.org.il/PublicApi/GetInterest'),
  CBS_API_BASE: z.string().url().default('https://api.cbs.gov.il/index/data/price'),
})

/**
 * Legacy fallbacks - the exact values the original site shipped inline in its
 * HTML/JS (EmailJS public key + service/template are client-exposed by
 * design, so missing env must degrade to the legacy working configuration,
 * never to a disabled placeholder).
 */
const LEGACY_DEFAULTS = {
  EMAILJS_SERVICE_ID: 'service_k2c0eve',
  EMAILJS_TEMPLATE_ID: 'template_kmxsnuc',
  EMAILJS_PUBLIC_KEY: '2y064p5z9qRvVxOHN',
} as const

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
  EMAILJS_SERVICE_ID: firstNonEmpty(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
    process.env.EMAILJS_SERVICE_ID,
  ),
  EMAILJS_TEMPLATE_ID: firstNonEmpty(
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
  ),
  EMAILJS_PUBLIC_KEY: firstNonEmpty(
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
    process.env.EMAILJS_PUBLIC_KEY,
  ),
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

  // Missing credentials fall back to the legacy inline values (public by
  // design) so local dev / preview builds keep a working send pipeline.
  const message = `Invalid environment configuration - falling back to legacy inline credentials:\n${parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')}`
  console.warn(`[env] ${message}`)
  return {
    EMAILJS_SERVICE_ID: rawEnv.EMAILJS_SERVICE_ID ?? LEGACY_DEFAULTS.EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID: rawEnv.EMAILJS_TEMPLATE_ID ?? LEGACY_DEFAULTS.EMAILJS_TEMPLATE_ID,
    EMAILJS_PUBLIC_KEY: rawEnv.EMAILJS_PUBLIC_KEY ?? LEGACY_DEFAULTS.EMAILJS_PUBLIC_KEY,
    BOI_INTEREST_URL: rawEnv.BOI_INTEREST_URL ?? 'https://www.boi.org.il/PublicApi/GetInterest',
    CBS_API_BASE: rawEnv.CBS_API_BASE ?? 'https://api.cbs.gov.il/index/data/price',
  }
}

export const env = loadEnv()
