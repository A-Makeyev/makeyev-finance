/**
 * Shared fixture data for the contact form and the action-form modal.
 * Both flows submit through EmailJS; the specs assert on the exact values
 * echoed back in the success modal, so the payload lives in one place.
 */

/** Values that pass every validation rule of the contact form. */
export const VALID_CONTACT = {
  name: 'Esteban Villalon',
  phone: '050-5050505',
  email: 'esteban@example.com',
} as const

/**
 * Message markers the EmailJS mock reacts to (see support/mocks.ts):
 * FORCE_FAILURE forces an SMTP 500, DEADLOCK_ONCE returns the legacy
 * deadlock body on the first call.
 */
export const EMAILJS_MARKERS = {
  forceFailure: 'FORCE_FAILURE',
  deadlockOnce: 'DEADLOCK_ONCE',
} as const
