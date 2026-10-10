import { NextResponse } from 'next/server'
import { EMAIL_REGEX } from '@/features/contact/validation'
import { consumeRateLimit } from '@/server/ratelimit'
import { sendMail } from '@/server/mail/client'
import { buildContactEmail } from '@/server/mail/contact'
import { canSendMail, contactRecipient, getMailConfig } from '@/server/mail/config'
import { headerSafe } from '@/server/mail/html'
import { clientIp, isHoneypotFilled, parseContactRequest } from '@/server/contact/request'

/**
 * The contact form's endpoint.
 *
 * Public and unauthenticated, so it is a spam target and it spends the same
 * mailbox quota the password-reset codes use: validate everything, rate limit
 * per IP, and never leak provider text back to the browser. Failures answer a
 * generic code (400 / 429 / 502); the modal owns the user-facing wording.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Deliberately stricter than the auth endpoints: a human sends a handful of
 * messages an hour at most, and every one of them is real mail out of the
 * shared daily cap.
 */
const CONTACT_RATE_LIMIT = { bucket: 'contact', windowSeconds: 3600, max: 5 }

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, 'invalid')
  }

  const parsed = parseContactRequest(body)
  if (!parsed) return fail(400, 'invalid')

  // A tripped honeypot gets the same answer a real submission gets, so a bot
  // learns nothing; nothing is sent.
  if (isHoneypotFilled(parsed)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const allowed = await consumeRateLimit({ ...CONTACT_RATE_LIMIT, key: clientIp(request.headers) })
  if (!allowed) return fail(429, 'rate_limited')

  const config = getMailConfig()
  const recipient = contactRecipient(config)
  if (!canSendMail(config)) {
    console.error('[contact] RESEND_API_KEY is not set; the submission was not sent')
    return fail(502, 'unavailable')
  }

  const { subject, html, text } = buildContactEmail(parsed)
  // reply_to only when the visitor address is syntactically valid; the form
  // otherwise substitutes a localized "not provided" string.
  const visitorEmail = parsed.email.trim()
  const replyTo = EMAIL_REGEX.test(visitorEmail) ? headerSafe(visitorEmail) : undefined

  try {
    await sendMail({ to: recipient, subject, html, text, replyTo })
  } catch {
    // sendMail already logged the failure code; the browser gets nothing.
    return fail(502, 'send_failed')
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
