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
  /**
   * This deployment's public origin, when it is not localhost. Contributes the
   * host to accept and the fallback origin (see `buildBaseURLConfig`); a purely
   * local run needs no value.
   */
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

/** Loopback hosts, any port: dev (3000), e2e (3100) and `next dev -p` all vary. */
const LOCAL_HOST_PATTERNS = ['localhost:*', '127.0.0.1:*', '[::1]:*']

/**
 * Better Auth's dynamic `baseURL`: resolved per request instead of pinned, so
 * each environment need not know its own origin. `allowedHosts` is what makes
 * that safe - an unrecognised Host is rejected rather than used to build an
 * OAuth `redirect_uri`. Without a known origin there is no fallback, so a bad
 * Host fails loud.
 */
export function buildBaseURLConfig(authUrl: string | undefined) {
  const allowedHosts = [...LOCAL_HOST_PATTERNS]
  if (authUrl) allowedHosts.push(new URL(authUrl).host)
  const https = authUrl ? new URL(authUrl).protocol === 'https:' : false
  return {
    allowedHosts,
    /**
     * The scheme Better Auth flags cookies for. Without it (a dynamic config
     * with no `protocol`) the decision falls through to NODE_ENV, so a
     * PRODUCTION build marks every cookie `Secure` - including the `state`
     * cookie the Google round trip depends on. Served over http://localhost
     * that cookie is dropped by strict browsers, and the callback then fails
     * with `state_mismatch` (see the auth page's `?error=` copy). Local
     * origins are http by definition; a configured public origin carries its
     * own scheme (https on Render). This only sets cookie attributes for the
     * local case - it never widens what a deployment trusts.
     */
    protocol: https ? ('https' as const) : ('http' as const),
    ...(authUrl ? { fallback: authUrl } : {}),
  }
}

/**
 * Account linking policy: one person is one user, whichever way they sign in.
 *
 * Google is the only trusted provider here, and that is a decision rather than
 * a default: Google verifies the addresses it returns, so a Google sign-in may
 * join the existing account carrying the same address instead of creating a
 * second user for the same person. Any provider added later must be vetted for
 * that property first, because a provider that hands over an unverified
 * address would let it claim an account it does not own.
 *
 * `requireLocalEmailVerified` is pinned to true on purpose. It is what keeps
 * the linking from being a takeover path: an email-created account that was
 * never verified is NOT joined, so registering a stranger's address with a
 * password does not hand that account over the moment the real owner signs in
 * with Google. Setting it to false reopens exactly that path, so do not.
 */
export type AccountLinkingOptions = {
  enabled: boolean
  trustedProviders: SocialProviderId[]
  updateUserInfoOnLink: boolean
  requireLocalEmailVerified: boolean
}

export function buildAccountLinkingConfig(): AccountLinkingOptions {
  return {
    enabled: true,
    trustedProviders: ['google'],
    // Carry the fresh Google name and photo onto a newly linked user, the same
    // policy the Google provider already applies on every sign-in.
    updateUserInfoOnLink: true,
    requireLocalEmailVerified: true,
  }
}

/**
 * Blank (empty or whitespace-only) means "not configured", not "configured to
 * nothing". .env entries left as `KEY=` reach process.env as '', which fails
 * the schema's .min(1)/.url() rules and turns every auth request into
 * "Invalid auth configuration". Normalizing here (the raw read, not the schema)
 * keeps parseAuthConfig's explicit-empty-MONGODB_URI rejection intact for
 * callers that pass a truly empty value directly.
 */
function blankToUndefined(v: string | undefined) {
  return v?.trim() ? v : undefined
}

function readRawEnv(): Record<string, string | undefined> {
  // Node/Next load .env into process.env. Deliberately not import.meta.env:
  // these must never reach the client bundle.
  return {
    MONGODB_URI: blankToUndefined(process.env.MONGODB_URI),
    BETTER_AUTH_SECRET: blankToUndefined(process.env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: blankToUndefined(process.env.BETTER_AUTH_URL),
    AUTH_EMAIL_FROM: blankToUndefined(process.env.AUTH_EMAIL_FROM),
    RESEND_API_KEY: blankToUndefined(process.env.RESEND_API_KEY),
    GOOGLE_CLIENT_ID: blankToUndefined(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: blankToUndefined(process.env.GOOGLE_CLIENT_SECRET),
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
