import { z } from 'zod'

/**
 * Validation for the public, unauthenticated contact POST.
 *
 * The client form already validates, but a disabled button is not access
 * control: this is the real boundary. Every field is length-capped so a hostile
 * body cannot balloon into a mail, and unknown keys are rejected outright.
 */

/** The calculator has 15 result cards, so it can save at most 15 topics. */
export const MAX_CONTACT_TOPICS = 15
export const MAX_CONTACT_MESSAGE = 999

/**
 * Optional free text. Empty is allowed (the form models "none" as an empty
 * string), and is treated as absent downstream.
 */
const optionalText = (max: number) => z.string().trim().max(max).optional()

export const contactRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(40),
    email: z.string().trim().max(254).default(''),
    message: z.string().trim().max(MAX_CONTACT_MESSAGE).default(''),
    callback: optionalText(300),
    calculator: optionalText(2000),
    topics: z.array(z.string().trim().min(1).max(500)).max(MAX_CONTACT_TOPICS).default([]),
    /**
     * Honeypot. Real users never see or fill it; a bot that autofills every
     * input trips it, and the route then answers success without sending.
     */
    website: z.string().max(200).optional(),
  })
  .strict()

export type ContactRequest = z.infer<typeof contactRequestSchema>

/** Pure: the parsed body, or null when it does not match the schema. */
export function parseContactRequest(body: unknown): ContactRequest | null {
  const parsed = contactRequestSchema.safeParse(body)
  return parsed.success ? parsed.data : null
}

export function isHoneypotFilled(request: ContactRequest): boolean {
  return Boolean(request.website && request.website.trim() !== '')
}

/**
 * The client address, as Render's proxy forwards it. Only used as a rate-limit
 * key, never trusted for anything else, and never logged.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first ? first : 'unknown'
}
