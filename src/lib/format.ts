const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

/** ₪ currency formatting, identical to the legacy calculator. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

/**
 * Legacy inputs displayed amounts with en-US grouping (comma separators),
 * deliberately different from the he-IL currency formatter.
 */
export function formatGroupedNumber(value: number): string {
  return value.toLocaleString('en-US')
}

/** Parses user-typed money text: strips ₪ signs, commas and whitespace. */
export function parseAmountText(raw: string): number {
  return Number(raw.replace(/[₪,\s]/g, '')) || 0
}

export interface AmountCaretResult {
  text: string
  caret: number | null
}

/**
 * Pure port of the legacy `formatAmountInput` (src/calculator.js:66-90):
 * - keeps digits and a single dot only,
 * - applies en-US thousands grouping to the integer part,
 * - restores the caret so the same count of digit/dot characters sits before
 *   it as before the reformat (cursor stability while typing).
 * `caret === null` skips caret computation (unfocused updates).
 */
export function formatAmountWithCaret(raw: string, caret: number | null): AmountCaretResult {
  if (caret !== null) {
    const digitsBeforeCursor = raw.slice(0, caret).replace(/[^0-9.]/g, '').length
    const text = sanitizeAmountText(raw)
    if (!text) return { text: '', caret: 0 }

    let counted = 0
    let position = text.length
    for (let index = 0; index < text.length; index++) {
      if (/[0-9.]/.test(text[index])) counted++
      if (counted >= digitsBeforeCursor) {
        position = index + 1
        break
      }
    }
    return { text, caret: position }
  }
  return { text: sanitizeAmountText(raw), caret: null }
}

/** Non-caret half of the legacy formatter: grouping + single-dot enforcement. */
function sanitizeAmountText(raw: string): string {
  let numericValue = raw.replace(/[^0-9.]/g, '')
  if (!numericValue) return ''
  const firstDot = numericValue.indexOf('.')
  if (firstDot !== -1) {
    numericValue =
      numericValue.slice(0, firstDot + 1) + numericValue.slice(firstDot + 1).replace(/\./g, '')
  }
  const [integerPart, decimalPart] = numericValue.split('.')
  const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0'
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
}

/**
 * Percent display that never rounds a small rate to "0.0%": whole numbers stay
 * whole, rates under 1% get 3 decimals, otherwise 1 decimal — trailing zeros
 * trimmed (e.g. 0.0372 → "0.037", 8.271 → "8.3").
 */
export function formatRatePercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0'
  if (Number.isInteger(percent)) return String(percent)
  const decimals = percent < 1 ? 3 : 1
  return percent.toFixed(decimals).replace(/\.?0+$/, '')
}

/** Digits-only clamp for the track-years field (legacy constrainTrackYears). */
export function constrainYearsText(raw: string, maximumYears: number): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  let years = Number(digits)
  if (years > maximumYears) years = maximumYears
  if (years < 1) years = 1
  return String(years)
}
