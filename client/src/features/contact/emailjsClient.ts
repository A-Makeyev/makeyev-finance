import emailjs from '@emailjs/browser'
import { env } from '@/config/env'

// Legacy pages initialized the SDK inline with the public key
// (index/contact.html inline script) — replicated here from validated env.
emailjs.init({ publicKey: env.VITE_EMAILJS_PUBLIC_KEY })

export interface ContactEmailParams {
  name: string
  phone: string
  /** Already-localized fallback applied upstream ('לא צויין' / 'Was not included'). */
  email: string
  /** Already-localized fallback applied upstream. */
  message: string
}

const DEADLOCK_MARKER = 'deadlock victim'
/** Legacy retried indefinitely on SMTP deadlocks; capped here as hardening. */
const MAX_DEADLOCK_RETRIES = 3

/**
 * The SDK resolves {status, text} for 2xx responses and THROWS the same shape
 * for failures (sendPost.js). `text` carries the RAW response body — this is
 * exactly what the legacy code matched 'deadlock victim' against.
 */
interface SdkResponse {
  status: number
  text: string
}

function extractText(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'text' in payload) {
    return String((payload as { text?: unknown }).text)
  }
  return String(payload)
}

function sendOnce(params: ContactEmailParams): Promise<SdkResponse> {
  // Non-2xx responses are THROWN by the SDK as EmailJSResponseStatus objects.
  return emailjs.send(env.VITE_EMAILJS_SERVICE_ID, env.VITE_EMAILJS_TEMPLATE_ID, {
    subject: 'New Client 🤑',
    name: params.name,
    phone: params.phone,
    email: params.email,
    message: params.message,
  })
}

export interface EmailSendResult {
  ok: boolean
  status: number
  /** Raw response body / error text, shown in the failure modal (legacy parity). */
  text: string
}

/**
 * Sends the contact email through EmailJS, transparently retrying the known
 * transient "deadlock victim" SMTP failure (legacy contact.js:383-444;
 * retry count capped — see migration checklist).
 */
export async function sendContactEmail(params: ContactEmailParams): Promise<EmailSendResult> {
  let attempt = 0
  for (;;) {
    attempt++
    let response: SdkResponse | undefined
    let thrownError: unknown
    try {
      response = await sendOnce(params)
    } catch (error) {
      thrownError = error
    }

    const bodyText = response ? response.text : extractText(thrownError)

    if (bodyText.includes(DEADLOCK_MARKER) && attempt <= MAX_DEADLOCK_RETRIES) {
      console.warn(`[emailjs] process deadlocked (attempt ${attempt}), resending…`)
      continue
    }

    if (thrownError !== undefined) {
      return { ok: false, status: 0, text: bodyText }
    }

    return { ok: response!.status === 200, status: response!.status, text: response!.text }
  }
}

/** True when the EmailJS SDK failed to load (ad-blockers etc.) — legacy parity. */
export function isEmailjsAvailable(): boolean {
  return typeof emailjs !== 'undefined'
}
