import { describe, expect, it } from 'vitest'
import { initialsFor } from '@/lib/avatar'

describe('initialsFor', () => {
  it('takes the first letter of up to two name parts', () => {
    expect(initialsFor('Anatoly Makeyev')).toBe('AM')
  })

  it('uses a single initial for a one-word name', () => {
    expect(initialsFor('Anatoly')).toBe('A')
  })

  it('keeps Hebrew names intact', () => {
    expect(initialsFor('שלום עולם')).toBe('שע')
  })

  it('ignores extra whitespace and a third name part', () => {
    expect(initialsFor('  Anatoly   Ben   Makeyev  ')).toBe('AB')
  })

  it('returns an empty string for missing or blank names', () => {
    expect(initialsFor(null)).toBe('')
    expect(initialsFor(undefined)).toBe('')
    expect(initialsFor('')).toBe('')
    expect(initialsFor('   ')).toBe('')
  })
})
