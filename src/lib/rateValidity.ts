import type { TFunction } from 'i18next'

/**
 * Rate-validity window for a mortgage pre-approval (אישור עקרוני).
 *
 * The Bank of Israel's mortgage-transparency reform standardised the אישור
 * עקרוני and fixed how long it must hold: at least 24 calendar days from
 * issue. While it is in force the bank is committed to the terms it quoted
 * (subject to the data declared and to prime-rate moves). The document itself
 * can run longer (~3 months); the RATE is what the 24-day window covers.
 *
 * This module is pure and `now`-injected, so the boundary is unit-testable
 * without a fake clock.
 *
 * Source: Bank of Israel - competition in mortgages / mortgage transparency
 * (boi.org.il/information/bank-paymnts/financial-education/competition-in-mortgages/),
 * with the 24-day figure restated by the Kol-Zchut rights guide and the
 * mortgage-advisor press. A regulatory figure: do not change it without a
 * fresh source.
 */

export const RATE_VALIDITY_DAYS = 24

/**
 * How close to expiry the chip switches from "valid" to an "expiring"
 * warning. A UI urgency threshold, NOT a regulatory figure.
 */
export const EXPIRING_SOON_DAYS = 3

export const RATE_VALIDITY_SOURCE_URL =
  'https://www.boi.org.il/information/bank-paymnts/financial-education/competition-in-mortgages/'

export type RateValidityStatus = 'valid' | 'expiring' | 'expired'

export interface RateValidity {
  status: RateValidityStatus
  /** Whole calendar days until the rate stops holding; 0 = the last valid day. */
  daysRemaining: number
  /** The last day the quoted rate still holds, as a date-only 'YYYY-MM-DD'. */
  validUntil: string
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/**
 * A date-only 'YYYY-MM-DD' string to a UTC-midnight epoch, or null when it is
 * blank or not a real calendar date (2026-02-30 is rejected, not rolled over).
 */
export function parseDateOnly(value: string): number | null {
  const match = DATE_ONLY_RE.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ms = Date.UTC(year, month - 1, day)
  const date = new Date(ms)
  // Date.UTC rolls impossible dates over (2026-02-30 -> March 2); reject them.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return ms
}

/** A UTC-midnight epoch back to a date-only 'YYYY-MM-DD' string. */
export function toDateOnly(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * The local calendar day of a Date, as a UTC-midnight epoch. Normalising both
 * sides of the comparison to UTC midnight makes the day count exact, so a DST
 * change or the machine's timezone can never shift it by a day.
 */
function localDayStart(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * The validity of a rate quoted on `approvalDate`, evaluated at `now`. Returns
 * null when the date is blank or not a real calendar date, so callers can drop
 * the chip in unconditionally.
 */
export function rateValidityStatus(approvalDate: string, now: Date): RateValidity | null {
  const approved = parseDateOnly(approvalDate)
  if (approved === null) return null
  const expiry = approved + RATE_VALIDITY_DAYS * MS_PER_DAY
  const daysRemaining = Math.round((expiry - localDayStart(now)) / MS_PER_DAY)
  const status: RateValidityStatus =
    daysRemaining < 0 ? 'expired' : daysRemaining <= EXPIRING_SOON_DAYS ? 'expiring' : 'valid'
  return { status, daysRemaining, validUntil: toDateOnly(expiry) }
}

/**
 * A date-only value rendered in the active locale, always on the same calendar
 * day: it is formatted in UTC so the viewer's timezone cannot shift it. Falls
 * back to the raw value when it is not a real date.
 */
export function formatDateOnly(value: string, locale: string): string {
  const ms = parseDateOnly(value)
  if (ms === null) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(ms),
  )
}

/**
 * The localized one-line sentence for a validity result, with the last valid
 * day filled in. Shared by the chip and by the compare page's status list, so
 * the wording lives in exactly one place.
 */
export function rateValidityText(validity: RateValidity, t: TFunction, locale: string): string {
  return t(`calculator.rateValidity.${validity.status}`, {
    date: formatDateOnly(validity.validUntil, locale),
  })
}
