import { z } from 'zod'
import {
  GRACE_MODES,
  MAX_MIXES,
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  PTI_MAX_THRESHOLD,
  PTI_MIN_THRESHOLD,
  TRACK_TYPES,
} from '@/lib/amortization'
import { parseDateOnly } from '@/lib/rateValidity'

/**
 * The persisted shape of a saved comparison, and the validation of anything
 * arriving from the client.
 *
 * A comparison is a workspace snapshot, not a priced offer: the second mix may
 * be blank, and the user may save mid-edit. Tracks therefore accept blank
 * amounts/rates, but every value that IS present must use the calculator's own
 * text format and range. Computed results are never stored; loading a snapshot
 * recalculates from the shared engine.
 *
 * Every field is re-validated here because a disabled or hidden control in the
 * UI is not access control (see AGENTS.md).
 */

/** Four fits the profile's two-column grid beside the saved mixes. */
export const MAX_SAVED_COMPARISONS = 4

export const MAX_COMPARISON_LABEL_LENGTH = 60

export const COMPARISON_SAVE_RATE_LIMIT = { windowSeconds: 60, max: 20 } as const

const AMORTIZATION_METHODS = ['spitzer', 'equalPrincipal'] as const
const PROPERTY_PURPOSES = ['first', 'upgrade', 'investment'] as const

/** Grouped digits with optional comma separators, or blank. */
const AMOUNT_TEXT = /^[0-9,]*$/
/** Whole years, or blank. */
const YEARS_TEXT = /^[0-9]*$/
/** A rate: digits with at most one decimal point, or blank. */
const RATE_TEXT = /^[0-9]*\.?[0-9]*$/
const MAX_RATE_PERCENT = 100
const MAX_TEXT = 20

const amountValue = (text: string): number => Number(text.replace(/,/g, ''))
const isBlank = (text: string): boolean => text.trim() === ''

export const comparisonTrackSchema = z
  .object({
    type: z.enum(TRACK_TYPES),
    /** Blank is allowed: a scenario may still be under construction. */
    amountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
    yearsText: z.string().max(4).regex(YEARS_TEXT),
    yearsOverridden: z.boolean().optional(),
    rateText: z.string().max(8).regex(RATE_TEXT),
    resetMonths: z.number().int().min(0).max(120).optional(),
    graceMonths: z.number().int().min(0).max(MAX_YEARS * 12).optional(),
    graceMode: z.enum(GRACE_MODES).optional(),
    marginText: z
      .string()
      .max(8)
      .regex(RATE_TEXT)
      .refine(
        (value) => isBlank(value) || (Number.isFinite(Number(value)) && Number(value) <= MAX_RATE_PERCENT),
        { message: 'track margin is out of range' },
      )
      .optional(),
    method: z.enum(AMORTIZATION_METHODS),
  })
  .refine(
    (track) =>
      isBlank(track.amountText) ||
      (Number.isFinite(amountValue(track.amountText)) && amountValue(track.amountText) >= 0),
    { message: 'track amount must be blank or a non-negative number', path: ['amountText'] },
  )
  .refine(
    (track) => {
      if (isBlank(track.yearsText)) return true
      const years = Number(track.yearsText)
      return Number.isInteger(years) && years >= 1 && years <= MAX_YEARS
    },
    { message: `track years must be blank or 1-${MAX_YEARS}`, path: ['yearsText'] },
  )
  .refine(
    (track) => {
      if (isBlank(track.rateText)) return true
      const rate = Number(track.rateText)
      return Number.isFinite(rate) && rate >= 0 && rate <= MAX_RATE_PERCENT
    },
    { message: 'track rate is out of range', path: ['rateText'] },
  )
  .refine(
    (track) =>
      track.resetMonths === undefined ||
      [0, 12, 18, 24, 30, 36, 48, 60, 84, 120].includes(track.resetMonths),
    { message: 'track reset cadence is unsupported', path: ['resetMonths'] },
  )
  .refine(
    (track) => {
      const months = isBlank(track.yearsText)
        ? MAX_YEARS * 12
        : Number(track.yearsText) * 12
      return (track.graceMonths ?? 0) <= months
    },
    { message: 'track grace months cannot exceed the term', path: ['graceMonths'] },
  )

const comparisonExpenseSchema = z.object({
  monthlyText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  oneTimeText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
})

const comparisonScenarioSchema = z.object({
  /** Blank is allowed: unnamed mixes are addressed as "Mix N". */
  label: z.string().trim().max(MAX_COMPARISON_LABEL_LENGTH),
  termYears: z.number().int().min(1).max(MAX_YEARS),
  // The four preset-basket ids, kept literal here so Zod sees a tuple.
  activePreset: z.enum(['basket1', 'basket2', 'basket3', 'basket4']).nullable(),
  /** אישור עקרוני date for this mix; blank means not entered. */
  approvalDateText: z
    .string()
    .max(10)
    .refine((value) => value === '' || parseDateOnly(value) !== null, {
      message: 'approval date must be blank or a real YYYY-MM-DD date',
    })
    .optional(),
  tracks: z.array(comparisonTrackSchema).min(1).max(MAX_TRACKS),
})

const comparisonSharedSchema = z.object({
  propertyValueText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  capitalText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  incomeText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  purpose: z.enum(PROPERTY_PURPOSES),
  mortgageSumText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  realtorPercentText: z.string().max(8).regex(RATE_TEXT),
  lawyerPercentText: z.string().max(8).regex(RATE_TEXT),
  appraiserFeeText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  renovationAmountText: z.string().max(MAX_TEXT).regex(AMOUNT_TEXT),
  otherExpenses: z.array(comparisonExpenseSchema).max(MAX_OTHER_EXPENSES),
  ptiThresholdPercent: z
    .number()
    .min(PTI_MIN_THRESHOLD * 100)
    .max(PTI_MAX_THRESHOLD * 100),
})

export const comparisonSnapshotSchema = z.object({
  version: z.literal(1),
  shared: comparisonSharedSchema,
  /** The page starts with two mixes and never drops below two. */
  scenarios: z.array(comparisonScenarioSchema).min(2).max(MAX_MIXES),
})

export const savedComparisonInputSchema = z.object({
  label: z.string().trim().min(1).max(MAX_COMPARISON_LABEL_LENGTH),
  snapshot: comparisonSnapshotSchema,
})

export type SavedComparisonInput = z.infer<typeof savedComparisonInputSchema>
export type ComparisonSnapshotInput = z.infer<typeof comparisonSnapshotSchema>
