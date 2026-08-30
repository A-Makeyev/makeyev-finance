import { z } from 'zod'

/**
 * Client environment schema. All VITE_* vars are baked into the bundle and are
 * therefore PUBLIC by design. Server-only secrets must never live here.
 * See SECURITY.md for the extraction ledger from the legacy codebase.
 */
const envSchema = z.object({
  VITE_EMAILJS_SERVICE_ID: z.string().min(1),
  VITE_EMAILJS_TEMPLATE_ID: z.string().min(1),
  VITE_EMAILJS_PUBLIC_KEY: z.string().min(1),
  VITE_BOI_INTEREST_URL: z.string().url().default('https://www.boi.org.il/PublicApi/GetInterest'),
  VITE_CBS_API_BASE: z.string().url().default('https://api.cbs.gov.il/index/data/price'),
})

/**
 * Legacy fallbacks - the exact values the original site shipped inline in its
 * HTML/JS (EmailJS public key + service/template are client-exposed by
 * design, so missing env must degrade to the legacy working configuration,
 * never to a disabled placeholder).
 */
const LEGACY_DEFAULTS = {
  VITE_EMAILJS_SERVICE_ID: 'service_k2c0eve',
  VITE_EMAILJS_TEMPLATE_ID: 'template_kmxsnuc',
  VITE_EMAILJS_PUBLIC_KEY: '2y064p5z9qRvVxOHN',
} as const

export type AppEnv = z.infer<typeof envSchema>

const rawEnv = {
  VITE_EMAILJS_SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  VITE_EMAILJS_TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  VITE_EMAILJS_PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  VITE_BOI_INTEREST_URL: import.meta.env.VITE_BOI_INTEREST_URL,
  VITE_CBS_API_BASE: import.meta.env.VITE_CBS_API_BASE,
}

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
    VITE_EMAILJS_SERVICE_ID:
      rawEnv.VITE_EMAILJS_SERVICE_ID ?? LEGACY_DEFAULTS.VITE_EMAILJS_SERVICE_ID,
    VITE_EMAILJS_TEMPLATE_ID:
      rawEnv.VITE_EMAILJS_TEMPLATE_ID ?? LEGACY_DEFAULTS.VITE_EMAILJS_TEMPLATE_ID,
    VITE_EMAILJS_PUBLIC_KEY:
      rawEnv.VITE_EMAILJS_PUBLIC_KEY ?? LEGACY_DEFAULTS.VITE_EMAILJS_PUBLIC_KEY,
    VITE_BOI_INTEREST_URL:
      rawEnv.VITE_BOI_INTEREST_URL ?? 'https://www.boi.org.il/PublicApi/GetInterest',
    VITE_CBS_API_BASE: rawEnv.VITE_CBS_API_BASE ?? 'https://api.cbs.gov.il/index/data/price',
  }
}

export const env = loadEnv()
