import type { Language } from '@/i18n'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'
import { getAuthConfig, publicOrigin } from './config'
import { sendMail, MailSendError } from '@/server/mail/client'
import { canSendMail } from '@/server/mail/config'
import { escapeHtml } from '@/server/mail/html'

/**
 * Verification-email delivery.
 *
 * The copy lives in the same i18n files as the rest of the site (`auth.emails`
 * in he.ts/en.ts) so a new language cannot be added to the UI while the email
 * silently stays Hebrew. Language is chosen from the recipient's
 * Accept-Language, because at verification time there is no session to read a
 * stored preference from.
 *
 * Nothing here is hand-rolled crypto: the token and URL are produced by Better
 * Auth; this module only renders and sends.
 */

/** First supported language named in an Accept-Language header wins; Hebrew is the default. */
export function pickEmailLanguage(acceptLanguage: string | null | undefined): Language {
  if (!acceptLanguage) return 'hebrew'
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? ''
  return first.startsWith('en') ? 'english' : 'hebrew'
}

export interface VerificationEmailContent {
  subject: string
  html: string
  text: string
}

/** The string keys of `auth.emails`, shared by both email builders. */
interface AuthEmailCopy {
  subject: string
  heading: string
  greetingPrefix: string
  greetingGeneric: string
  body: string
  cta: string
  ignore: string
  signature: string
  otpSubject: string
  otpHeading: string
  otpBody: string
  otpExpiry: string
  otpIgnore: string
  deleteSubject: string
  deleteHeading: string
  deleteBody: string
  deleteCta: string
  deleteIgnore: string
}

function authEmailCopy(language: Language): AuthEmailCopy {
  return language === 'english' ? en.translation.auth.emails : he.translation.auth.emails
}

/** Everything an action email needs: a heading, a greeting, a body and ONE link. */
interface ActionEmailCopy {
  subject: string
  heading: string
  greeting: string
  body: string
  cta: string
  ignore: string
  signature: string
  url: string
}

/**
 * The one template behind every "press this link" mail (verify the address,
 * confirm deleting the account). Sharing it is what keeps the two mail types
 * from drifting apart in direction, RTL/LTR handling, escaping or the CTA
 * treatment as the copy changes.
 */
