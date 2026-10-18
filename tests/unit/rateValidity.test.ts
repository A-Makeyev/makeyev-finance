import { describe, expect, it } from 'vitest'
import {
  EXPIRING_SOON_DAYS,
  formatDateOnly,
  parseDateOnly,
  RATE_VALIDITY_DAYS,
  rateValidityStatus,
  toDateOnly,
} from '@/lib/rateValidity'

/**
 * Rate-validity window (אישור עקרוני). Hand-checked boundaries on a fixed
 * approval date: the window is 24 days, so 1 Jan 2026 holds through 25 Jan
 * 2026 and lapses on the 26th. `now` is built from local calendar components
 * so the expected counts hold in any machine timezone.
 */

/** Local noon on a calendar day - the local Y/M/D is fixed for every timezone. */
const at = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12, 0, 0)

describe('parseDateOnly', () => {
  it('parses a date-only string to a UTC-midnight epoch', () => {
    expect(parseDateOnly('2026-01-25')).toBe(Date.UTC(2026, 0, 25))
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseDateOnly('  2026-01-25 ')).toBe(Date.UTC(2026, 0, 25))
  })

  it('rejects blanks and malformed strings', () => {
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('   ')).toBeNull()
    expect(parseDateOnly('25/01/2026')).toBeNull()
    expect(parseDateOnly('2026-1-5')).toBeNull()
    expect(parseDateOnly('2026-01-25T00:00:00Z')).toBeNull()
  })

  it('rejects impossible calendar dates instead of rolling them over', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull()
    expect(parseDateOnly('2025-02-29')).toBeNull()
    expect(parseDateOnly('2026-13-01')).toBeNull()
    expect(parseDateOnly('2026-00-10')).toBeNull()
  })

  it('accepts a real leap day', () => {
    expect(parseDateOnly('2024-02-29')).toBe(Date.UTC(2024, 1, 29))
  })
})

describe('toDateOnly', () => {
  it('round-trips a parsed date', () => {
    expect(toDateOnly(parseDateOnly('2026-01-25')!)).toBe('2026-01-25')
  })
})

describe('rateValidityStatus', () => {
  it('uses a 24-day window', () => {
    expect(RATE_VALIDITY_DAYS).toBe(24)
    expect(rateValidityStatus('2026-01-01', at(2026, 1, 1))!.validUntil).toBe('2026-01-25')
  })

  it('returns null without a real date, so callers can render nothing', () => {
    expect(rateValidityStatus('', at(2026, 1, 1))).toBeNull()
    expect(rateValidityStatus('not-a-date', at(2026, 1, 1))).toBeNull()
  })

  it('is valid well before expiry and counts the days left', () => {
    const result = rateValidityStatus('2026-01-01', at(2026, 1, 20))!
    expect(result.status).toBe('valid')
    expect(result.daysRemaining).toBe(5) // 25 Jan minus 20 Jan
  })

  it('switches to expiring inside the urgency window, and only there', () => {
    // Exactly EXPIRING_SOON_DAYS left is already a warning.
    expect(rateValidityStatus('2026-01-01', at(2026, 1, 22))!.daysRemaining).toBe(
      EXPIRING_SOON_DAYS,
    )
    expect(rateValidityStatus('2026-01-01', at(2026, 1, 22))!.status).toBe('expiring')
    // One day earlier it is still plain valid.
    expect(rateValidityStatus('2026-01-01', at(2026, 1, 21))!.daysRemaining).toBe(
      EXPIRING_SOON_DAYS + 1,
    )
    expect(rateValidityStatus('2026-01-01', at(2026, 1, 21))!.status).toBe('valid')
  })

  it('still counts the last day as valid (not expired)', () => {
    const lastDay = rateValidityStatus('2026-01-01', at(2026, 1, 25))!
    expect(lastDay.daysRemaining).toBe(0)
    expect(lastDay.status).toBe('expiring')
  })

  it('is expired the day after the window closes', () => {
    const expired = rateValidityStatus('2026-01-01', at(2026, 1, 26))!
    expect(expired.daysRemaining).toBe(-1)
    expect(expired.status).toBe('expired')
    expect(expired.validUntil).toBe('2026-01-25')
  })

  it('treats a future approval date as valid', () => {
    const future = rateValidityStatus('2026-06-01', at(2026, 1, 1))!
    expect(future.status).toBe('valid')
    expect(future.daysRemaining).toBe(24 + 151) // 1 Jun minus 1 Jan
  })

  it('keeps the day count exact across a DST transition', () => {
    // 20 Mar -> 13 Apr is 24 days; several zones change their clocks inside it.
    const result = rateValidityStatus('2026-03-20', at(2026, 3, 28))!
    expect(result.daysRemaining).toBe(16)
    expect(result.validUntil).toBe('2026-04-13')
    // Autumn transition too (clocks go back inside this window).
    const autumn = rateValidityStatus('2026-10-01', at(2026, 10, 10))!
    expect(autumn.daysRemaining).toBe(15)
    expect(autumn.validUntil).toBe('2026-10-25')
  })

  it('crosses month and year boundaries', () => {
    expect(rateValidityStatus('2025-12-20', at(2026, 1, 5))!.validUntil).toBe('2026-01-13')
    expect(rateValidityStatus('2025-12-20', at(2026, 1, 13))!.daysRemaining).toBe(0)
  })
})

describe('formatDateOnly', () => {
  it('falls back to the raw value when it is not a real date', () => {
    expect(formatDateOnly('', 'en')).toBe('')
    expect(formatDateOnly('not-a-date', 'en')).toBe('not-a-date')
  })

  it('renders the calendar day in UTC, so no timezone shifts it back a day', () => {
    // Without timeZone: 'UTC' a machine west of UTC would render 31 Dec 2025.
    const rendered = formatDateOnly('2026-01-01', 'en')
    expect(rendered).toContain('2026')
    expect(rendered).not.toContain('2025')
  })

  it('renders in the requested locale', () => {
    expect(formatDateOnly('2026-07-04', 'he')).not.toBe(formatDateOnly('2026-07-04', 'en'))
  })
})
