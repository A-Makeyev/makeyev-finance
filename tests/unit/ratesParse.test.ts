import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  dateCellToIso,
  excelSerialToIsoDate,
  parseAverageRateWorkbook,
  RateParseError,
  rateCellToNumber,
} from '@/server/rates/parse'
import { AVERAGE_RATE_BUCKETS } from '@/lib/averageRates'

/**
 * Parser tests against both the real BOI workbooks (pinned snapshots in
 * tests/fixtures/rates) and generated BIFF8 workbooks for edge cases the real
 * files do not currently contain. The real fixtures are the shape contract:
 * if the BOI changes a column, these fail before the page can show a wrong
 * rate.
 */

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'rates')

function fixture(name: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)))
}

function workbookFromRows(rows: unknown[][], sheetName: string): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  const written = XLSX.write(workbook, { bookType: 'biff8', type: 'array' }) as ArrayBuffer
  return new Uint8Array(written)
}

/** The header block the real workbooks carry, then the given data rows. */
function indexedSheet(dataRows: unknown[][]): Uint8Array {
  return workbookFromRows(
    [
      ['Average Rate of Interest on CPI-Indexed Mortgages'],
      ['ממוצע', 'מעל 25 ', 'מעל 20 ועד 25', 'מעל 15 ועד 20', 'מעל 10 ועד 15', 'מעל 5 ועד 10', 'עד 5 שנים', 'תוקף הריבית החל מ-', 'תקופה לפרעון'],
      ['Average', 'More than 25 years', 'From 20 to 25', 'From 15 to 20', 'From 10 to 15', 'From 5 to 10', 'Up to and', 'Interest rate', 'Period to due date'],
      [null, null, 'years', 'years', 'years', 'years', 'including', 'effective ', null],
      [null, null, null, null, ' ', ' ', '5 years', 'from', 'month of return'],
      ...dataRows,
    ],
    'RESULT',
  )
}

function nonIndexedSheet(dataRows: unknown[][]): Uint8Array {
  return workbookFromRows(
    [
      ['Average Rate of Interest on Unindexed Mortgages'],
      ['ממוצע', 'מעל 25', 'מעל 20 ועד 25', 'מעל 15 ועד 20', 'מעל 10 ועד 15', 'מעל 5 ועד 10', 'מעל 1 ועד 5', 'עד שנה', 'תוקף הריבית החל מ-', 'תקופה לפרעון'],
      ['Average', 'More than 25 years', 'From 20 to 25', 'From 15 to 20', 'From 10 to 15', 'From 5 to 10', 'From 1 to 5', 'Up to and', 'Interest rate', 'Period to due date'],
      [null, null, 'years', 'years', 'years', 'years', 'years', 'including', 'effective ', null],
      [null, null, null, null, null, null, null, '1 year', 'from', 'month of return'],
      ...dataRows,
    ],
    'הלוואות שניתנו מ-01.03.2013',
  )
}

describe('excel serial dates', () => {
  it('converts modern serials, including the leap-day shift', () => {
    expect(excelSerialToIsoDate(1)).toBe('1900-01-01')
    expect(excelSerialToIsoDate(59)).toBe('1900-02-28')
    expect(excelSerialToIsoDate(61)).toBe('1900-03-01')
    expect(excelSerialToIsoDate(46314)).toBe('2026-10-19')
    expect(excelSerialToIsoDate(46295)).toBe('2026-09-30')
  })

  it('rejects the fake 1900-02-29 and out-of-range serials', () => {
    expect(excelSerialToIsoDate(60)).toBeNull()
    expect(excelSerialToIsoDate(0)).toBeNull()
    expect(excelSerialToIsoDate(-4)).toBeNull()
    expect(excelSerialToIsoDate(Number.NaN)).toBeNull()
    expect(excelSerialToIsoDate(999_999)).toBeNull()
  })
})

describe('date cells', () => {
  it('accepts Excel serials, ISO dates and dd/mm/yyyy text', () => {
    expect(dateCellToIso(46314)).toBe('2026-10-19')
    expect(dateCellToIso('31/07/2026')).toBe('2026-07-31')
    expect(dateCellToIso(' 31/07/2026 ')).toBe('2026-07-31')
    expect(dateCellToIso('2026-07-31T00:00:00.000Z')).toBe('2026-07-31')
    expect(dateCellToIso('46314')).toBe('2026-10-19')
  })

  it('rejects impossible and non-date text', () => {
    expect(dateCellToIso('31/02/2026')).toBeNull()
    expect(dateCellToIso('not a date')).toBeNull()
    expect(dateCellToIso('')).toBeNull()
    expect(dateCellToIso(null)).toBeNull()
  })
})

describe('rate cells', () => {
  it('parses numbers, percent text, thousands separators and decimal commas', () => {
    expect(rateCellToNumber(3.49)).toBe(3.49)
    expect(rateCellToNumber('3.49%')).toBe(3.49)
    expect(rateCellToNumber('3,490.98')).toBe(3490.98)
    expect(rateCellToNumber('3,49')).toBe(3.49)
    expect(rateCellToNumber('')).toBeNull()
    expect(rateCellToNumber('-')).toBeNull()
    expect(rateCellToNumber('n/a')).toBeNull()
  })
})

