import emailjs from '@emailjs/browser'
import { env } from '@/config/env'

// Legacy pages initialized the SDK inline with the public key
// (index/contact.html inline script) - replicated here from validated env.
emailjs.init({ publicKey: env.VITE_EMAILJS_PUBLIC_KEY })

export interface ContactEmailParams {
  name: string
  phone: string
  /** Already-localized fallback applied upstream ('לא צויין' / 'Was not included'). */
  email: string
  /**
   * The user's message as plain text - the only content of the Message cell
   * (its <pre> keeps the line breaks). The callback windows, the calculator
   * scenario and the saved topics are separate params. No HTML - safe
   * under any escaping.
   */
  message: string
  /**
   * Optional extra template params: `callback` (preferred callback windows,
   * comma-separated), `calculator` (the calculator-scenario lines) and one
   * numbered entry per saved topic (`topic_1` .. `topic_15` - one
   * per results card). The template renders each in its own table row,
   * wrapped in a {{#...}} conditional so empty slots stay hidden.
   */
  questions?: Record<string, string>
}

const DEADLOCK_MARKER = 'deadlock victim'
/** Legacy retried indefinitely on SMTP deadlocks; capped here as hardening. */
const MAX_DEADLOCK_RETRIES = 3

/**
 * The SDK resolves {status, text} for 2xx responses and THROWS the same shape
 * for failures (sendPost.js). `text` carries the RAW response body - this is
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
    ...params.questions,
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
 * retry count capped - see migration checklist).
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

/** True when the EmailJS SDK failed to load (ad-blockers etc.) - legacy parity. */
export function isEmailjsAvailable(): boolean {
  return typeof emailjs !== 'undefined'
}

// ---------------------------------------------------------------------------
// EmailJS template - paste into the dashboard (Email Templates -> your
// template). The template is ALWAYS English; only the dynamic values follow
// the site language. The dynamic variables are exactly the params sendOnce()
// passes: {{subject}}, {{name}}, {{phone}}, {{email}}, {{message}}, plus
// {{callback}} (preferred callback windows), {{calculator}} (the
// calculator-scenario lines) and one numbered {{topic_1}} ..
// {{topic_15}} per saved topic (the calculator has 15 result cards).
// Do NOT use other placeholders (e.g. {{queston 1}}, {{value of question 1}})
// - EmailJS only replaces params the code actually sends.
//
// Row order: Message, then the callback windows, then the calculator
// scenario, then the (always-English) "Discussion Topics" header and one row
// per saved topic. Each optional row is wrapped in a
// {{#...}} conditional so it stays hidden when its param is absent.
//
// Subject field:  {{subject}}
// Email (HTML) field:
// <div>
//   <table style="border: 1px solid #555555; border-collapse: collapse; width: 100%;">
//     <tbody style="font-family: 'Fira Code', sans-serif; font-size: 15px; text-align: center; color: #18293C">
//       <tr style="border: 1px solid #2A85BE; background: #2A85BE; color: #F4FAFD; padding: 15px 10px;">
//         <td colspan="2" style="padding: 10px;"><strong>Details</strong></td>
//       </tr>
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Name</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{name}}</pre></td>
//       </tr>
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Phone</strong></td>
//         <td style="padding: 10px;"><a href="tel:{{phone}}" style="margin: 0; white-space: pre-wrap; text-decoration: none;">{{phone}}</a></td>
//       </tr>
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Email</strong></td>
//         <td style="padding: 10px;"><a href="mailto:{{email}}" style="margin: 0; white-space: pre-wrap; text-decoration: none;">{{email}}</a></td>
//       </tr>
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Message</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{message}}</pre></td>
//       </tr>
//       {{#callback}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Preferred Time</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{callback}}</pre></td>
//       </tr>
//       {{/callback}}
//       {{#calculator}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Calculator Details</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{calculator}}</pre></td>
//       </tr>
//       {{/calculator}}
//       {{#topic_1}}
//       <tr style="border: 1px solid #2A85BE; background: #2A85BE; color: #F4FAFD; padding: 15px 10px;">
//         <td colspan="2" style="padding: 10px;"><strong>Discussion Topics</strong></td>
//       </tr>
//       {{/topic_1}}
//       {{#topic_1}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 1</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_1}}</pre></td>
//       </tr>
//       {{/topic_1}}
//       {{#topic_2}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 2</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_2}}</pre></td>
//       </tr>
//       {{/topic_2}}
//       {{#topic_3}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 3</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_3}}</pre></td>
//       </tr>
//       {{/topic_3}}
//       {{#topic_4}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 4</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_4}}</pre></td>
//       </tr>
//       {{/topic_4}}
//       {{#topic_5}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 5</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_5}}</pre></td>
//       </tr>
//       {{/topic_5}}
//       {{#topic_6}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 6</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_6}}</pre></td>
//       </tr>
//       {{/topic_6}}
//       {{#topic_7}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 7</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_7}}</pre></td>
//       </tr>
//       {{/topic_7}}
//       {{#topic_8}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 8</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_8}}</pre></td>
//       </tr>
//       {{/topic_8}}
//       {{#topic_9}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 9</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_9}}</pre></td>
//       </tr>
//       {{/topic_9}}
//       {{#topic_10}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 10</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_10}}</pre></td>
//       </tr>
//       {{/topic_10}}
//       {{#topic_11}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 11</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_11}}</pre></td>
//       </tr>
//       {{/topic_11}}
//       {{#topic_12}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 12</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_12}}</pre></td>
//       </tr>
//       {{/topic_12}}
//       {{#topic_13}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 13</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_13}}</pre></td>
//       </tr>
//       {{/topic_13}}
//       {{#topic_14}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 14</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_14}}</pre></td>
//       </tr>
//       {{/topic_14}}
//       {{#topic_15}}
//       <tr style="border: 1px solid #555555;">
//         <td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>Topic 15</strong></td>
//         <td style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">{{topic_15}}</pre></td>
//       </tr>
//       {{/topic_15}}
//     </tbody>
//   </table>
// </div>
