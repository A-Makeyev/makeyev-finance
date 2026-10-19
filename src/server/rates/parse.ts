import * as XLSX from 'xlsx'
import {
  AVERAGE_RATE_BUCKETS,
  type AverageRateBucketId,
  type AverageRateKind,
  type AverageRateRow,
} from '@/lib/averageRates'
import { parseDateOnly } from '@/lib/rateValidity'

/**
 * Parser for the Bank of Israel's two average-mortgage-rate workbooks.
 *
 * The workbooks are legacy BIFF8 `.xls` files with a fixed shape:
 *   - a header block of 4-6 rows (Hebrew + English labels),
 *   - one data row per publication, newest first,
 *   - columns: average, then the period buckets (25+, 20-25, ..., up to 5
 *     years, with the non-indexed table also carrying 1-5 and up to 1),
 *     then "valid from" and "period to due date".
 *
 * The parser finds the data rows by shape rather than by a hardcoded row
 * number, then validates the column count against the expected bucket list.
 * That is deliberate: a changed workbook must fail loudly (the table is
 * marked unavailable) instead of silently reading the wrong column as a rate.
 */

export type RateParseErrorCode = 'malformed-workbook' | 'unexpected-shape' | 'no-rows'

export class RateParseError extends Error {
  readonly code: RateParseErrorCode

  constructor(code: RateParseErrorCode, message: string) {
    super(message)
    this.name = 'RateParseError'
    this.code = code
  }
}

/** Excel's 1900 date system plus its deliberate fake 1900-02-29 (serial 60). */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null
  const whole = Math.floor(serial)
  if (whole < 1 || whole > 80_000) return null
  if (whole === 60) return null
  // Serials from 61 onward are shifted by the fake leap day.
  const days = whole >= 61 ? whole - 1 : whole
  const ms = Date.UTC(1899, 11, 31) + days * 86_400_000
  const iso = new Date(ms).toISOString().slice(0, 10)
  return parseDateOnly(iso) === null ? null : iso
}

/** A workbook date cell (Excel serial or a dd/mm/yyyy string) as ISO. */
export function dateCellToIso(value: unknown): string | null {
  if (typeof value === 'number') return excelSerialToIsoDate(value)
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value !== 'string') return null

  const text = value.trim()
  if (!text) return null

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (isoMatch) {
    const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    return parseDateOnly(iso) === null ? null : iso
  }

  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(text)
  if (dmy) {
    const iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    return parseDateOnly(iso) === null ? null : iso
  }

  // Some cells come through as a serial stored in a text cell.
  if (/^\d+(?:\.\d+)?$/.test(text)) return excelSerialToIsoDate(Number(text))
  return null
}

/** Numeric or numeric-text cell; blanks and malformed values become null. */
export function rateCellToNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let cleaned = value.replace(/[%\s]/g, '')
  if (!cleaned) return null
  // A comma is a thousands separator in "3,490.98" but a decimal comma in
  // "3,49". Only strip it when the whole string is a valid thousands grouping;
  // otherwise interpret it as a decimal point.
  cleaned = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)
    ? cleaned.replace(/,/g, '')
    : cleaned.replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null

  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

/**
 * Parses one workbook. `kind` selects the expected bucket count; a workbook
 * whose data rows do not match that count is rejected as an unexpected shape.
 */
