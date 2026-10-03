import { describe, expect, it } from 'vitest'
import { normalizeMixLabel } from '@/server/mixes/label'
import { MAX_MIX_LABEL_LENGTH, savedMixInputSchema } from '@/server/mixes/schema'
import {
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  PTI_MAX_THRESHOLD,
  PTI_MIN_THRESHOLD,
} from '@/lib/amortization'

/**
 * The route handler re-validates everything a client sends, so these are the
 * real bounds on stored data - not the UI's. Concrete in/out cases, including
 * the exact boundaries.
 */

const track = {
  type: 'fixed' as const,
  amountText: '100,000',
  yearsText: '30',
  rateText: '4.8',
  method: 'spitzer' as const,
}

const validMix = { label: 'First home', termYears: 30, tracks: [track] }

describe('savedMixInputSchema', () => {
  it('accepts a well-formed mix', () => {
    expect(savedMixInputSchema.safeParse(validMix).success).toBe(true)
  })

  it('trims the label', () => {
    const parsed = savedMixInputSchema.parse({ ...validMix, label: '  Home  ' })
    expect(parsed.label).toBe('Home')
  })

  it('rejects an empty or whitespace-only label', () => {
    expect(savedMixInputSchema.safeParse({ ...validMix, label: '' }).success).toBe(false)
    expect(savedMixInputSchema.safeParse({ ...validMix, label: '   ' }).success).toBe(false)
  })

  it('rejects a label longer than the cap', () => {
    expect(
      savedMixInputSchema.safeParse({
        ...validMix,
        label: 'x'.repeat(MAX_MIX_LABEL_LENGTH + 1),
      }).success,
    ).toBe(false)
  })

  it('requires at least one track and no more than MAX_TRACKS', () => {
    expect(savedMixInputSchema.safeParse({ ...validMix, tracks: [] }).success).toBe(false)
    const tooMany = Array.from({ length: MAX_TRACKS + 1 }, () => track)
    expect(savedMixInputSchema.safeParse({ ...validMix, tracks: tooMany }).success).toBe(false)
  })

  it('rejects a track with no amount or a zero amount', () => {
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, amountText: '' }] }).success,
    ).toBe(false)
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, amountText: '0' }] }).success,
    ).toBe(false)
  })

  it('rejects amount text that is not the calculator format', () => {
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, amountText: '12 345' }] })
        .success,
    ).toBe(false)
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, amountText: '-500' }] })
        .success,
    ).toBe(false)
  })

  it('bounds track years to 1..MAX_YEARS', () => {
    const withYears = (yearsText: string) => ({
      ...validMix,
      tracks: [{ ...track, yearsText }],
    })
    expect(savedMixInputSchema.safeParse(withYears('0')).success).toBe(false)
    expect(savedMixInputSchema.safeParse(withYears(String(MAX_YEARS))).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withYears(String(MAX_YEARS + 1))).success).toBe(false)
    expect(savedMixInputSchema.safeParse(withYears('12.5')).success).toBe(false)
  })

  it('bounds the track rate to 0..100 and allows a blank rate', () => {
    const withRate = (rateText: string) => ({
      ...validMix,
      tracks: [{ ...track, rateText }],
    })
    expect(savedMixInputSchema.safeParse(withRate('')).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withRate('4.8')).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withRate('101')).success).toBe(false)
    expect(savedMixInputSchema.safeParse(withRate('abc')).success).toBe(false)
  })

  it('bounds termYears to 1..MAX_YEARS and requires an integer', () => {
    expect(savedMixInputSchema.safeParse({ ...validMix, termYears: 0 }).success).toBe(false)
    expect(savedMixInputSchema.safeParse({ ...validMix, termYears: MAX_YEARS }).success).toBe(true)
    expect(savedMixInputSchema.safeParse({ ...validMix, termYears: MAX_YEARS + 1 }).success).toBe(
      false,
    )
    expect(savedMixInputSchema.safeParse({ ...validMix, termYears: 12.5 }).success).toBe(false)
  })

  it('rejects an unknown track type or amortization method', () => {
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, type: 'balloon' }] })
        .success,
    ).toBe(false)
    expect(
      savedMixInputSchema.safeParse({ ...validMix, tracks: [{ ...track, method: 'grace' }] }).success,
    ).toBe(false)
  })
})

describe('savedMixInputSchema scenario', () => {
  const scenario = {
    startingAmountText: '1,000,000',
    propertyValueText: '1,500,000',
    capitalText: '400,000',
    incomeText: '25,000',
    purpose: 'first',
    realtorPercentText: '',
    lawyerPercentText: '1',
    appraiserFeeText: '',
    renovationAmountText: '50,000',
    otherExpenses: [{ label: 'רכב', amountText: '1,200', oneTimeAmountText: '' }],
    ptiThresholdPercent: 33,
  }

  it('accepts a mix with a well-formed scenario', () => {
    expect(savedMixInputSchema.safeParse({ ...validMix, scenario }).success).toBe(true)
  })

  it('still accepts a mix with no scenario (an older saved mix)', () => {
    expect(savedMixInputSchema.safeParse(validMix).success).toBe(true)
  })

  it('rejects an unknown purpose', () => {
    expect(
      savedMixInputSchema.safeParse({ ...validMix, scenario: { ...scenario, purpose: 'holiday' } })
        .success,
    ).toBe(false)
  })

  it('bounds the PTI threshold to the app range, inclusive', () => {
    const withPti = (ptiThresholdPercent: number) => ({
      ...validMix,
      scenario: { ...scenario, ptiThresholdPercent },
    })
    expect(savedMixInputSchema.safeParse(withPti(PTI_MIN_THRESHOLD * 100)).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withPti(PTI_MAX_THRESHOLD * 100)).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withPti(PTI_MIN_THRESHOLD * 100 - 0.1)).success).toBe(false)
    expect(savedMixInputSchema.safeParse(withPti(PTI_MAX_THRESHOLD * 100 + 0.1)).success).toBe(false)
  })

  it('rejects scenario amounts that are not the calculator format', () => {
    expect(
      savedMixInputSchema.safeParse({
        ...validMix,
        scenario: { ...scenario, propertyValueText: '1 500 000' },
      }).success,
    ).toBe(false)
  })

  it('caps the number of other-expense lines', () => {
    const expense = { label: '', amountText: '1', oneTimeAmountText: '' }
    const withExpenses = (count: number) => ({
      ...validMix,
      scenario: { ...scenario, otherExpenses: Array.from({ length: count }, () => expense) },
    })
    expect(savedMixInputSchema.safeParse(withExpenses(MAX_OTHER_EXPENSES)).success).toBe(true)
    expect(savedMixInputSchema.safeParse(withExpenses(MAX_OTHER_EXPENSES + 1)).success).toBe(false)
  })
})

/**
 * Duplicate names are compared through this helper (the repo refuses a mix
 * whose normalized name is already taken). Case-insensitive and trimmed, so a
 * reader cannot tell two mixes apart by a difference the eye does not see.
 */
describe('normalizeMixLabel', () => {
  it('treats case and surrounding whitespace as the same name', () => {
    expect(normalizeMixLabel('First Home')).toBe(normalizeMixLabel('  first home  '))
  })

  it('keeps genuinely different names apart', () => {
    expect(normalizeMixLabel('First home')).not.toBe(normalizeMixLabel('Second home'))
  })
})
