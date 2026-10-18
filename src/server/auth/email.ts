import type { Language } from '@/i18n'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'
import { sendMail, MailSendError } from '@/server/mail/client'
import { canSendMail } from '@/server/mail/config'
import { escapeHtml } from '@/server/mail/html'

/**
 * Auth-email delivery: verify the address, reset the password, confirm an
 * account deletion.
 *
 * The copy lives in the same i18n files as the rest of the site (`auth.emails`
 * in he.ts/en.ts) so a new language cannot be added to the UI while the email
 * silently stays Hebrew. The language is the one the user is looking at when
 * they trigger the mail, so an English browser on the Hebrew site gets Hebrew
 * mail (and any link it carries lands on the Hebrew pages).
 *
 * Nothing here is hand-rolled crypto: the token, URL and code are produced by
 * Better Auth; this module only renders and sends.
 */

/** First supported language named in an Accept-Language header wins; Hebrew is the default. */
export function pickEmailLanguage(acceptLanguage: string | null | undefined): Language {
  if (!acceptLanguage) return 'hebrew'
  const first = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? ''
  return first.startsWith('en') ? 'english' : 'hebrew'
}

/**
 * The language the auth email should be written in.
 *
 * The page the request came from is the strongest signal: locale lives in the
 * path (`/en/...` is English, everything unprefixed is Hebrew), and a
 * same-origin auth request carries that page in `Referer`. Browsers advertise
 * their own UI language in `Accept-Language`, which is why a Hebrew user with
 * an English browser was getting English mail and an English deletion link;
 * the app sets that header too (src/lib/auth-client.ts), and this keeps the
 * server honest even when a request arrives without it.
 *
 * `Accept-Language` stays as the fallback for requests that have no referrer
 * (a direct API call, a prefetch, a client that strips it). Hebrew is the
 * default, matching the unprefixed site.
 */
