import { z } from 'zod'
import { SITE } from '@/config/siteConfig'

/**
 * Server-only mail configuration (Resend).
 *
 * Only this module reads mail-related environment variables; everything else
 * takes values from here. All of these are SECRETS: they are never prefixed
 * NEXT_PUBLIC_, never imported by client code, and never logged.
 *
 * Everything is OPTIONAL and validated at first use instead of at module load,
 * for the same reason as the auth config: `next build` imports route modules
 * while collecting metadata, where no secrets exist (CI builds with none), so
 * throwing at import time would break the build.
 */

/** Display name used when AUTH_EMAIL_FROM carries a bare address. */
export const DEFAULT_SENDER_NAME = 'Makeyev Finance'

/**
 * The sender used when AUTH_EMAIL_FROM is unset: Resend's own test sender.
 *
 * It needs no verified domain, so local dev and CI can send with just an API
 * key, but it only delivers to the Resend account owner's address. The other
 * half of the rule matters just as much: Resend refuses to send from a domain
 * that is not verified on the account, and a consumer domain (gmail.com,
 * outlook.com, ...) can never be verified at all - every send from one is
 * rejected with `validation_error` (HTTP 403). Set AUTH_EMAIL_FROM to a
 * verified domain for anything real. Documented in .env.example and
 * SECURITY.md, and reported by `npm run mail:doctor`.
 */
export const DEFAULT_AUTH_EMAIL_FROM = `${DEFAULT_SENDER_NAME} <onboarding@resend.dev>`

/**
 * Where contact submissions go when CONTACT_TO_EMAIL is unset: the address the
 * site already publishes (`SITE.emailMain`).
 *
 * Falling back to the SENDER instead would leave a local setup sending contact
 * mail to `onboarding@resend.dev`, which the test sender cannot deliver to at
 * all - a broken default that looks like a broken form.
 */
export const DEFAULT_CONTACT_TO_EMAIL = SITE.emailMain

const mailConfigSchema = z.object({
  /**
   * Resend API key (https://resend.com). Missing = mail is disabled and the
   * email-verification requirement is relaxed, so the app still runs locally
   * and in CI without any real secret.
   */
  RESEND_API_KEY: z.string().min(1).optional(),
  /**
   * From address for every outgoing mail. Either `Name <email>` or a bare
   * `email`; a missing display name falls back to DEFAULT_SENDER_NAME.
   *
   * Defaults to Resend's test sender, which needs no verified domain and is
   * what makes mail work with nothing but an API key. It can only deliver to
   * the Resend account owner's address, so a real deployment must set this to
   * an address on a domain verified in Resend (see DEFAULT_AUTH_EMAIL_FROM).
   */
  AUTH_EMAIL_FROM: z.string().min(1).default(DEFAULT_AUTH_EMAIL_FROM),
  /**
   * Where contact-form submissions are delivered. Defaults to the site's own
   * public inbox (DEFAULT_CONTACT_TO_EMAIL), which is where the product means
   * for them to go; set it only to send them somewhere else.
   */
  CONTACT_TO_EMAIL: z.string().min(1).optional(),
})

export type MailConfig = z.infer<typeof mailConfigSchema>

export interface MailAddress {
  name: string
  email: string
}

function blankToUndefined(v: string | undefined) {
  return v?.trim() ? v : undefined
}

function readRawEnv(): Record<string, string | undefined> {
  return {
    RESEND_API_KEY: blankToUndefined(process.env.RESEND_API_KEY),
    AUTH_EMAIL_FROM: blankToUndefined(process.env.AUTH_EMAIL_FROM),
    CONTACT_TO_EMAIL: blankToUndefined(process.env.CONTACT_TO_EMAIL),
  }
}

/**
 * Pure: validates a raw env map into config. Exported so tests can assert the
 * shape without depending on whatever the machine's real .env contains.
 */
export function parseMailConfig(raw: Record<string, string | undefined>): MailConfig {
  const parsed = mailConfigSchema.safeParse(raw)
  if (parsed.success) return parsed.data

  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid mail configuration:\n${issues}`)
}

/** Reads and validates the current process env. Never cached, so tests can vary it. */
export function getMailConfig(): MailConfig {
  return parseMailConfig(readRawEnv())
}

/**
 * Parses `Name <email>` or a bare `email`. Pure. Bare addresses (what .env
 * usually carries) get the default display name.
 */
export function parseFromAddress(from: string): MailAddress {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/)
  if (match) {
    const name = match[1].replace(/^"|"$/g, '').trim()
    return { name: name || DEFAULT_SENDER_NAME, email: match[2] }
  }
  return { name: DEFAULT_SENDER_NAME, email: from.trim() }
}

/** The configured sender. Always resolves: AUTH_EMAIL_FROM is defaulted. */
export function senderAddress(config: MailConfig = getMailConfig()): MailAddress {
  return parseFromAddress(config.AUTH_EMAIL_FROM)
}

/** Where contact submissions go: CONTACT_TO_EMAIL, else the site's own inbox. */
export function contactRecipient(config: MailConfig = getMailConfig()): string {
  return config.CONTACT_TO_EMAIL ?? DEFAULT_CONTACT_TO_EMAIL
}

/**
 * True when a message can actually be sent. Only the API key can be missing:
 * the sender always resolves to AUTH_EMAIL_FROM or the test-sender default, so
 * a half-configured mailer keeps working instead of dead-ending new accounts
 * (`requireEmailVerification` keys off this).
 */
export function canSendMail(config: MailConfig = getMailConfig()): boolean {
  return Boolean(config.RESEND_API_KEY)
}
