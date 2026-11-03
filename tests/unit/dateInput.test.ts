import { describe, expect, it } from 'vitest'
import {
  editDateText,
  formatDateInput,
  hasTwoDigitYear,
  isoFromDateInput,
  maskDateText,
  normalizeDateInput,
  segmentsFromText,
} from '@/lib/dateInput'

/** Simulates Backspace in the middle of the field's current text. */
function backspace(text: string, caret: number = text.length): { text: string; caret: number } {
  const raw = text.slice(0, caret - 1) + text.slice(caret)
  return editDateText(text, raw, caret - 1)
}

/** Simulates typing `input` at a caret position. */
function typeAt(
  text: string,
  caret: number,
  input: string,
): { text: string; caret: number } {
  const raw = text.slice(0, caret) + input + text.slice(caret)
  return editDateText(text, raw, caret + input.length)
}

describe('formatDateInput', () => {
  it('renders a stored date as dd/mm/yyyy', () => {
    expect(formatDateInput('2026-03-02')).toBe('02/03/2026')
    expect(formatDateInput('2020-11-03')).toBe('03/11/2020')
  })

  it('renders nothing for an empty or impossible date', () => {
    expect(formatDateInput('')).toBe('')
    expect(formatDateInput('2020-02-30')).toBe('')
    expect(formatDateInput('not-a-date')).toBe('')
  })
})

describe('maskDateText', () => {
  it('groups typed digits as dd/mm/yyyy', () => {
    expect(maskDateText('0')).toBe('0')
    expect(maskDateText('03')).toBe('03/')
    expect(maskDateText('030')).toBe('03/0')
    expect(maskDateText('0303')).toBe('03/03/')
    expect(maskDateText('030320')).toBe('03/03/20')
    expect(maskDateText('03032020')).toBe('03/03/2020')
    expect(maskDateText('030320201234')).toBe('03/03/2020')
  })

  it('advances as soon as the day or month is complete', () => {
    expect(maskDateText('10')).toBe('10/')
    expect(maskDateText('10/10')).toBe('10/10/')
    expect(maskDateText('10/10/2')).toBe('10/10/2')
    expect(maskDateText('10/10/20')).toBe('10/10/20')
  })

  it('keeps separators that end a short segment, and drops letters', () => {
    expect(maskDateText('3.3.2020')).toBe('3.3.2020')
    expect(maskDateText('3/3/2020')).toBe('3/3/2020')
    expect(maskDateText('2020-03-03')).toBe('2020-03-03')
    expect(maskDateText('ab12cd')).toBe('12/')
    expect(maskDateText('')).toBe('')
  })

  it('rewrites separators in the mask positions instead of stacking them', () => {
    expect(maskDateText('10 10 2020')).toBe('10/10/2020')
    expect(maskDateText('03/03/20')).toBe('03/03/20')
  })
})

describe('isoFromDateInput', () => {
  it('accepts dd/mm/yyyy with one- or two-digit parts', () => {
    expect(isoFromDateInput('03/03/2020')).toBe('2020-03-03')
    expect(isoFromDateInput('3/3/2020')).toBe('2020-03-03')
    expect(isoFromDateInput('03.03.2020')).toBe('2020-03-03')
    expect(isoFromDateInput('03 03 2020')).toBe('2020-03-03')
    expect(isoFromDateInput('3-3-2020')).toBe('2020-03-03')
  })

  it('accepts a full ISO date, including year-first dotted forms', () => {
    expect(isoFromDateInput('2026-03-02')).toBe('2026-03-02')
    expect(isoFromDateInput('2026/3/2')).toBe('2026-03-02')
    expect(isoFromDateInput(' 2026-03-02 ')).toBe('2026-03-02')
  })

  it('accepts digits only, in dd/mm/yyyy or dd/mm/yy', () => {
    expect(isoFromDateInput('03032020')).toBe('2020-03-03')
    expect(isoFromDateInput('030320')).toBe('2020-03-03')
    expect(isoFromDateInput('291120')).toBe('2020-11-29')
  })

  it('completes a two-digit year with the standard window', () => {
    expect(isoFromDateInput('03/03/20')).toBe('2020-03-03')
    expect(isoFromDateInput('31/12/68')).toBe('2068-12-31')
    expect(isoFromDateInput('01/01/69')).toBe('1969-01-01')
    expect(isoFromDateInput('01/01/99')).toBe('1999-01-01')
  })

  it('accepts a leap day only in a leap year', () => {
    expect(isoFromDateInput('29/02/2020')).toBe('2020-02-29')
    expect(isoFromDateInput('29/02/2019')).toBeNull()
  })

  it('rejects impossible or out-of-range dates instead of rolling them over', () => {
    expect(isoFromDateInput('31/04/2020')).toBeNull()
    expect(isoFromDateInput('31/02/2020')).toBeNull()
    expect(isoFromDateInput('00/03/2020')).toBeNull()
    expect(isoFromDateInput('03/00/2020')).toBeNull()
    expect(isoFromDateInput('03/13/2020')).toBeNull()
    expect(isoFromDateInput('03/03/0000')).toBeNull()
    expect(isoFromDateInput('2020-02-30')).toBeNull()
  })

  it('waits for a complete date', () => {
    expect(isoFromDateInput('')).toBeNull()
    expect(isoFromDateInput('03')).toBeNull()
    expect(isoFromDateInput('03/03')).toBeNull()
    expect(isoFromDateInput('03/03/202')).toBeNull()
    expect(isoFromDateInput('not a date')).toBeNull()
  })
})