export function emailLanguageForRequest(request: Request | undefined): Language {
  const headers = request?.headers
  const referer = headers?.get('referer') ?? headers?.get('referrer')
  if (referer) {
    try {
      const path = new URL(referer).pathname
      return path === '/en' || path.startsWith('/en/') ? 'english' : 'hebrew'
    } catch {
      // A malformed referrer is not a language signal; fall through.
    }
  }
  return pickEmailLanguage(headers?.get('accept-language'))
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
  deleteExpiry: string
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
  // Direction and alignment are repeated on the body, the wrapper table and the
  // content cell: plenty of mail clients ignore `dir` on <html> and render the
  // message from the table instead, which is why a Hebrew mail could show up
  // left-aligned. text-align is spelled right/left rather than `start` for the
  // same reason ~ `start` only means anything once the direction is honoured.
  const align = language === 'hebrew' ? 'right' : 'left'
  const safeUrl = escapeHtml(copy.url)

  const html = [
    `<!doctype html>`,
    `<html lang="${lang}" dir="${dir}">`,
    `<body dir="${dir}" style="margin:0;padding:24px;background:#f4f4f4;">`,
    `<table role="presentation" width="100%" dir="${dir}" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">`,
    `<tr><td dir="${dir}" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:${align};">`,
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

/** Everything a code email needs: a heading, a body and the code itself. */
interface CodeEmailCopy {
  subject: string
  heading: string
  body: string
  code: string
  expiry: string
  ignore: string
  signature: string
}

/**
 * The one template behind every "type this code" mail (reset the password,
 * confirm deleting the account). Sharing it keeps the two from drifting apart
 * in direction, RTL/LTR handling, escaping or the code treatment, and it is
 * the code sibling of renderActionEmail above: a code mail carries no link at
 * all, which is also what makes it immune to link-scanning prefetch.
 */
function renderCodeEmail(language: Language, copy: CodeEmailCopy): VerificationEmailContent {
  const dir = language === 'hebrew' ? 'rtl' : 'ltr'
  const lang = language === 'hebrew' ? 'he' : 'en'
  // Same repetition as renderActionEmail: the direction has to survive clients
  // that ignore <html dir>, or a Hebrew code mail reads left to right.
  const align = language === 'hebrew' ? 'right' : 'left'
  const safeCode = escapeHtml(copy.code)

  const html = [
    `<!doctype html>`,
    `<html lang="${lang}" dir="${dir}">`,
    `<body dir="${dir}" style="margin:0;padding:24px;background:#f4f4f4;">`,
    `<table role="presentation" width="100%" dir="${dir}" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">`,
    `<tr><td dir="${dir}" style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:${align};">`,
    `<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(copy.heading)}</h1>`,
    `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(copy.body)}</p>`,
    // The code is LTR in both languages: it is a sequence of Latin letters and
    // digits, and letting it ride the Hebrew direction would reorder it.
    `<p style="margin:0 0 24px;text-align:${align};"><span dir="ltr" style="display:inline-block;color:#0f5c4b;font-size:26px;letter-spacing:8px;font-weight:700;">${safeCode}</span></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(copy.expiry)}</p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(copy.ignore)}</p>`,
    `<p style="margin:0;font-size:13px;color:#777777;">${escapeHtml(copy.signature)}</p>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join('')

  const text = [
    copy.heading,
    '',
    copy.body,
    '',
    copy.code,
    '',
    copy.expiry,
    '',
    copy.ignore,
    '',
    copy.signature,
  ].join('\n')

  return { subject: copy.subject, html, text }
}

/**
 * Pure: renders the account-deletion CODE email. The code is the proof that
 * whoever is deleting the account also controls its address, and it is what
 * finally deletes it: typing it in the profile's delete modal is the last step.
 */
export function buildDeleteCodeEmail(
  language: Language,
  code: string,
): VerificationEmailContent {
  const t = authEmailCopy(language)
  return renderCodeEmail(language, {
    subject: t.deleteSubject,
    heading: t.deleteHeading,
    body: t.deleteBody,
    code,
    expiry: t.deleteExpiry,
    ignore: t.deleteIgnore,
    signature: t.signature,
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
 * registered or whether an account exists. Used for the link-carrying mail
 * (verify the address); the code mails (reset the password, confirm deletion)
 * go through sendPasswordResetOtpEmail / sendDeleteCodeEmail instead. The
 * `build` callback receives the resolved language. The URL carries a
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

  const language = emailLanguageForRequest(args.request)
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

export interface DeleteCodeEmailArgs {
  user: { name?: string | null; email: string }
  /** The code the user must type in the delete modal. Never logged. */
  code: string
  /** Used to resolve the mail's language (the page it came from). */
  request?: Request
}

/**
 * Sends the account-deletion CODE email. The code is short lived (30 minutes,
 * see DELETE_CODE_TTL_SECONDS) and single purpose: the mail says what it is
 * for, so a phished code cannot be replayed anywhere else.
 *
 * Never logs the address or the code itself. A delivery failure is logged and
 * swallowed, like every other auth mail: the request that triggered it already
 * succeeded, and an error here must not disclose whether an account exists.
 */
export async function sendDeleteCodeEmail(args: DeleteCodeEmailArgs): Promise<void> {
  if (!canSendMail()) {
    console.warn('[mail] not configured; account-deletion code not sent.')
    return
  }

  const language = emailLanguageForRequest(args.request)
  const { subject, html, text } = buildDeleteCodeEmail(language, args.code)

  try {
    await sendMail({ to: args.user.email, subject, html, text })
  } catch (error) {
    logAuthMailFailure('account-deletion code email', error)
  }
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

  const language = emailLanguageForRequest(args.request)
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
 * Pure: renders the password-reset code email through the shared code template.
 */
export function buildOtpEmail(language: Language, otp: string): VerificationEmailContent {
  const t = authEmailCopy(language)
  return renderCodeEmail(language, {
    subject: t.otpSubject,
    heading: t.otpHeading,
    body: t.otpBody,
    code: otp,
    expiry: t.otpExpiry,
    ignore: t.otpIgnore,
    signature: t.signature,
  })
}
