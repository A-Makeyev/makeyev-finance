import { z } from 'zod'

/**
 * Server-only auth configuration. Only this module reads auth-related
 * environment variables; everything else takes values from here.
 *
 * Security: MONGODB_URI and BETTER_AUTH_SECRET are server-only secrets. They
 * live in the git-ignored .env, are never prefixed NEXT_PUBLIC_, and are never
 * imported by client code (see SECURITY.md). The mail credentials live in
 * `src/server/mail/config.ts`; this module does not read them.
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
 * Public origins this project is deployed to. Not secrets, so they live in the
 * code instead of the environment: a deployment then needs no BETTER_AUTH_URL
 * to be reachable. Without this, an env-less deployment allowed only loopback
 * hosts, so every request to the public host threw and answered 500 ~ that is
 * exactly what happened on Render.
 *
 * Exact hosts, not a wildcard: a forged Host header still cannot become an
 * OAuth `redirect_uri`. Renaming the service or adding a custom domain is a
 * code change; BETTER_AUTH_URL stays supported as an extra origin for anything
 * this list does not name (e.g. a preview deploy).
 */
export const DEPLOY_ORIGINS = ['https://makeyev-finance.onrender.com'] as const

/**
 * The origin a mail link or fallback should point at: the explicitly configured
 * BETTER_AUTH_URL when present, otherwise the compiled deploy origin. Always
 * absolute.
 */
export function publicOrigin(authUrl: string | undefined): string {
  return authUrl ?? DEPLOY_ORIGINS[0]
}

/**
 * Better Auth's dynamic `baseURL`: resolved per request instead of pinned, so
 * each environment need not know its own origin. `allowedHosts` is what makes
 * that safe - an unrecognised Host resolves to `fallback`, never to the host in
 * the request.
 */
export function buildBaseURLConfig(authUrl: string | undefined) {
  const publicOrigins = authUrl ? [...DEPLOY_ORIGINS, authUrl] : [...DEPLOY_ORIGINS]
  const allowedHosts = [
    ...LOCAL_HOST_PATTERNS,
    ...publicOrigins.map((origin) => new URL(origin).host),
  ]
  return {
    allowedHosts,
    /**
     * `auto`: the scheme is derived per request from `x-forwarded-proto`
     * (trusted, because `advanced.trustedProxyHeaders` is on) and otherwise
     * from the request URL. Render forwards `https`, so public requests
     * resolve to https, and loopback requests resolve to http. Pinning a scheme
     * here is what used to mark local cookies `Secure` and made the Google
     * `state` cookie vanish over http://localhost (a `state_mismatch`), so it is
     * deliberately not pinned.
     */
    protocol: 'auto' as const,
    fallback: publicOrigin(authUrl),
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
