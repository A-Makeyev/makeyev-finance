import { parseDateOnly } from './rateValidity'

/**
 * The אישור עקרוני date field's text rules.
 *
 * The site shows dates as dd/mm/yyyy (the Israeli convention) and stores them
 * as date-only 'YYYY-MM-DD'. A native `<input type="date">` cannot be used
 * here: each browser owns its segment editing, it renders the segments in the
 * browser's locale rather than ours, and Chrome rewrites the day and month
 * while the year is still being typed. This module is the one place that
 * turns typed text into a stored date and back, so the calculator and every
 * comparison scenario behave identically.
 *
 * Typed text is forgiving: 03/03/2020, 3.3.2020, 03 03 2020, 03032020 and
 * 030320 all resolve to the same day. A two-digit year follows the usual
 * date-parsing window: 00-68 -> 2000-2068, 69-99 -> 1969-1999. Impossible
 * dates (31/02, 29/02 in a common year) never resolve.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad2 = (value: number): string => String(value).padStart(2, '0')

/** Four-digit display form of a stored date, or '' when there is no real date. */
export function formatDateInput(value: string): string {
  const ms = parseDateOnly(value)
  if (ms === null) return ''
  const date = new Date(ms)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}/${year}`
}

/**
 * Keeps the field readable while it is being typed: digits are grouped as
 * dd/mm/yyyy as they arrive, and the separators are inserted once, so the text
 * never rewrites itself behind the caret. A visitor who types their own
 * separators (or pastes a formatted date) keeps the text they typed; parsing
 * normalizes it on blur. Letters are always dropped.
 */
export function maskDateText(raw: string): string {
  if (raw === '') return ''
  const cleaned = raw.replace(/[^\d/.\-\s]/g, '').slice(0, 12)

  // A separator after two or four digits is one this mask inserted (or a
  // separator typed in the same place), so the text is still purely the digit
  // stream and can be re-masked. A separator anywhere else was typed by the
  // visitor to end a one-digit day/month, or is a pasted ISO date; keep that
  // text intact and parse it on blur instead of regrouping it under the caret.
  let digitsSeen = 0
  let explicit = false
  for (const char of cleaned) {
    if (/\d/.test(char)) {
      digitsSeen += 1
    } else if (char !== '' && digitsSeen !== 2 && digitsSeen !== 4) {
      explicit = true
    }
  }
  if (explicit) return cleaned.slice(0, 10)

  const digits = cleaned.replace(/\D/g, '').slice(0, 8)
  // A complete day or month advances to the next segment: "10" becomes
  // "10/", and "10/10" becomes "10/10/". The trailing slash is mask
  // punctuation, never part of a value, so an unfinished date still parses as
  // incomplete rather than as a date with an empty last segment.
  if (digits.length < 2) return digits
  if (digits.length === 2) return `${digits}/`
  if (digits.length < 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}/`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** True when the text's year segment is exactly two digits (03/03/20). */
export function hasTwoDigitYear(text: string): boolean {
  const parts = text
    .trim()
    .split(/[^\d]+/)
    .filter(Boolean)
  return parts.length === 3 && parts[2].length === 2
}

function isoFromParts(dayText: string, monthText: string, yearText: string): string | null {
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{1,2}$/.test(monthText)) return null
  if (!/^(\d{2}|\d{4})$/.test(yearText)) return null
  const year =
    yearText.length === 2
      ? Number(yearText) + (Number(yearText) <= 68 ? 2000 : 1900)
      : Number(yearText)
  const iso = `${String(year).padStart(4, '0')}-${pad2(Number(monthText))}-${pad2(Number(dayText))}`
  // parseDateOnly rejects rolled-over dates (31/02) and out-of-range parts.
  return parseDateOnly(iso) === null ? null : iso
}

/**
 * The stored date for the field's text, or null while it is incomplete or not
 * a real calendar date. Day and month accept one or two digits; the year must
 * be two or four. Also accepts a full ISO date (2026-03-02), which is what the
 * saved-offer and seeded-comparison paths feed the field.
 */
export function isoFromDateInput(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (ISO_RE.test(trimmed)) return parseDateOnly(trimmed) === null ? null : trimmed

  const parts = trimmed.split(/[^\d]+/).filter(Boolean)
  if (parts.length === 3) {
    // A four-digit leading part is a year-first date, whatever its separator.
    if (parts[0].length === 4) return isoFromParts(parts[2], parts[1], parts[0])
    return isoFromParts(parts[0], parts[1], parts[2])
  }
  if (parts.length !== 1) return null

  const digits = parts[0]
  if (digits.length === 6 || digits.length === 8) {
    return isoFromParts(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8))
  }
  return null
}

