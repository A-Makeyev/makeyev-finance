import { describe, expect, it } from 'vitest'

/**
 * Concrete-value tests for the market display formatters. The expected
 * strings were derived by hand from the spec examples (NASDAQ 23,456.78,
 * Bitcoin $112,345, +0.42% / -1.37%) and standard en-US grouping - the
 * project rule for any display math. The missing-data placeholder is a
 * plain hyphen (the project bans the em dash character).
 */
import {
  formatMarketChange,
  formatMarketChangePercent,
  formatMarketPrice,
  formatMarketQuotePrice,
  marketTrendOf,
  priceTickTrend,
} from '@/lib/marketFormat'

describe('formatMarketPrice', () => {
  it('groups thousands and keeps 2 decimals for index ETFs', () => {
    expect(formatMarketPrice(23456.781, 2)).toBe('23,456.78')
    expect(formatMarketPrice(6543.2, 2)).toBe('6,543.20')
    expect(formatMarketPrice(2345.67, 2)).toBe('2,345.67')
  })

  it('formats Bitcoin with no decimals', () => {
    expect(formatMarketPrice(112345.49, 0)).toBe('112,345')
  })

  it('never prints NaN or Infinity', () => {
    expect(formatMarketPrice(Number.NaN, 2)).toBe('-')
    expect(formatMarketPrice(Number.POSITIVE_INFINITY, 2)).toBe('-')
    expect(formatMarketPrice(null, 2)).toBe('-')
  })
})

describe('formatMarketQuotePrice', () => {
  it('prefixes $ for USD-quoted instruments (ETFs, crypto, commodities)', () => {
    expect(formatMarketQuotePrice(765.96, 2, 'USD', 'etf')).toBe('$765.96')
    expect(formatMarketQuotePrice(521.4, 2, 'USD', 'etf')).toBe('$521.40')
    expect(formatMarketQuotePrice(79551.34, 0, 'USD', 'crypto')).toBe('$79,551')
    // Gold: dollars per troy ounce of the front-month contract.
    expect(formatMarketQuotePrice(4408.9, 2, 'USD', 'commodity')).toBe('$4,408.90')
  })

  it('keeps ILS-quoted index levels plain (TA-35)', () => {
    expect(formatMarketQuotePrice(125.32, 2, 'ILS', 'index')).toBe('125.32')
    expect(formatMarketQuotePrice(2345.67, 2, 'ILS', 'index')).toBe('2,345.67')
  })

  it('gives FX pairs the sign of their quote leg (USD/ILS -> shekels per dollar)', () => {
    expect(formatMarketQuotePrice(3.0192, 4, 'USD', 'currency')).toBe('₪3.0192')
    expect(formatMarketQuotePrice(3.7621, 4, 'ILS', 'currency')).toBe('₪3.7621')
    // The base leg being USD must not leak the dollar sign in.
    expect(formatMarketQuotePrice(765.96, 2, 'USD', 'currency')).toBe('₪765.96')
  })

  it('never puts a currency sign on an index level (points, not shekels)', () => {
    expect(formatMarketQuotePrice(2345.67, 2, 'ILS', 'index')).toBe('2,345.67')
    expect(formatMarketQuotePrice(2345.67, 2, 'USD', 'index')).toBe('$2,345.67')
  })

  it('never prints NaN or Infinity and degrades null to a hyphen', () => {
    expect(formatMarketQuotePrice(null, 2, 'USD', 'etf')).toBe('-')
    expect(formatMarketQuotePrice(Number.NaN, 2, 'USD', 'etf')).toBe('-')
    expect(formatMarketQuotePrice(Number.POSITIVE_INFINITY, 2, 'ILS', 'index')).toBe('-')
    // Zero is a real FX rate and must render, not degrade to the placeholder.
    expect(formatMarketQuotePrice(0, 4, 'USD', 'currency')).toBe('₪0.0000')
  })
})

describe('formatMarketChangePercent', () => {
  it('signs positives and keeps negatives as-is', () => {
    expect(formatMarketChangePercent(0.4213)).toBe('+0.42%')
    expect(formatMarketChangePercent(-1.37)).toBe('-1.37%')
    expect(formatMarketChangePercent(-0.5492)).toBe('-0.55%')
  })

  it('shows 0.00% for exactly flat and degrades null/NaN to a hyphen', () => {
    expect(formatMarketChangePercent(0)).toBe('0.00%')
    expect(formatMarketChangePercent(null)).toBe('-')
    expect(formatMarketChangePercent(Number.NaN)).toBe('-')
  })
})

describe('formatMarketChange', () => {
  it('signs and rounds like the price formatter', () => {
    expect(formatMarketChange(52.31, 2)).toBe('+52.31')
    expect(formatMarketChange(-4.23, 2)).toBe('-4.23')
    expect(formatMarketChange(0, 2)).toBe('0.00')
    expect(formatMarketChange(null, 2)).toBe('-')
  })
})

describe('marketTrendOf', () => {
  it('maps to the semantic up/down/flat tones', () => {
    expect(marketTrendOf(0.42)).toBe('up')
    expect(marketTrendOf(-0.42)).toBe('down')
    expect(marketTrendOf(0)).toBe('flat')
    expect(marketTrendOf(null)).toBe('flat')
    expect(marketTrendOf(Number.NaN)).toBe('flat')
  })
})

describe('priceTickTrend', () => {
  it('reports the direction of a move that changes the displayed price', () => {
    expect(priceTickTrend(765.96, 770, 2)).toBe('up')
    expect(priceTickTrend(765.96, 760.5, 2)).toBe('down')
    expect(priceTickTrend(3.0192, 3.0193, 4)).toBe('up')
    expect(priceTickTrend(79551.34, 79552.4, 0)).toBe('up')
  })

  it('stays silent when the rendered number is unchanged', () => {
    expect(priceTickTrend(765.96, 765.96, 2)).toBeNull()
    // Sub-precision moves: both render "765.96", so a flash would sit next to
    // a number that never changed. Same for crypto and FX precision.
    expect(priceTickTrend(765.961, 765.964, 2)).toBeNull()
    expect(priceTickTrend(79551.34, 79551.49, 0)).toBeNull()
    expect(priceTickTrend(3.01921, 3.01924, 4)).toBeNull()
  })

  it('flashes on the move that crosses a display boundary', () => {
    // 765.964 renders 765.96, 765.965 renders 765.97 (Intl half-expand).
    expect(priceTickTrend(765.964, 765.965, 2)).toBe('up')
    expect(priceTickTrend(765.965, 765.964, 2)).toBe('down')
  })

  it('never flashes on first paint or on non-finite prices', () => {
    expect(priceTickTrend(null, 765.96, 2)).toBeNull()
    expect(priceTickTrend(765.96, null, 2)).toBeNull()
    expect(priceTickTrend(Number.NaN, 765.96, 2)).toBeNull()
    expect(priceTickTrend(765.96, Number.NaN, 2)).toBeNull()
    expect(priceTickTrend(Number.POSITIVE_INFINITY, 765.96, 2)).toBeNull()
  })
})