describe('hasTwoDigitYear', () => {
  it('recognizes a short year with any separator', () => {
    expect(hasTwoDigitYear('03/03/20')).toBe(true)
    expect(hasTwoDigitYear('03 03 20')).toBe(true)
    expect(hasTwoDigitYear('03/03/2020')).toBe(false)
    expect(hasTwoDigitYear('03/03/2')).toBe(false)
  })
})

describe('normalizeDateInput', () => {
  it('canonicalizes a complete date and completes a short year', () => {
    expect(normalizeDateInput('3/3/20')).toBe('03/03/2020')
    expect(normalizeDateInput('03 03 20')).toBe('03/03/2020')
    expect(normalizeDateInput('03032020')).toBe('03/03/2020')
  })

  it('leaves incomplete or impossible text as typed', () => {
    expect(normalizeDateInput(' 03/03 ')).toBe('03/03')
    expect(normalizeDateInput('31/02/2020')).toBe('31/02/2020')
  })
})

describe('segmentsFromText', () => {
  it('keeps a missing middle segment instead of shifting the year into it', () => {
    expect(segmentsFromText('17//2026')).toEqual({ day: '17', month: '', year: '2026' })
    expect(segmentsFromText('/12/2026')).toEqual({ day: '', month: '12', year: '2026' })
  })

  it('never keeps a day above 31 or a month above 12', () => {
    // Rebuilt (typed, pasted or regrouped) text is fitted to the calendar
    // range, so 40/13 can never be shown as a day and month.
    expect(segmentsFromText('40/13/2020')).toEqual({ day: '4', month: '1', year: '2020' })
    expect(segmentsFromText('99-99-2020')).toEqual({ day: '9', month: '9', year: '2020' })
  })

  it('reads year-first and compact forms', () => {
    expect(segmentsFromText('2026-02-17')).toEqual({ day: '17', month: '02', year: '2026' })
    expect(segmentsFromText('030320')).toEqual({ day: '03', month: '03', year: '20' })
    expect(segmentsFromText('03032020')).toEqual({ day: '03', month: '03', year: '2020' })
  })
})

