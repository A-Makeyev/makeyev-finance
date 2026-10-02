import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { getAuthConfig, parseSocialProviders, buildBaseURLConfig } from './config'
import { getDb } from './mongo'
import { sendPasswordResetOtpEmail, sendVerificationEmail } from './email'
import { DEFAULT_ROLE } from './roles'

/**
 * The Better Auth instance. Built lazily and cached on globalThis: constructing
 * it opens the Mongo adapter, and Next both imports route modules during
 * `next build` (where no secrets exist) and hot-reloads modules in dev, so an
 * eager module-level instance would either break CI builds or leak
 * connection pools per edit.
 *
 * Auth library: Better Auth 1.7.x. It provides password hashing (scrypt),
 * session management and rate limiting, so none of that is hand-rolled here
 * (see AGENTS.md security rules). It is the stable line and its Next peer
 * range covers Next 16, unlike Auth.js v5, which is still published as beta.
 */

const globalForAuth = globalThis as unknown as {
  __authInstancePromise?: Promise<AuthInstance>
}

async function createAuth() {
  const config = getAuthConfig()
  const db = await getDb()
  const socialProviders = parseSocialProviders(process.env)

  return betterAuth({
    database: mongodbAdapter(db, {
      // The adapter defaults transactions ON when a client is supplied, but a
      // standalone Mongo (no replica set) rejects them outright. Keep them off
      // for the widest compatibility; turn on once the deployed Mongo is known
      // to be a replica set.
      transaction: false,
    }),
    secret: config.BETTER_AUTH_SECRET,
    // Resolved per request, allowlist-gated - see `buildBaseURLConfig`.
    baseURL: buildBaseURLConfig(config.BETTER_AUTH_URL),
    // Each provider is plain options, not a provider instance: Better Auth
    // 1.7 accepts the options object here and builds the provider itself.
    // Built conditionally, because an unconfigured provider must not be
    // registered (Better Auth would happily start its OAuth flow and die at
    // the token exchange). The set mirrors parseSocialProviders, the same
    // list the auth page's buttons render.
    socialProviders: {
      ...(socialProviders.includes('google')
        ? {
            google: {
              clientId: config.GOOGLE_CLIENT_ID!,
              clientSecret: config.GOOGLE_CLIENT_SECRET!,
              // Offline access: without a refresh token the linked Google
              // account cannot be used again after the first sign-in.
              accessType: 'offline' as const,
              // Always show the account chooser, so signing in as a different
              // Google user does not silently reuse the previous one.
              prompt: 'select_account' as const,
              // Copy the fresh Google profile (name, and above all the photo)
              // onto the user on every sign-in. Without this Better Auth only
              // stores the picture when it FIRST creates the user: an account
              // that started as email+password (or an earlier sign-in without
              // the profile scope) keeps user.image null forever, which is
              // why the navbar avatar showed the fallback instead of the
              // Google photo.
              overrideUserInfoOnSignIn: true,
            },
          }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      // Only require verification when mail can actually be sent, so a local or
      // CI run without Resend does not dead-end newly created accounts.
      requireEmailVerification: Boolean(config.RESEND_API_KEY),
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Better Auth leaves existing sessions alive after a reset unless this is
      // set, so a session stolen before the reset would keep working. A reset
      // is most often a response to a suspected compromise, so the sessions go
      // with it; the user signs in again with the password they just chose.
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }, request) => {
        await sendVerificationEmail({ user, url, request })
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: DEFAULT_ROLE,
          // Critical: without input:false Better Auth accepts role from the
          // signup payload, letting anyone self-assign "admin". Server-side
          // code sets it instead.
          input: false,
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      // Mongo-backed, so the limits hold across instances rather than resetting
      // per process. Better Auth creates the collection on first use.
      storage: 'database',
      customRules: {
        // Tighter than the default for the credential endpoints.
        '/sign-in/email': { window: 10, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/send-verification-email': { window: 60, max: 3 },
        // Password-reset entry points: an OTP request emails a real person, so
        // it must never be triggerable in a loop.
        '/email-otp/request-password-reset': { window: 60, max: 3 },
        '/email-otp/reset-password': { window: 60, max: 5 },
        '/email-otp/check-verification-otp': { window: 60, max: 5 },
      },
    },
    advanced: {
      // Render terminates TLS and forwards the client address here.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      // Render rewrites Host/scheme to the container's internal origin, so the
      // public pair arrives only via x-forwarded-*; without this the resolved
      // protocol is `http` and Google rejects the redirect_uri. Safe to trust
      // because allowedHosts re-checks the host before building it.
      trustedProxyHeaders: true,
    },
    plugins: [
      // Password reset with a 4-digit one-time code emailed to the user (the
      // request asks for a code instead of a magic link, so the flow stays on
      // the same page on mobile). storeOTP hashed: a Mongo dump must not carry
      // usable codes; 5 minutes is the plugin default, kept explicit.
      emailOTP({
        otpLength: 4,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        // The second argument is the endpoint context, not a bare Request
        // (that is the emailVerification callback below); the request is read
        // off it for the recipient's Accept-Language.
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== 'forget-password') {
            // Only the reset flow asks for a code today. Any other OTP type
            // reaching here means a new endpoint was wired without a mailer.
            throw new Error(`[auth] no OTP sender configured for type "${type}"`)
          }
          await sendPasswordResetOtpEmail({ email, otp, request: ctx?.request })
        },
      }),
      // Must stay last: writes Set-Cookie from server actions / RSC calls.
      nextCookies(),
    ],
  })
}

/**
 * The concrete instance type, inferred from the options literal. Using
 * `ReturnType<typeof betterAuth>` instead would resolve to the default
 * generic (Auth<BetterAuthOptions>), which the concrete options type is not
 * assignable to.
 */
type AuthInstance = Awaited<ReturnType<typeof createAuth>>

export function getAuth(): Promise<AuthInstance> {
  if (!globalForAuth.__authInstancePromise) {
    globalForAuth.__authInstancePromise = createAuth().catch((error: unknown) => {
      globalForAuth.__authInstancePromise = undefined
      throw error
    })
  }
  return globalForAuth.__authInstancePromise
}
