import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/lib/relativeTime'

/**
 * A localized relative timestamp, so the phrasing comes from the runtime's
 * CLDR data rather than a hand-written string per unit. These pin the bucket
 * selection and that the locale is actually honored.
 */

const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const at = (msAgo: number) => NOW - msAgo

const SECONDS = 1000
const MINUTE = 60 * SECONDS
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('formats English buckets', () => {
    expect(formatRelativeTime(at(2 * HOUR), NOW, 'en')).toBe('2 hours ago')
    expect(formatRelativeTime(at(3 * DAY), NOW, 'en')).toBe('3 days ago')
  })

  it('formats Hebrew, not English, for the he locale', () => {
    const hebrew = formatRelativeTime(at(3 * HOUR), NOW, 'he')
    expect(hebrew).not.toBe('3 hours ago')
    // 'לפני' is the Hebrew "ago"; the unit word follows the CLDR plural rules
    // (Hebrew has a dual form, so 2 hours is 'שעתיים' while 3 hours is 'שעות').
    expect(hebrew).toContain('לפני')
    expect(hebrew).toContain('שעות')
  })

  it('fills the largest unit that fits', () => {
    expect(formatRelativeTime(at(90 * SECONDS), NOW, 'en')).toBe('1 minute ago')
    expect(formatRelativeTime(at(60 * MINUTE * 24 * 3), NOW, 'en')).toBe('3 days ago')
  })

  it('falls back to seconds under a minute', () => {
    expect(formatRelativeTime(at(30 * SECONDS), NOW, 'en')).toBe('30 seconds ago')
  })

  it('handles a future timestamp', () => {
    expect(formatRelativeTime(NOW + 2 * HOUR, NOW, 'en')).toBe('in 2 hours')
  })

  it('treats now as the current second', () => {
    expect(formatRelativeTime(NOW, NOW, 'en')).toBe('now')
  })
})
