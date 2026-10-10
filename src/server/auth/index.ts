import { betterAuth } from 'better-auth'
import {
  createAuthMiddleware,
  getSessionFromCtx,
  sendVerificationEmailFn,
} from 'better-auth/api'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { nextCookies } from 'better-auth/next-js'
import { emailOTP } from 'better-auth/plugins/email-otp'
import {
  getAuthConfig,
  parseSocialProviders,
  buildAccountLinkingConfig,
  buildBaseURLConfig,
} from './config'
import { getDb } from './mongo'
import { canSendMail } from '@/server/mail/config'
import { sendDeleteAccountEmail, sendPasswordResetOtpEmail, sendVerificationEmail } from './email'
import { duplicateSignUpError, signUpCollision } from './duplicateSignUp'
import { isSocialSignIn, releaseOrphanedAccounts } from './orphanedAccounts'
import { purgeUserData } from './deleteAccount'

/** The endpoint the confirmation mail links to, handled by the hook below. */
const DELETE_USER_CALLBACK_PATH = '/delete-user/callback'
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
      // Only require verification when mail can actually be sent, so a local
      // or CI run without mail credentials does not dead-end newly created
      // accounts. Keys off the same check every sender uses.
      requireEmailVerification: canSendMail(),
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Better Auth leaves existing sessions alive after a reset unless this is
      // set, so a session stolen before the reset would keep working. A reset
      // is most often a response to a suspected compromise, so the sessions go
      // with it; the user signs in again with the password they just chose.
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      // Clicking the link in the verification mail signs the account in as it
      // verifies it, so the browser lands on the callbackURL (the profile page)
      // already authenticated instead of being bounced to sign-in.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        await sendVerificationEmail({ user, url, request })
      },
    },
    account: {
      // One person is one user: signing in with Google joins the existing
      // account that already carries that address instead of creating a second
      // user for the same human. See `buildAccountLinkingConfig` for the
      // verified-email guard that keeps this from being a takeover path.
      accountLinking: buildAccountLinkingConfig(),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Social sign-in: release account rows whose user no longer exists.
        // Better Auth refuses to re-attach such a row, so one deleted user used
        // to dead-end every later Google sign-in on that address with
        // `?error=unable_to_link_account` even though the account itself was
        // fine. The release happens here, before the OAuth round trip, because
        // the stale row is only consulted in the callback. See
        // ./orphanedAccounts for why deleting it is safe.
        if (isSocialSignIn(ctx)) {
          const released = await releaseOrphanedAccounts(await getDb())
          if (released > 0) {
            console.warn(`[auth] released ${released} orphaned account row(s) before social sign-in`)
          }
          return
        }

        // The account-deletion link is only honoured for the session that asked
        // for it (the token is checked against that session's user), so opening
        // the mail on another device, signed out, answered a raw 404 JSON page.
        // Send that visitor to the sign-in page instead: the token is not
        // consumed until a session is present, so the link still works once
        // they sign in and open it again.
        if (ctx.path === DELETE_USER_CALLBACK_PATH) {
          const session = await getSessionFromCtx(ctx).catch(() => null)
          if (!session) {
            // `request` is optional on some middleware passes; baseURL is the
            // configured fallback so the redirect target is always absolute.
            const origin = new URL(ctx.request?.url ?? ctx.context.baseURL).origin
            throw ctx.redirect(`${origin}/login?error=delete_sign_in_required`)
          }
          return
        }

        // A sign-up on an address that already has an account, before the
        // endpoint can answer its generic 200 for it (Better Auth's
        // anti-enumeration default whenever verification is on, which the form
        // cannot tell apart from a real sign-up). See ./duplicateSignUp.
        const collision = await signUpCollision(
          { path: ctx.path, body: ctx.body },
          (address) => ctx.context.internalAdapter.findUserByEmail(address),
        )
        if (!collision) return

        // A verified account owns the address; the attempt is refused outright.
        // Without a mailer there is nothing to send to an unverified one either,
        // so that case takes the same answer.
        const canReVerify = Boolean(ctx.context.options.emailAndPassword?.requireEmailVerification)
        if (collision.verified || !canReVerify) {
          // Kept as a security signal: a duplicate attempt is either someone who
          // forgot they registered or someone probing which addresses exist. The
          // address is logged, never the password.
          console.warn(`[auth] rejected duplicate sign-up for ${collision.email}`)
          throw duplicateSignUpError()
        }

        // The row exists but was never verified, so it cannot be used and the
        // address is still up for grabs. Re-sending the verification mail is the
        // only way forward for whoever owns the address, and it is safe to send:
        // the mail goes to the address itself, never to the requester. Then fall
        // through to the endpoint's own duplicate handling, which answers the
        // generic success `requireEmailVerification` guarantees here - that is
        // what makes the form show the "verification email has been sent to"
        // panel with its resend action.
        console.warn(
          `[auth] re-sending verification for unverified sign-up on ${collision.email}`,
        )
        await sendVerificationEmailFn(ctx, collision.user)
      }),
    },
    user: {
      // Deletion is offered on the profile page behind a warning modal, and it
      // takes three presses to get there: confirm on the profile (with the
      // account's password when it has one), open the mailed link, then press
      // delete once more on the page that link lands on. Every step goes
      // through Better Auth's own delete machinery rather than a hand-rolled
      // delete, so sessions, account rows and the session cookie are removed
      // by the library that created them.
      deleteUser: {
        enabled: true,
        // Two independent proofs before anything is removed: the account's own
        // password when it has one (verified by Better Auth itself, see the
        // endpoint's `password` handling) and a link mailed to the address,
        // which is the same proof for every account ~ a Google-created account
        // has no password to ask for. The link lands on the profile page with
        // the token, where the last press is what deletes; the token is Better
        // Auth's, and nothing here is hand-rolled.
        sendDeleteAccountVerification: async ({ user, token }, request) => {
          await sendDeleteAccountEmail({ user, token, request })
        },
        // Explicit, because the copy promises 24 hours (the default value).
        deleteTokenExpiresIn: 24 * 60 * 60,
        afterDelete: async (user) => {
          // The user row is already gone at this point, so this cannot be
          // scoped by anything but the id Better Auth hands over. Removes the
          // caller's private rows; comments stay (see ./deleteAccount).
          const removed = await purgeUserData(user.id)
          console.log(`[auth] account deleted, removed ${removed} owned row(s)`)
        },
      },
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
        // Account deletion verifies the password, so it must not be a place to
        // guess passwords at the global rate: one delete per account ever, and
        // a handful of retries for a typo, is all a real user needs.
        '/delete-user': { window: 60, max: 10 },
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
