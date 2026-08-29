import { formatCurrency } from '../../src/lib/format'

export { formatCurrency }

/**
 * Expected visible text for an ILS amount. he-IL Intl output embeds RTL marks
 * (U+200F) and NBSP around the ₪ sign — always compare through this helper
 * instead of literal strings like '₪5,067'.
 */
export function ils(value: number): string {
  return formatCurrency(value)
}

/** Strips bidi control characters for loose containment checks. */
export function stripBidi(text: string): string {
  return text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
}