export function parseAverageRateWorkbook(
  bytes: Uint8Array | ArrayBuffer,
  kind: AverageRateKind,
): AverageRateRow[] {
  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes
  // BIFF8 .xls files are OLE compound documents. SheetJS is lenient enough to
  // return an empty workbook for arbitrary bytes, so reject the wrong format
  // here instead of reporting a confusing "no rows".
  if (
    data.byteLength < 8 ||
    data[0] !== 0xd0 ||
    data[1] !== 0xcf ||
    data[2] !== 0x11 ||
    data[3] !== 0xe0
  ) {
    throw new RateParseError('malformed-workbook', `the ${kind} rates file is not an XLS workbook`)
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array', cellDates: false })
  } catch (error) {
    throw new RateParseError(
      'malformed-workbook',
      `could not read the ${kind} rates workbook: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const names = workbook.SheetNames
  if (names.length === 0) {
    throw new RateParseError('unexpected-shape', `the ${kind} rates workbook has no sheets`)
  }

  const candidates = candidateSheets(names, kind)
  let shapeMismatch = false
  for (const name of candidates) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const rows = readRows(sheet)
    const parsed = parseRows(rows, kind)
    if (parsed.rows.length > 0) return parsed.rows
    shapeMismatch = shapeMismatch || parsed.sawData
  }

  throw new RateParseError(
    shapeMismatch ? 'unexpected-shape' : 'no-rows',
    shapeMismatch
      ? `the ${kind} rates workbook does not match the expected column layout`
      : `the ${kind} rates workbook contains no data rows`,
  )
}

function candidateSheets(names: string[], kind: AverageRateKind): string[] {
  if (kind === 'indexed') {
    // The modern indexed table lives in RESULT. RESULT_OLD is a different
    // historical table with different buckets, so never silently fall back to
    // it: if RESULT exists and fails, the caller must see the failure.
    return names.includes('RESULT')
      ? ['RESULT']
      : names.filter((name) => !/OLD/i.test(name))
  }

  // The non-indexed workbook's first sheet is the modern table. Prefer a name
  // that names its start date, then the first sheet, then the rest.
  const modern = names.find((name) => name.includes('01.03.2013'))
  const first = names[0]
  return [...new Set([modern, first, ...names].filter((name): name is string => Boolean(name)))]
}

function readRows(sheet: XLSX.WorkSheet): unknown[][] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  return rows
}

function parseRows(
  rows: unknown[][],
  kind: AverageRateKind,
): { rows: AverageRateRow[]; sawData: boolean } {
  const expectedRateColumns = AVERAGE_RATE_BUCKETS[kind].length + 1 // average + buckets
  const parsed: AverageRateRow[] = []
  let sawData = false

  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const average = rateCellToNumber(row[0])
    // A data row starts with the average rate. Header rows start with text.
    if (average === null || average <= 0 || average >= 100) continue

    sawData = true
    const dateIndex = firstDateColumn(row)
    if (dateIndex === null) continue
    // A different column count means this is a different table (for example
    // the pre-2013 non-indexed sheet), not the one we asked for.
    if (dateIndex !== expectedRateColumns) continue

    const validFrom = dateCellToIso(row[dateIndex])
    if (!validFrom) continue

    const buckets: Partial<Record<AverageRateBucketId, number>> = {}
    AVERAGE_RATE_BUCKETS[kind].forEach((bucket, index) => {
      const value = rateCellToNumber(row[index + 1])
      // 0 is a legitimate published value (no loans in a bucket), so keep it;
      // only blanks and impossible percentages are dropped.
      if (value !== null && value >= 0 && value < 100) buckets[bucket.id] = value
    })

    parsed.push({
      validFrom,
      periodToDueDate: dateCellToIso(row[dateIndex + 1]),
      average,
      buckets,
    })
  }

  // Newest first, with duplicate publications collapsed to the first row.
  const byDate = new Map<string, AverageRateRow>()
  for (const row of parsed) {
    if (!byDate.has(row.validFrom)) byDate.set(row.validFrom, row)
  }
  return {
    rows: [...byDate.values()].sort((a, b) => b.validFrom.localeCompare(a.validFrom)),
    sawData,
  }
}

/** Index of the first date-looking cell, searching after the average column. */
function firstDateColumn(row: unknown[]): number | null {
  for (let index = 1; index < row.length; index++) {
    if (isDateCell(row[index])) return index
  }
  return null
}

function isDateCell(value: unknown): boolean {
  if (typeof value === 'number') return value >= 20_000 && value <= 80_000
  return dateCellToIso(value) !== null
}
