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
  formatMarketCryptoPrice,
  formatMarketPrice,
  marketTrendOf,
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

describe('formatMarketCryptoPrice', () => {
  it('prefixes $ only for the crypto row', () => {
    expect(formatMarketCryptoPrice(112345, 0)).toBe('$112,345')
    expect(formatMarketCryptoPrice(79551.34, 0)).toBe('$79,551')
    expect(formatMarketCryptoPrice(null, 0)).toBe('-')
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