describe('editDateText', () => {
  it('advances to the next segment while typing', () => {
    expect(editDateText('', '1', 1)).toEqual({ text: '1', caret: 1 })
    expect(editDateText('1', '10', 2)).toEqual({ text: '10/', caret: 3 })
    expect(editDateText('10/', '10/1', 4)).toEqual({ text: '10/1', caret: 4 })
    expect(editDateText('10/1', '10/10', 5)).toEqual({ text: '10/10/', caret: 6 })
    expect(editDateText('10/10/', '10/10/2020', 11)).toEqual({
      text: '10/10/2020',
      caret: 10,
    })
  })

  it('deletes backwards through the year and then the month', () => {
    let state = { text: '17/12/2026', caret: 10 }
    const seen: string[] = []
    for (let i = 0; i < 8; i += 1) {
      state = backspace(state.text, state.text.length)
      seen.push(state.text)
    }
    expect(seen).toEqual([
      '17/12/202',
      '17/12/20',
      '17/12/2',
      '17/12',
      '17/1',
      '17',
      '1',
      '',
    ])
  })

  it('edits the month in place and leaves the year alone', () => {
    // Caret between the month's two digits: typing 1 makes 11, not 112.
    expect(typeAt('17/12/2026', 4, '1')).toEqual({ text: '17/11/2026', caret: 5 })
    // Delete the month's last digit, then type a new one: the year stays.
    const cleared = backspace('17/12/2026', 5)
    expect(cleared).toEqual({ text: '17/1/2026', caret: 4 })
    expect(typeAt(cleared.text, cleared.caret, '1')).toEqual({
      text: '17/11/2026',
      caret: 5,
    })
    // Replacing the selected month as one edit.
    expect(editDateText('17/12/2026', '17/11/2026', 5)).toEqual({
      text: '17/11/2026',
      caret: 5,
    })
  })

  it('keeps the year when a month digit is deleted in the middle', () => {
    expect(backspace('17/12/2026', 4).text).toBe('17/2/2026')
  })

  it('treats a deleted separator as deleting the digit before it', () => {
    expect(backspace('17/12/2026', 3).text).toBe('1/12/2026')
    expect(backspace('10/').text).toBe('1')
  })

  it('accepts typed separators and pasted dates', () => {
    expect(editDateText('3', '3/', 2)).toEqual({ text: '3/', caret: 2 })
    expect(editDateText('3/', '3/3/', 4)).toEqual({ text: '3/3/', caret: 4 })
    expect(editDateText('', '2026-02-17', 10)).toEqual({
      text: '17/02/2026',
      caret: 10,
    })
    expect(editDateText('', '17022026', 8)).toEqual({
      text: '17/02/2026',
      caret: 10,
    })
  })

  it('moves a digit that cannot fit the part into the next part', () => {
    // A one-digit day or month that would go above its limit hands the digit
    // to the next part instead of stalling, so the year can still be typed.
    expect(editDateText('3', '32', 2)).toEqual({ text: '3/2', caret: 3 })
    expect(editDateText('30/3', '30/32', 5)).toEqual({ text: '30/3/2', caret: 6 })
    // No part ever holds an out-of-range day or month.
    expect(segmentsFromText('3/2')).toEqual({ day: '3', month: '2', year: '' })
    // Overwriting an existing full month is still refused, so the year stays.
    expect(typeAt('17/12/2026', 5, '3')).toEqual({ text: '17/12/2026', caret: 5 })
    // The limits themselves still go in: day 31 and month 12.
    expect(editDateText('3', '31', 2)).toEqual({ text: '31/', caret: 3 })
    expect(typeAt('10/1/2020', 4, '2')).toEqual({ text: '10/12/2020', caret: 5 })
  })

  it('shows the slash as soon as a part cannot grow', () => {
    // 4-9 cannot be the first of a two-digit day or month.
    expect(editDateText('', '4', 1)).toEqual({ text: '4/', caret: 2 })
    expect(editDateText('4/', '4/5', 3)).toEqual({ text: '4/5/', caret: 4 })
    // 1-3 still wait for a possible second digit (10-31, 10-12).
    expect(editDateText('', '1', 1)).toEqual({ text: '1', caret: 1 })
    expect(editDateText('', '3', 1)).toEqual({ text: '3', caret: 1 })
    // A gap in the middle of an existing date is not closed by a slash at the
    // end: a later part already holds a value.
    expect(editDateText('1//2020', '12//2020', 2)).toEqual({ text: '12//2020', caret: 2 })
    expect(editDateText('17/12/2026', '4/12/2026', 1)).toEqual({ text: '4/12/2026', caret: 1 })
  })

  it('drops out-of-range digits from a pasted date instead of showing them', () => {
    expect(editDateText('', '20/20/2000', 10)).toEqual({ text: '20/2/2000', caret: 9 })
  })

  it('keeps a short date short until it is complete', () => {
    const typed = editDateText('', '03', 2)
    expect(typed).toEqual({ text: '03/', caret: 3 })
    expect(isoFromDateInput(typed.text)).toBeNull()
  })
})