describe('the real indexed workbook', () => {
  const rows = parseAverageRateWorkbook(fixture('pribmash-2026-10-19.xls'), 'indexed')

  it('parses the current publication with the official buckets', () => {
    expect(rows.length).toBeGreaterThan(150)
    const current = rows[0]
    expect(current.validFrom).toBe('2026-10-19')
    expect(current.periodToDueDate).toBe('2026-09-30')
    expect(current.average).toBeCloseTo(3.4909803402847603, 10)
    expect(current.buckets.over25).toBeCloseTo(3.5272098921512156, 10)
    expect(current.buckets['20to25']).toBeCloseTo(3.3652171643738584, 10)
    expect(current.buckets.upTo5).toBeCloseTo(3.500969668560098, 10)
    expect(Object.keys(current.buckets).sort()).toEqual(
      AVERAGE_RATE_BUCKETS.indexed.map((bucket) => bucket.id).sort(),
    )
  })

  it('returns rows newest first with a valid date on every row', () => {
    const dates = rows.map((row) => row.validFrom)
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)))
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true)
  })
})

describe('the real non-indexed workbook', () => {
  const rows = parseAverageRateWorkbook(fixture('mashfix-2026-10-19.xls'), 'nonIndexed')

  it('parses the current publication including 1-5 and up to 1 year', () => {
    expect(rows.length).toBeGreaterThan(150)
    const current = rows[0]
    expect(current.validFrom).toBe('2026-10-19')
    expect(current.periodToDueDate).toBe('2026-09-30')
    expect(current.average).toBeCloseTo(4.545864869178216, 10)
    expect(current.buckets.over25).toBeCloseTo(4.888583787925625, 10)
    expect(current.buckets['1to5']).toBeCloseTo(4.5068897971123265, 10)
    expect(current.buckets.upTo1).toBeCloseTo(4.350496351192624, 10)
    expect(Object.keys(current.buckets).sort()).toEqual(
      AVERAGE_RATE_BUCKETS.nonIndexed.map((bucket) => bucket.id).sort(),
    )
  })
})

describe('workbook edge cases', () => {
  it('keeps a blank bucket missing and parses text dates', () => {
    const bytes = indexedSheet([
      [3.1, 3.2, null, 3.4, 3.5, 3.6, 3.7, '31/07/2026', '30/06/2026'],
    ])
    const rows = parseAverageRateWorkbook(bytes, 'indexed')
    expect(rows).toHaveLength(1)
    expect(rows[0].validFrom).toBe('2026-07-31')
    expect(rows[0].periodToDueDate).toBe('2026-06-30')
    expect(rows[0].buckets['20to25']).toBeUndefined()
    expect(rows[0].buckets.upTo5).toBe(3.7)
  })

  it('sorts descending and keeps the first row for a duplicated publication', () => {
    const bytes = indexedSheet([
      [3.3, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 46314, 46295],
      [3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 46280, 46265],
      [3.2, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 46314, 46295],
    ])
    const rows = parseAverageRateWorkbook(bytes, 'indexed')
    expect(rows.map((row) => row.validFrom)).toEqual(['2026-10-19', '2026-09-15'])
    expect(rows[0].average).toBe(3.3)
  })

  it('drops impossible bucket values but keeps a published zero', () => {
    const bytes = nonIndexedSheet([
      [4.5, 4.8, 4.7, 4.6, 4.5, 4.4, 0, 101, 46314, 46295],
    ])
    const rows = parseAverageRateWorkbook(bytes, 'nonIndexed')
    expect(rows[0].buckets['1to5']).toBe(0)
    expect(rows[0].buckets.upTo1).toBeUndefined()
  })

  it('rejects a table whose column count does not match the kind', () => {
    const bytes = indexedSheet([
      // Only average + five buckets before the date: seven rate columns, not
      // the eight a non-indexed table needs.
      [4.5, 4.8, 4.7, 4.6, 4.5, 4.4, 46314, 46295],
    ])
    expect(() => parseAverageRateWorkbook(bytes, 'nonIndexed')).toThrow(RateParseError)
    try {
      parseAverageRateWorkbook(bytes, 'nonIndexed')
    } catch (error) {
      expect((error as RateParseError).code).toBe('unexpected-shape')
    }
  })

  it('reports a workbook with no data rows as no-rows', () => {
    const bytes = workbookFromRows([['Average Rate'], ['Average', 'More than 25 years']], 'RESULT')
    try {
      parseAverageRateWorkbook(bytes, 'indexed')
      throw new Error('expected a parse error')
    } catch (error) {
      expect((error as RateParseError).code).toBe('no-rows')
    }
  })

  it('reports a non-workbook byte array as malformed', () => {
    try {
      parseAverageRateWorkbook(new Uint8Array([1, 2, 3, 4]), 'indexed')
      throw new Error('expected a parse error')
    } catch (error) {
      expect((error as RateParseError).code).toBe('malformed-workbook')
    }
  })
})
