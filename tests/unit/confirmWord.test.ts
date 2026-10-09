import { describe, expect, it } from 'vitest'
import { matchesConfirmWord } from '@/lib/confirmWord'

/**
 * The typed confirmation that arms the profile's delete-account button.
 *
 * It guards an irreversible action, so the cases that matter are the ones that
 * must NOT arm it: a blank translation, a blank entry, a near miss.
 */
describe('matchesConfirmWord', () => {
  it('matches the word exactly', () => {
    expect(matchesConfirmWord('מחיקה', 'מחיקה')).toBe(true)
    expect(matchesConfirmWord('DELETE', 'DELETE')).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(matchesConfirmWord('  מחיקה ', 'מחיקה')).toBe(true)
  })

  it('ignores case', () => {
    // A user typing `delete` for a `DELETE` prompt is confirming in intent.
    expect(matchesConfirmWord('delete', 'DELETE')).toBe(true)
    expect(matchesConfirmWord('DeLeTe', 'DELETE')).toBe(true)
  })

  it('refuses anything else', () => {
    expect(matchesConfirmWord('מחיק', 'מחיקה')).toBe(false)
    expect(matchesConfirmWord('DELETE!', 'DELETE')).toBe(false)
    expect(matchesConfirmWord('', 'DELETE')).toBe(false)
    expect(matchesConfirmWord(' ', 'DELETE')).toBe(false)
  })

  it('never arms the action when the expected word is blank', () => {
    // A missing or whitespace-only translation must not turn the destructive
    // button into a one-click one.
    expect(matchesConfirmWord('', '')).toBe(false)
    expect(matchesConfirmWord('anything', '')).toBe(false)
    expect(matchesConfirmWord('anything', '   ')).toBe(false)
  })
})
