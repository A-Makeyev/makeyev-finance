/**
 * Browser client for the contact form.
 *
 * The message is composed here and sent to our own `/api/contact` route; the
 * Resend API key lives only on the server, so nothing sensitive reaches the
 * bundle. The returned shape matches the old EmailJS client, so the form
 * barely changed: it only had to stop rendering the provider's raw error text.
 */

export interface ContactEmailParams {
  name: string
  phone: string
  /** Already-localized fallback applied upstream ('לא צויין' / 'Was not included'). */
  email: string
  /** The user's message as plain text. */
  message: string
  /** Preferred callback windows, already joined for display. */
  callback?: string
  /** The calculator-scenario lines. */
  calculator?: string
  /** Saved topic rows, in order (max 15 accepted by the server). */
  topics?: string[]
  /** Honeypot: hidden from users; a bot that fills it gets a silent success. */
  website?: string
}

export interface EmailSendResult {
  ok: boolean
  /** HTTP status; 0 means the request never completed (offline, aborted). */
  status: number
  /** Raw response body. NOT shown to the user - the modal follows `status`. */
  text: string
}

export async function sendContactEmail(params: ContactEmailParams): Promise<EmailSendResult> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
    const text = await response.text().catch(() => '')
    return { ok: response.ok, status: response.status, text }
  } catch {
    // Network failure: the offline branch in the form usually catches this
    // first, but a dropped request can land here too.
    return { ok: false, status: 0, text: '' }
  }
}
