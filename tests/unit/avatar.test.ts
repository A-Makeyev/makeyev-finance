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

  it('skips a bracketed role marker instead of using its punctuation', () => {
    expect(initialsFor('Anatoly (Admin)')).toBe('A')
    expect(initialsFor('Anatoly (Admin) Makeyev')).toBe('AM')
  })

  it('skips any name part that starts with punctuation or a symbol', () => {
    expect(initialsFor('Anatoly / Makeyev')).toBe('AM')
    expect(initialsFor('Anatoly $ Makeyev')).toBe('AM')
    expect(initialsFor('Anatoly \\ Makeyev')).toBe('AM')
    expect(initialsFor('Anatoly % Makeyev')).toBe('AM')
    expect(initialsFor('Anatoly @ Makeyev')).toBe('AM')
    expect(initialsFor('Anatoly # Makeyev')).toBe('AM')
    // The marker can be the only second part: it must not become the initial.
    expect(initialsFor('Maya (Advisor)')).toBe('M')
  })

  it('keeps accented Latin, Cyrillic and digits as name parts', () => {
    expect(initialsFor('Émile Zola')).toBe('ÉZ')
    expect(initialsFor('Анатолий Макеев')).toBe('АМ')
    expect(initialsFor('Agent 47')).toBe('A4')
  })

  it('returns an empty string when no part starts with a letter', () => {
    expect(initialsFor('((((')).toBe('')
    expect(initialsFor('--- ***')).toBe('')
  })

  it('returns an empty string for missing or blank names', () => {
    expect(initialsFor(null)).toBe('')
    expect(initialsFor(undefined)).toBe('')
    expect(initialsFor('')).toBe('')
    expect(initialsFor('   ')).toBe('')
  })
})
