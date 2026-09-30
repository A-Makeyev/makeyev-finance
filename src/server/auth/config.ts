import { z } from 'zod'

/**
 * Server-only auth configuration. Only this module reads auth-related
 * environment variables; everything else takes values from here.
 *
 * Security: MONGODB_URI, BETTER_AUTH_SECRET and RESEND_API_KEY are server-only
 * secrets. They live in the git-ignored .env, are never prefixed
 * NEXT_PUBLIC_, and are never imported by client code (see SECURITY.md).
 *
 * Everything is OPTIONAL in the schema and validated at first use instead of
 * at module load: `next build` imports this module while collecting route
 * metadata, where no secrets exist (CI builds with none), so throwing at
 * import time would break the build.
 */
const authConfigSchema = z.object({
  /** Mongo connection string, database name included. Required at runtime. */
  MONGODB_URI: z.string().min(1).optional(),
  /**
   * Better Auth's signing secret. Required in production; Better Auth
   * auto-generates one in development (and warns), which invalidates sessions
   * on restart, so set it locally too. Minimum 32 chars, as Better Auth
   * requires when one is supplied.
   */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
    .optional(),
  /** Public origin Better Auth builds links from. Inferred from the request when unset. */
  BETTER_AUTH_URL: z.string().url().optional(),
  /**
   * From address for verification emails. The default is Resend's onboarding
   * sender, which only delivers to the account owner's address - a verified
   * domain must be substituted for real users.
   */
  AUTH_EMAIL_FROM: z.string().min(1).default('Makeyev Finance <onboarding@resend.dev>'),
  /**
   * Resend API key. Missing = verification email sending is disabled and the
   * requirement is relaxed, so the app still runs locally and in CI without
   * any real secret.
   */
  RESEND_API_KEY: z.string().min(1).optional(),
  /**
   * Social sign-in client id/secret (Google, the only provider). The pair
   * enables it: missing = the provider is not registered with Better Auth and
   * its button does not appear on the auth page (the socialButtons list on
   * the client mirrors the same env). Server-only secrets; the id alone would
   * still live here so the client never hard-codes provider availability.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
})

/** The social providers this deployment has credentials for, in display order. */
export const SOCIAL_PROVIDER_IDS = ['google'] as const

export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number]

/**
 * Pure: which social providers the raw env enables. Exported so the client
 * can render the same set without importing server code (it is mirrored into
 * a NEXT_PUBLIC_* pair in next.config.ts).
 */
export function parseSocialProviders(raw: Record<string, string | undefined>): SocialProviderId[] {
  const enabled: SocialProviderId[] = []
  const pairs: Array<[SocialProviderId, string | undefined, string | undefined]> = [
    ['google', raw.GOOGLE_CLIENT_ID, raw.GOOGLE_CLIENT_SECRET],
  ]
  for (const [id, clientId, clientSecret] of pairs) {
    if (clientId && clientSecret) enabled.push(id)
  }
  return enabled
}

export type AuthConfig = z.infer<typeof authConfigSchema>

function readRawEnv(): Record<string, string | undefined> {
  // Node/Next load .env into process.env. Deliberately not import.meta.env:
  // these must never reach the client bundle.
  return {
    MONGODB_URI: process.env.MONGODB_URI,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }
}

/**
 * Pure: validates a raw env map into config. Exported so tests can assert the
 * defaults without depending on whatever the machine's real .env contains.
 */
export function parseAuthConfig(raw: Record<string, string | undefined>): AuthConfig {
  const parsed = authConfigSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid auth configuration:\n${issues}`)
}

/** Reads and validates the current process env. Never cached, so tests can vary it. */
export function getAuthConfig(): AuthConfig {
  return parseAuthConfig(readRawEnv())
}

/** True when verification emails can actually be delivered. */
export function canSendAuthEmail(config: AuthConfig = getAuthConfig()): boolean {
  return Boolean(config.RESEND_API_KEY)
}