/**
 * The text to show when the field loses focus: a complete date becomes the
 * canonical dd/mm/yyyy (a two-digit year is completed), while incomplete or
 * impossible text stays exactly as typed so it can be corrected.
 */
export function normalizeDateInput(text: string): string {
  const iso = isoFromDateInput(text)
  return iso === null ? text.trim() : formatDateInput(iso)
}

export type DateSegmentKey = 'day' | 'month' | 'year'

export interface DateSegments {
  day: string
  month: string
  year: string
}

const DATE_SEGMENTS: readonly DateSegmentKey[] = ['day', 'month', 'year']
const DATE_SEGMENT_MAX: Record<DateSegmentKey, number> = { day: 2, month: 2, year: 4 }

interface DateSlot {
  key: DateSegmentKey
  offset: number
}

const emptyDateSegments = (): DateSegments => ({ day: '', month: '', year: '' })

const clampSegment = (key: DateSegmentKey, value: string): string =>
  value.slice(0, DATE_SEGMENT_MAX[key])

/**
 * Splits what is in the field into independent day, month and year parts.
 * Separators keep their meaning, so a missing middle part (17//2026) stays a
 * missing month instead of shifting the year into it, and year-first forms
 * (2026-02-17) are read in the order they were written.
 */
export function segmentsFromText(text: string): DateSegments {
  const result = emptyDateSegments()
  const cleaned = text.trim()
  if (cleaned === '') return result

  const parts = cleaned.replace(/[^0-9]/g, '/').split('/')
  if (parts.length === 1) {
    const digits = parts[0]
    result.day = clampSegment('day', digits.slice(0, 2))
    result.month = clampSegment('month', digits.slice(2, 4))
    result.year = clampSegment('year', digits.slice(4))
    return result
  }

  if (parts.length >= 3 && parts[0].length === 4) {
    result.year = clampSegment('year', parts[0])
    result.month = clampSegment('month', parts[1] ?? '')
    result.day = clampSegment('day', parts[2] ?? '')
    return result
  }

  result.day = clampSegment('day', parts[0] ?? '')
  result.month = clampSegment('month', parts[1] ?? '')
  result.year = clampSegment('year', parts[2] ?? '')
  return result
}

/**
 * The dd/mm/yyyy text for the three segments. Empty leading or middle parts
 * keep their separator only when a later part exists, so the stored slot is
 * never confused with the next one.
 */
export function renderDateSegments(segments: DateSegments): string {
  if (segments.year !== '') return `${segments.day}/${segments.month}/${segments.year}`
  if (segments.month !== '') return `${segments.day}/${segments.month}`
  return segments.day
}

/** The caret position for a slot-local offset in the rendered text. */
function caretPositionFor(segments: DateSegments, key: DateSegmentKey, offset: number): number {
  const index = DATE_SEGMENTS.indexOf(key)
  let position = offset
  for (let i = 0; i < index; i += 1) {
    position += segments[DATE_SEGMENTS[i]].length + 1
  }
  return position
}

/** Which segment an index in the current text belongs to, and where. */
function locateSegment(text: string, index: number): DateSlot {
  const clamped = Math.max(0, Math.min(index, text.length))
  let slotIndex = 0
  let lastSeparator = -1
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === '/') {
      slotIndex = Math.min(slotIndex + 1, DATE_SEGMENTS.length - 1)
      lastSeparator = i
    }
  }
  const key = DATE_SEGMENTS[slotIndex]
  let offset = 0
  for (let i = lastSeparator + 1; i < clamped; i += 1) {
    if (/[0-9]/.test(text[i])) offset += 1
  }
  return { key, offset: Math.min(offset, DATE_SEGMENT_MAX[key]) }
}

interface TextDiff {
  start: number
  removed: string
  inserted: string
}

/**
 * The smallest changed region between the old and new field text. The suffix
 * is capped so it cannot overlap the prefix when the same digit appears more
 * than once, which is what made an edit in the month look like it happened at
 * the end of the year.
 */
function diffText(previous: string, next: string): TextDiff {
  const limit = Math.min(previous.length, next.length)
  let start = 0
  while (start < limit && previous[start] === next[start]) start += 1

  const maxSuffix = limit - start
  let suffix = 0
  while (
    suffix < maxSuffix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1
  }

  return {
    start,
    removed: previous.slice(start, previous.length - suffix),
    inserted: next.slice(start, next.length - suffix),
  }
}

