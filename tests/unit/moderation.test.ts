import { describe, expect, it } from 'vitest'
import { checkText, moderationEntries } from '@/lib/moderation'

/**
 * The filter is a denylist plus normalization, so the tests that matter are:
 * it catches the obvious cases and the cheap evasions, and it does NOT reject
 * ordinary words that merely contain a listed string. False positives are the
 * expensive failure here: they reject a legitimate comment and the author has
 * no way to argue with a regex.
 */

describe('sentences and evasions', () => {
  it('passes ordinary text, in both languages', () => {
    expect(checkText('תודה על המאמר, עזר לי מאוד').ok).toBe(true)
    expect(checkText('Thanks, this was really helpful.').ok).toBe(true)
    expect(checkText('').ok).toBe(true)
  })

  it('blocks a listed word regardless of case', () => {
    expect(checkText('What the SHIT is this').ok).toBe(false)
  })

  it('catches inflections of a listed stem', () => {
    const verdict = checkText('stop fucking around')
    expect(verdict.ok).toBe(false)
    expect(verdict.matchedIds).toContain('en-fuck')
  })

  it('sees through separator-splitting', () => {
    expect(checkText('s h i t').ok).toBe(false)
    expect(checkText('s-h-i-t').ok).toBe(false)
    expect(checkText('s.h.i.t').ok).toBe(false)
  })

  it('sees through character substitutions', () => {
    // '1' stands in for 'i', '@' for 'a', '4' for 'a'.
    expect(checkText('sh1t').ok).toBe(false)
    expect(checkText('b@stard').ok).toBe(false)
    expect(checkText('4sshole').ok).toBe(false)
  })

  it('sees through a stretched-out spelling', () => {
    expect(checkText('shiiiiiit').ok).toBe(false)
  })

  it('does not match a listed string inside a longer word', () => {
    // The whole point of the boundary match: these are ordinary words.
    expect(checkText('a classic example').ok).toBe(true)
    expect(checkText('the assassin was caught').ok).toBe(true)
  })
})

describe('Hebrew', () => {
  it('blocks a listed Hebrew word', () => {
    expect(checkText('איזה חרא').ok).toBe(false)
  })

  it('blocks it written with niqqud', () => {
    expect(checkText('חָרָא').ok).toBe(false)
  })

  it('folds final letter forms, so a word typed with a regular form still matches', () => {
    // The entry is 'בן זונה' (final nun); typing the regular nun must not slip
    // past, because both sides are folded before matching.
    expect(checkText('בנ זונה').ok).toBe(false)
  })

  it('does not fire on a word that merely contains a listed one', () => {
    // 'מזין' (to feed) contains 'זין' but not at a boundary.
    expect(checkText('הבנק מזין את החשבון').ok).toBe(true)
  })

  it('blocks the joined form of a two-word phrase', () => {
    const apart = checkText('הוא בן זונה')
    const joined = checkText('הוא בנזונה')
    expect(apart.ok).toBe(false)
    expect(joined.ok).toBe(false)
    expect(apart.matchedIds).toContain('he-ben-zona')
    expect(joined.matchedIds).toContain('he-ben-zona')
  })

  it('does not block כוס, which usually just means a drinking glass', () => {
    // Deliberate omission, documented in the list: blocking it would reject
    // 'כוס מים'.
    expect(checkText('אפשר כוס מים בבקשה').ok).toBe(true)
  })
})

describe('the verdict', () => {
  it('reports entry ids, never the matched words', () => {
    const verdict = checkText('what a fuck up')
    expect(verdict.ok).toBe(false)
    // Ids are log-safe: a rejection can be recorded without storing the text.
    for (const id of verdict.matchedIds) expect(id).toMatch(/^(en|he)-[\w-]+$/)
  })

  it('reports nothing for clean text', () => {
    expect(checkText('great article').matchedIds).toEqual([])
  })

  it('has a unique id for every entry', () => {
    const ids = moderationEntries().map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
