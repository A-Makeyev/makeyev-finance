import { escapeHtml } from './html'

/**
 * The contact-form notification mail.
 *
 * This is a server-side port of the EmailJS template that used to live in a
 * comment at the bottom of `emailjsClient.ts` and in the EmailJS dashboard.
 * The layout is reproduced row for row, with one addition the dashboard could
 * not do locally: `dir="auto"` on the value cells, so a Hebrew message renders
 * right-to-left while the (always English) labels stay put.
 *
 * Pure: no config, no network, no i18n. The labels are English by design; only
 * the values follow the visitor's language.
 */

export interface ContactEmailParams {
  name: string
  phone: string
  /** Either the visitor's address, or the localized "not provided" string. */
  email: string
  message: string
  /** Preferred callback windows, already joined for display. */
  callback?: string
  /** The calculator scenario lines. */
  calculator?: string
  /** Saved discussion topics, one row each, in order. */
  topics?: string[]
}

export interface ContactEmailContent {
  subject: string
  html: string
  text: string
}

/** Fixed subject, matching the old EmailJS template. */
export const CONTACT_SUBJECT = 'New Client 🤑'

const LABEL_CELL = (label: string) =>
  `<td style="width: 20%; border-right: 1px solid #555555; padding: 10px;"><strong>${label}</strong></td>`

const PRE_VALUE = (value: string) =>
  `<td dir="auto" style="padding: 10px;"><pre style="margin: 0; white-space: pre-wrap;">${value}</pre></td>`

function row(label: string, valueCell: string): string {
  return `<tr style="border: 1px solid #555555;">${LABEL_CELL(label)}${valueCell}</tr>`
}

function headerRow(label: string): string {
  return (
    `<tr style="border: 1px solid #2A85BE; background: #2A85BE; color: #F4FAFD;">` +
    `<td style="width: 20%; padding: 10px;"><strong>${label}</strong></td><td></td></tr>`
  )
}

/**
 * A `tel:` href must never carry anything but dialable characters, or it can
 * smuggle a second scheme. Keeps digits, `+` and spaces only.
 */
export function safeTelHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+\s]/g, '').trim()
  return digits === '' ? null : `tel:${digits}`
}

/** A conservative "looks like an address" test, for choosing mailto vs plain text. */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function buildContactEmail(params: ContactEmailParams): ContactEmailContent {
  const name = escapeHtml(params.name)
  const phone = escapeHtml(params.phone)
  const email = escapeHtml(params.email)
  const message = escapeHtml(params.message)
  const callback = params.callback?.trim() ? escapeHtml(params.callback) : null
  const calculator = params.calculator?.trim() ? escapeHtml(params.calculator) : null
  const rawTopics = (params.topics ?? []).filter((topic) => topic.trim() !== '')
  const topics = rawTopics.map(escapeHtml)

  const tel = safeTelHref(params.phone)
  const phoneCell = tel
    ? `<td dir="auto" style="padding: 10px;"><a href="${escapeHtml(tel)}" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${phone}</a></td>`
    : PRE_VALUE(phone)

  const emailCell = isEmailLike(params.email)
    ? `<td dir="auto" style="padding: 10px;"><a href="${escapeHtml(`mailto:${params.email.trim()}`)}" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${email}</a></td>`
    : PRE_VALUE(email)

  const rows: string[] = [
    headerRow('Details'),
    row('Name', PRE_VALUE(name)),
    row('Phone', phoneCell),
    row('Email', emailCell),
    row('Message', PRE_VALUE(message)),
  ]

  if (callback) rows.push(row('Preferred Time', PRE_VALUE(callback)))
  if (calculator) rows.push(row('Calculator Details', PRE_VALUE(calculator)))

  if (topics.length > 0) {
    rows.push(headerRow('Discussion Topics'))
    topics.forEach((topic, index) => rows.push(row(`Topic ${index + 1}`, PRE_VALUE(topic))))
  }

  const html = [
    '<div>',
    '<table style="border: 1px solid #555555; border-collapse: collapse; width: 100%;">',
    `<tbody style="font-family: 'Fira Code', sans-serif; font-size: 15px; text-align: center; color: #18293C">`,
    ...rows,
    '</tbody>',
    '</table>',
    '</div>',
  ].join('')

  const textLines = [
    'Details',
    `Name: ${params.name}`,
    `Phone: ${params.phone}`,
    `Email: ${params.email}`,
    'Message:',
    params.message,
  ]
  if (callback) textLines.push(`Preferred Time: ${params.callback}`)
  if (calculator) textLines.push('Calculator Details:', params.calculator ?? '')
  if (rawTopics.length > 0) {
    textLines.push('Discussion Topics')
    rawTopics.forEach((topic, index) => textLines.push(`Topic ${index + 1}: ${topic}`))
  }

  return { subject: CONTACT_SUBJECT, html, text: textLines.join('\n') }
}