/**
 * Applies one edit to the date text while keeping the day, month and year in
 * their own slots.
 *
 * A plain digit stream cannot support editing in place: deleting a month digit
 * would pull the year left into the month, and typing there would push the
 * month into the year, which is why editing a full date used to jump to the
 * end. Here a removed or inserted digit stays inside the slot the caret is in,
 * separators only move the caret, and deleting a separator deletes the digit
 * before it. The returned caret is where the field should put it after the
 * edit, so the browser's default caret jump is undone.
 */
export function editDateText(
  previousText: string,
  nextText: string,
  _caret: number | null,
): { text: string; caret: number } {
  if (nextText === '') return { text: '', caret: 0 }

  const diff = diffText(previousText, nextText)
  const insertedDigits = diff.inserted.replace(/\D/g, '')

  // A typed separator defines a segment boundary, and a pasted date or a long
  // run of digits is a whole value rather than one keystroke. Rebuild those
  // from the raw text; everything else is an in-place slot edit below.
  if (/[^0-9]/.test(diff.inserted) || insertedDigits.length >= 6) {
    const segments = segmentsFromText(nextText)
    let text = renderDateSegments(segments)
    const lastKey: DateSegmentKey | null = segments.year
      ? 'year'
      : segments.month
        ? 'month'
        : segments.day
          ? 'day'
          : null
    if (lastKey !== null && lastKey !== 'year' && /[^0-9]\s*$/.test(nextText)) {
      text += '/'
    }
    return { text, caret: text.length }
  }

  const segments = segmentsFromText(previousText)
  const removals: DateSlot[] = []
  for (let i = diff.start; i < diff.start + diff.removed.length; i += 1) {
    if (/[0-9]/.test(previousText[i] ?? '')) {
      removals.push(locateSegment(previousText, i))
    }
  }

  let cursor = locateSegment(previousText, diff.start)
  const separatorOnly = diff.removed.length > 0 && removals.length === 0
  if (separatorOnly) {
    if (cursor.offset > 0) {
      const offset = cursor.offset - 1
      removals.push({ key: cursor.key, offset })
      cursor = { key: cursor.key, offset }
    } else {
      const index = DATE_SEGMENTS.indexOf(cursor.key)
      for (let i = index - 1; i >= 0; i -= 1) {
        const key = DATE_SEGMENTS[i]
        if (segments[key] !== '') {
          const offset = segments[key].length - 1
          removals.push({ key, offset })
          cursor = { key, offset }
          break
        }
      }
    }
  }

  // Remove from the end of each slot first, so earlier offsets stay valid.
  for (const key of DATE_SEGMENTS) {
    const offsets = removals
      .filter((removal) => removal.key === key)
      .map((removal) => removal.offset)
      .sort((a, b) => b - a)
    let value = segments[key]
    for (const offset of offsets) {
      if (offset >= 0 && offset < value.length) {
        value = value.slice(0, offset) + value.slice(offset + 1)
      }
    }
    segments[key] = value
  }

  if (!separatorOnly) {
    for (const removal of removals) {
      if (removal.key === cursor.key && removal.offset < cursor.offset) {
        cursor.offset -= 1
      }
    }
  }
  cursor.offset = Math.max(0, Math.min(cursor.offset, segments[cursor.key].length))

  let grew = false
  let target = cursor
  if (insertedDigits !== '') {
    let value = segments[cursor.key]
    let at = Math.min(cursor.offset, value.length)
    // Pasting a whole segment over a full one replaces it rather than keeping
    // only its last digit.
    if (value.length === DATE_SEGMENT_MAX[cursor.key] && insertedDigits.length > 1) {
      at = 0
    }
    for (const digit of insertedDigits) {
      if (value.length < DATE_SEGMENT_MAX[cursor.key]) {
        at = Math.min(at, value.length)
        value = value.slice(0, at) + digit + value.slice(at)
        at += 1
        grew = true
      } else {
        const replaceAt = Math.min(at, DATE_SEGMENT_MAX[cursor.key] - 1)
        value = value.slice(0, replaceAt) + digit + value.slice(replaceAt + 1)
        at = replaceAt + 1
      }
    }
    segments[cursor.key] = value
    target = { key: cursor.key, offset: at }
  }

  const nextKey = DATE_SEGMENTS[DATE_SEGMENTS.indexOf(target.key) + 1]
  const autoAdvance =
    insertedDigits !== '' &&
    grew &&
    target.key !== 'year' &&
    target.offset === DATE_SEGMENT_MAX[target.key] &&
    (nextKey === undefined || segments[nextKey] === '')

  let text = renderDateSegments(segments)
  let caret = caretPositionFor(segments, target.key, target.offset)
  if (autoAdvance) {
    text += '/'
    caret = text.length
  }
  return { text, caret: Math.max(0, Math.min(caret, text.length)) }
}