function renderActionEmail(language: Language, copy: ActionEmailCopy): VerificationEmailContent {
  const dir = language === 'hebrew' ? 'rtl' : 'ltr'
  const lang = language === 'hebrew' ? 'he' : 'en'
  const safeUrl = escapeHtml(copy.url)

  const html = [
    `<!doctype html>`,
    `<html lang="${lang}" dir="${dir}">`,
    `<body style="margin:0;padding:24px;background:#f4f4f4;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">`,
    `<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:start;">`,
    `<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(copy.heading)}</h1>`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(copy.greeting)}</p>`,
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(copy.body)}</p>`,
    // The CTA is the one action in the mail, so it spans the card as a block
    // with centered text rather than hugging the start edge (user-requested).
    // box-sizing:border-box keeps the 20px side padding inside 100%, so the
    // button never overflows the 520px card in any client.
    `<p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:block;width:100%;box-sizing:border-box;padding:12px 20px;background:#0f5c4b;color:#ffffff;border-radius:8px;text-decoration:none;font-size:15px;text-align:center;">${escapeHtml(copy.cta)}</a></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(copy.ignore)}</p>`,
    `<p style="margin:0;font-size:13px;color:#777777;">${escapeHtml(copy.signature)}</p>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join('')

  const text = [
    copy.heading,
    '',
    copy.greeting,
    '',
    copy.body,
    '',
    `${copy.cta}: ${copy.url}`,
    '',
    copy.ignore,
    '',
    copy.signature,
  ].join('\n')

  return { subject: copy.subject, html, text }
}

/** The greeting both action emails share: the name when we have one. */
function greetingFor(t: AuthEmailCopy, name?: string | null): string {
  return name ? `${t.greetingPrefix} ${name},` : t.greetingGeneric
}

/** Pure: renders the verification email in the requested language. */
export function buildVerificationEmail(
  language: Language,
  url: string,
  name?: string | null,
): VerificationEmailContent {
  const t = authEmailCopy(language)
  return renderActionEmail(language, {
    subject: t.subject,
    heading: t.heading,
    greeting: greetingFor(t, name),
    body: t.body,
    cta: t.cta,
    ignore: t.ignore,
    signature: t.signature,
    url,
  })
}

/**
 * Pure: renders the account-deletion email. The link is the proof that
 * whoever is deleting the account also controls its address, and it is what
 * finally deletes it: nothing happens until the profile page it lands on
 * confirms with the token.
 */
export function buildDeleteAccountEmail(
  language: Language,
  url: string,
  name?: string | null,
): VerificationEmailContent {
  const t = authEmailCopy(language)
  return renderActionEmail(language, {
    subject: t.deleteSubject,
    heading: t.deleteHeading,
    greeting: greetingFor(t, name),
    body: t.deleteBody,
    cta: t.deleteCta,
    ignore: t.deleteIgnore,
    signature: t.signature,
    url,
  })
}

export interface VerificationEmailArgs {
  /** Only `name` and `email` are read here; nothing else from the user record. */
  user: { name?: string | null; email: string }
  /** The verification URL Better Auth generated. Carries a token: never logged. */
  url: string
  /** Used for the Accept-Language header only. */
  request?: Request
}

let warnedAboutDelivery = false

/**
 * Logs an auth-mail failure. The mail client already logged the Resend error
 * name; this adds the auth context. The first failure gets the actionable
 * version (check the API key and sender), so a misconfigured sender does not
 * print the same paragraph on every sign-up.
 */
function logAuthMailFailure(label: string, error: unknown): void {
  const code = error instanceof MailSendError ? error.code : 'unknown'
  if (!warnedAboutDelivery) {
    warnedAboutDelivery = true
    console.error(
      `[auth] ${label} could not be delivered (${code}). Check the Resend API key and the sender address.`,
    )
    return
  }
  console.error(`[auth] ${label} failed (${code}).`)
}

/**
 * Sends one action email through Resend.
 *
 * Failures are logged and swallowed: the request that triggered it already
 * succeeded, and an error here must not disclose whether an address is
 * registered or whether an account exists.
 *
 * The `build` callback receives the resolved language, so the one URL that
 * depends on the language (the deletion link, which lands on the profile page
 * of the mail's own language) can be built from it. The URL carries a
 * single-purpose token, so it is never logged; neither is the address.
 */
async function sendActionEmail(
  args: { user: { name?: string | null; email: string }; request?: Request },
  build: (language: Language) => VerificationEmailContent,
  label: string,
): Promise<void> {
  if (!canSendMail()) {
    console.warn(`[mail] not configured; ${label} not sent.`)
    return
  }

  const language = pickEmailLanguage(args.request?.headers.get('accept-language'))
  const { subject, html, text } = build(language)

  try {
    await sendMail({ to: args.user.email, subject, html, text })
  } catch (error) {
    // Swallow: the request that triggered this already succeeded, and an error
    // here must not disclose whether an address is registered or whether an
    // account exists.
    logAuthMailFailure(label, error)
  }
}

/** Sends the address-verification email. */
export async function sendVerificationEmail(args: VerificationEmailArgs): Promise<void> {
  await sendActionEmail(
    args,
    (language) => buildVerificationEmail(language, args.url, args.user.name),
    'verification email',
  )
}

export interface DeleteAccountEmailArgs {
  user: { name?: string | null; email: string }
  /** Better Auth's single-use deletion token. Never logged. */
  token: string
  /** Used for the Accept-Language header and the link's origin. */
  request?: Request
}

/**
 * Where the deletion link lands: the profile page of the mail's own language,
 * carrying the token. Better Auth builds its own `url` for this mail, but that
 * one points at its callback endpoint, which deletes on GET. Opening the link
 * is not the confirmation the product wants, so the link is rebuilt here to
 * land on the profile page, where the last step is a button.
 *
 * Pure, so the URL shape is unit-tested instead of assumed.
 */
export function deleteConfirmationUrl(language: Language, origin: string, token: string): string {
  const path = language === 'english' ? '/en/profile' : '/profile'
  return `${origin.replace(/\/+$/, '')}${path}?delete=${encodeURIComponent(token)}`
}

/**
 * The deployment's own origin, for a link that has to come back to this app.
 * The request's origin first (that is where the user actually is), then the
 * configured-or-compiled public origin (see `publicOrigin`). That fallback is
 * always absolute, so a mail link is never built from an unrecognised host.
 */
function appOrigin(request: Request | undefined, configured: string | undefined): string | null {
  try {
    if (request) return new URL(request.url).origin
  } catch {
    // Fall through to the configured origin.
  }
  if (!configured) return null
  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

/** Sends the account-deletion email: a link to the profile page, where the deletion is confirmed. */
export async function sendDeleteAccountEmail(args: DeleteAccountEmailArgs): Promise<void> {
  const origin = appOrigin(args.request, publicOrigin(getAuthConfig().BETTER_AUTH_URL))
  if (!origin) {
    console.warn('[auth] no app origin available; account-deletion email not sent.')
    return
  }
  await sendActionEmail(
    args,
    (language) =>
      buildDeleteAccountEmail(
        language,
        deleteConfirmationUrl(language, origin, args.token),
        args.user.name,
      ),
    'account-deletion email',
  )
}

export interface OtpEmailArgs {
  /** The one-time code, exactly as the user should read it (4 digits here). */
  otp: string
  /** The address the mail goes to; used only for sending, never logged. */
  email: string
  request?: Request
}

/**
 * Sends the password-reset one-time code through Resend. The code is short
 * lived (5 minutes, see the plugin options in src/server/auth/index.ts) and
 * single purpose: the email says what it is for, so a phished code cannot be
 * replayed as a login.
 *
 * Never logs the address or the code itself.
 */
export async function sendPasswordResetOtpEmail(args: OtpEmailArgs): Promise<void> {
  if (!canSendMail()) {
    console.warn('[mail] not configured; password-reset OTP not sent.')
    return
  }

  const language = pickEmailLanguage(args.request?.headers.get('accept-language'))
  const { subject, html, text } = buildOtpEmail(language, args.otp)

  try {
    await sendMail({ to: args.email, subject, html, text })
  } catch (error) {
    // Same policy as verification mail: a failure is logged and swallowed so
    // the request cannot disclose account existence or crash the flow.
    logAuthMailFailure('password-reset OTP email', error)
  }
}

/**
 * Pure: renders the password-reset code email. A code email carries no link:
 * the user types the code into the form they came from, which is both the
 * mobile-friendlier flow and immune to link-scanning prefetch.
 */
export function buildOtpEmail(language: Language, otp: string): VerificationEmailContent {
  const t = authEmailCopy(language)
  const dir = language === 'hebrew' ? 'rtl' : 'ltr'
  const lang = language === 'hebrew' ? 'he' : 'en'
  const safeOtp = escapeHtml(otp)

  const html = [
    `<!doctype html>`,
    `<html lang="${lang}" dir="${dir}">`,
    `<body style="margin:0;padding:24px;background:#f4f4f4;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">`,
    `<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:start;">`,
    `<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(t.otpHeading)}</h1>`,
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(t.otpBody)}</p>`,
    `<p style="margin:0 0 24px;text-align:start;"><span dir="ltr" style="display:inline-block;color:#0f5c4b;font-size:26px;letter-spacing:8px;font-weight:700;">${safeOtp}</span></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(t.otpExpiry)}</p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(t.otpIgnore)}</p>`,
    `<p style="margin:0;font-size:13px;color:#777777;">${escapeHtml(t.signature)}</p>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join('')

  const text = [t.otpHeading, '', t.otpBody, '', otp, '', t.otpExpiry, '', t.otpIgnore, '', t.signature].join('\n')

  return { subject: t.otpSubject, html, text }
}
