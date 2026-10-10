/**
 * Shared fixture data for the contact form and the action-form modal.
 * Both flows post to `/api/contact`; the specs assert on the exact values
 * echoed back in the success modal, so the payload lives in one place.
 */

/** Values that pass every validation rule of the contact form. */
export const VALID_CONTACT = {
  name: 'Esteban Villalon',
  phone: '050-5050505',
  email: 'esteban@example.com',
} as const

/**
 * Message markers the `/api/contact` mock reacts to (see support/mocks.ts):
 * FORCE_FAILURE forces a generic 502, RATE_LIMIT forces a 429.
 */
export const CONTACT_MARKERS = {
  forceFailure: 'FORCE_FAILURE',
  rateLimited: 'RATE_LIMIT',
} as const
