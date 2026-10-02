import { z } from 'zod'
import {
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  PTI_MAX_THRESHOLD,
  PTI_MIN_THRESHOLD,
  TRACK_TYPES,
} from '@/lib/amortization'

/**
 * The persisted shape of a saved mortgage mix, and the validation of anything
 * arriving from the client.
 *
 * Every input from the client is untrusted (see AGENTS.md security rules): the
 * calculator already prevents bad values in the UI, but the route handler
 * re-validates with these schemas and never trusts a client-supplied user id
 * or computed figure.
 *
 * Tracks keep the calculator's TEXT fields rather than numbers, because that
 * is the shape the store loads back (TrackState), and re-formatting on the
 * server would not round-trip. The text is therefore validated strictly:
 * exactly the characters the calculator's inputs produce, plus range checks.
 */

/** Four fits the profile's two-column grid as a tidy 2x2, with no pagination. */
export const MAX_SAVED_MIXES = 4

export const MAX_MIX_LABEL_LENGTH = 60

/** Saves are a deliberate action, but the endpoint still gets its own budget. */
export const MIX_SAVE_RATE_LIMIT = { windowSeconds: 60, max: 20 } as const

const AMORTIZATION_METHODS = ['spitzer', 'equalPrincipal'] as const
const PROPERTY_PURPOSES = ['first', 'upgrade', 'investment'] as const

/** Grouped digits with optional comma separators, or blank (formatGroupedNumber output). */
const AMOUNT_TEXT = /^[0-9,]*$/
/** Whole years, or blank. */
const YEARS_TEXT = /^[0-9]*$/
/** A rate: digits with at most one decimal point, or blank. */
const RATE_TEXT = /^[0-9]*\.?[0-9]*$/
/** A generous ceiling so a garbage rate cannot be stored as 1e9. */
const MAX_RATE_PERCENT = 100

function amountValue(text: string): number {
  return Number(text.replace(/,/g, ''))
}

export const savedTrackSchema = z
  .object({
    type: z.enum(TRACK_TYPES),
    amountText: z.string().max(20).regex(AMOUNT_TEXT),
    yearsText: z.string().max(4).regex(YEARS_TEXT),
    rateText: z.string().max(8).regex(RATE_TEXT),
    method: z.enum(AMORTIZATION_METHODS),
  })
  .refine((track) => Number.isFinite(amountValue(track.amountText)) && amountValue(track.amountText) > 0, {
    message: 'a saved track must have a positive amount',
    path: ['amountText'],
  })
  .refine(
    (track) => {
      const years = Number(track.yearsText)
      return Number.isInteger(years) && years >= 1 && years <= MAX_YEARS
    },
    { message: `track years must be 1-${MAX_YEARS}`, path: ['yearsText'] },
  )
  .refine(
    (track) => {
      const rate = Number(track.rateText)
      return Number.isFinite(rate) && rate >= 0 && rate <= MAX_RATE_PERCENT
    },
    { message: 'track rate is out of range', path: ['rateText'] },
  )

const MAX_TEXT = 20

/** A repeatable expense line: label + recurring amount + one-time amount. */
const savedExpenseSchema = z.object({
  label: z.string().max(60),
  amountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  oneTimeAmountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
})

/**
 * The scenario half of a saved mix. Optional so a mix saved before the scenario
 * existed still validates (it simply has no scenario to restore). Every field
 * mirrors a calculator input and is validated with the same strict text rules
 * as the tracks - the client's own formatting is the only accepted shape, but
 * the server never trusts that the client sent it.
 */
export const savedMixScenarioSchema = z.object({
  startingAmountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  propertyValueText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  capitalText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  incomeText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  purpose: z.enum(PROPERTY_PURPOSES),
  realtorPercentText: z.string().max(8).regex(RATE_TEXT),
  lawyerPercentText: z.string().max(8).regex(RATE_TEXT),
  appraiserFeeText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  renovationAmountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  otherExpenses: z.array(savedExpenseSchema).max(MAX_OTHER_EXPENSES),
  ptiThresholdPercent: z
    .number()
    .min(PTI_MIN_THRESHOLD * 100)
    .max(PTI_MAX_THRESHOLD * 100),
})

export const savedMixInputSchema = z.object({
  label: z.string().trim().min(1).max(MAX_MIX_LABEL_LENGTH),
  termYears: z.number().int().min(1).max(MAX_YEARS),
  tracks: z.array(savedTrackSchema).min(1).max(MAX_TRACKS),
  scenario: savedMixScenarioSchema.optional(),
})

export type SavedMixInput = z.infer<typeof savedMixInputSchema>
export type SavedTrack = SavedMixInput['tracks'][number]
export type SavedMixScenario = z.infer<typeof savedMixScenarioSchema>
