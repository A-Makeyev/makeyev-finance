import { Resend } from 'resend'
import type { CreateEmailOptions, CreateEmailResponse } from 'resend'
import { canSendMail, getMailConfig, type MailConfig } from './config'

/**
 * The one place that talks to Resend.
 *
 * Uses the official SDK (`resend`), the same client the auth mail already
 * used: it owns the HTTP contract and gives typed errors, so nothing here
 * hand-rolls the request. The transport is injectable (see
 * `createResendTransport`) so tests never touch a real server.
 */

export interface MailMessage {
  /** One address or several; Resend takes a string or an array of strings. */
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Set only when the visitor's address is syntactically valid. */
  replyTo?: string
}

/**
 * A failure the caller can classify without parsing provider text. `code` is a
 * short, secret-free token: Resend's own stable error name (e.g.
 * `invalid_api_key`, `validation_error`, `daily_quota_exceeded`), or
 * `ENOCONFIG` / `ECONNECTION` for our own cases.
 */
export class MailSendError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'MailSendError'
    this.code = code
  }
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>
}

export interface ResendTransportOptions {
  /** Fixed config for tests; defaults to the live env on every call. */
  config?: MailConfig
  /** Injected for tests; defaults to the official SDK client. */
  sendEmail?: (payload: CreateEmailOptions) => Promise<CreateEmailResponse>
}

/**
 * The one failure worth naming in the log: a sender Resend will not accept.
 * It covers the whole "mail silently stopped working" class - an unverified
 * domain, or a consumer domain (gmail.com) that can never be verified - and
 * the provider's own text is deliberately not repeated here, since it can echo
 * the address back. Nothing secret is disclosed: the addresses are ours.
 */
function senderHint(code: string): string {
  if (code !== 'validation_error' && code !== 'invalid_from_address') return ''
  return (
    ' The from address must be on a domain verified in Resend' +
    ' (https://resend.com/domains); the test sender onboarding@resend.dev needs no' +
    ' verification but only delivers to the Resend account owner. Consumer domains' +
    ' (gmail.com, outlook.com, ...) can never be verified.'
  )
}

export function createResendTransport(options: ResendTransportOptions = {}): MailTransport {
  const config = () => options.config ?? getMailConfig()
  const sendEmail =
    options.sendEmail ??
    ((payload: CreateEmailOptions) => new Resend(config().RESEND_API_KEY).emails.send(payload))

  return {
    async send(message: MailMessage): Promise<void> {
      const cfg = config()
      if (!canSendMail(cfg)) {
        throw new MailSendError('ENOCONFIG', 'Mail is not configured (RESEND_API_KEY is missing)')
      }

      // AUTH_EMAIL_FROM is passed through verbatim: Resend accepts
      // `Name <email>` directly, so whatever the deployment configured (or the
      // test-sender default) is what the recipient sees.
      const payload: CreateEmailOptions = {
        from: cfg.AUTH_EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      }

      let response: CreateEmailResponse
      try {
        response = await sendEmail(payload)
      } catch {
        throw new MailSendError('ECONNECTION', 'Resend could not be reached')
      }

      if (response.error) {
        const code = response.error.name || `E${response.error.statusCode ?? 'UNKNOWN'}`
        const status = response.error.statusCode ?? '?'
        throw new MailSendError(code, `Resend rejected the message (HTTP ${status}).${senderHint(code)}`)
      }
    },
  }
}

let defaultTransport: MailTransport | null = null

function getDefaultTransport(): MailTransport {
  return (defaultTransport ??= createResendTransport())
}

/**
 * Sends one message through the default transport. Failures are logged with a
 * short code (and nothing else ~ no recipient, body, code or credential) and
 * re-thrown, so the caller can decide whether to surface them.
 */
export async function sendMail(
  message: MailMessage,
  transport: MailTransport = getDefaultTransport(),
): Promise<void> {
  try {
    await transport.send(message)
  } catch (error) {
    const code = error instanceof MailSendError ? error.code : 'EUNKNOWN'
    const detail = error instanceof Error ? error.message : 'unknown error'
    console.error(`[mail] send failed (${code}): ${detail}`)
    throw error
  }
}

/** Test hook: drop the memoized transport so the next send rebuilds it. */
export function resetDefaultTransport(): void {
  defaultTransport = null
}
