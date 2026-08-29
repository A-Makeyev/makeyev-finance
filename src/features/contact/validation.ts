import { z } from 'zod'

/**
 * Validation regexes transcribed VERBATIM from legacy src/index.js:24-26.
 * Do not "modernize" them — they define the accepted input contract.
 */
export const PHONE_REGEX = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/
export const NAME_REGEX = /^[^0-9.,_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/

export const MAX_MESSAGE_LENGTH = 999

/** Main contact form (name / phone / email / message). */
export const contactFormSchema = z.object({
  name: z.string().min(1).regex(NAME_REGEX),
  phone: z.string().min(1).regex(PHONE_REGEX),
  email: z.string().min(1).regex(EMAIL_REGEX),
  message: z.string().max(MAX_MESSAGE_LENGTH),
})

/**
 * Action-form modal variant — identical minus the email field
 * (legacy contact.js validateForm email-null branch).
 */
export const actionFormSchema = contactFormSchema.omit({ email: true })

export type ContactFormValues = z.infer<typeof contactFormSchema>
export type ActionFormValues = z.infer<typeof actionFormSchema>
