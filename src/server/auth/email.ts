import { Resend } from 'resend'
import type { Language } from '@/i18n'
import { he } from '@/i18n/he'
import { en } from '@/i18n/en'
import { getAuthConfig } from './config'

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
}

function authEmailCopy(language: Language): AuthEmailCopy {
  return language === 'english' ? en.translation.auth.emails : he.translation.auth.emails
}

/**
 * Escapes a value for interpolation into HTML. The URL comes from Better Auth
 * and the name from our own store, but escaping keeps the template safe if
 * either ever carries user-controlled text.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Pure: renders the verification email in the requested language. */
export function buildVerificationEmail(
  language: Language,
  url: string,
  name?: string | null,
): VerificationEmailContent {
  const t = authEmailCopy(language)
  const dir = language === 'hebrew' ? 'rtl' : 'ltr'
  const lang = language === 'hebrew' ? 'he' : 'en'

  const greeting = name ? `${t.greetingPrefix} ${name},` : t.greetingGeneric
  const safeUrl = escapeHtml(url)

  const html = [
    `<!doctype html>`,
    `<html lang="${lang}" dir="${dir}">`,
    `<body style="margin:0;padding:24px;background:#f4f4f4;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">`,
    `<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;text-align:start;">`,
    `<h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(t.heading)}</h1>`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(t.body)}</p>`,
    `<p style="margin:0 0 24px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f5c4b;color:#ffffff;border-radius:8px;text-decoration:none;font-size:15px;">${escapeHtml(t.cta)}</a></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(t.ignore)}</p>`,
    `<p style="margin:0;font-size:13px;color:#777777;">${escapeHtml(t.signature)}</p>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join('')

  const text = [t.heading, '', greeting, '', t.body, '', `${t.cta}: ${url}`, '', t.ignore, '', t.signature].join('\n')

  return { subject: t.subject, html, text }
}

export interface VerificationEmailArgs {
  /** Only `name` and `email` are read here; nothing else from the user record. */
  user: { name?: string | null; email: string }
  /** The verification URL Better Auth generated. Carries a token: never logged. */
  url: string
  /** Used for the Accept-Language header only. */
  request?: Request
}

/**
 * Sends the address-verification email through Resend.
 *
 * Failures are logged and swallowed: the sign-up request itself succeeded, and
 * an error here must not disclose whether the address is already registered.
 */
export async function sendVerificationEmail(args: VerificationEmailArgs): Promise<void> {
  const config = getAuthConfig()
  if (!config.RESEND_API_KEY) {
    console.warn('[auth] RESEND_API_KEY is not set; verification email not sent.')
    return
  }

  const language = pickEmailLanguage(args.request?.headers.get('accept-language'))
  const { subject, html, text } = buildVerificationEmail(language, args.url, args.user.name)

  try {
    const result = await new Resend(config.RESEND_API_KEY).emails.send({
      from: config.AUTH_EMAIL_FROM,
      to: args.user.email,
      subject,
      html,
      text,
    })
    if (result.error) {
      console.error(`[auth] verification email rejected: ${result.error.message}`)
    }
  } catch (error) {
    console.error(`[auth] verification email failed: ${error instanceof Error ? error.message : 'unknown error'}`)
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
  const config = getAuthConfig()
  if (!config.RESEND_API_KEY) {
    console.warn('[auth] RESEND_API_KEY is not set; password-reset OTP not sent.')
    return
  }

  const language = pickEmailLanguage(args.request?.headers.get('accept-language'))
  const { subject, html, text } = buildOtpEmail(language, args.otp)

  try {
    const result = await new Resend(config.RESEND_API_KEY).emails.send({
      from: config.AUTH_EMAIL_FROM,
      to: args.email,
      subject,
      html,
      text,
    })
    if (result.error) {
      console.error(`[auth] password-reset OTP email rejected: ${result.error.message}`)
    }
  } catch (error) {
    // Same policy as verification mail: a failure is logged and swallowed so
    // the request cannot disclose account existence or crash the flow.
    console.error(`[auth] password-reset OTP email failed: ${error instanceof Error ? error.message : 'unknown error'}`)
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
    `<p style="margin:0 0 24px;text-align:center;"><span dir="ltr" style="display:inline-block;padding:12px 24px;background:#0f5c4b;color:#ffffff;border-radius:8px;font-size:26px;letter-spacing:8px;font-weight:700;">${safeOtp}</span></p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(t.otpExpiry)}</p>`,
    `<p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#555555;">${escapeHtml(t.otpIgnore)}</p>`,
    `<p style="margin:0;font-size:13px;color:#777777;">${escapeHtml(t.signature)}</p>`,
    `</td></tr></table>`,
    `</body></html>`,
  ].join('')

  const text = [t.otpHeading, '', t.otpBody, '', otp, '', t.otpExpiry, '', t.otpIgnore, '', t.signature].join('\n')

  return { subject: t.otpSubject, html, text }
}
