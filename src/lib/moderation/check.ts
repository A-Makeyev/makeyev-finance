import { EN_PROFANITY } from './lists/en'
import { HE_PROFANITY } from './lists/he'
import { collapseForMatching, normalizeForMatching } from './normalize'
import type { ProfanityEntry } from './types'

/**
 * The harmful-language check, pure and dependency-free so it is unit-tested
 * against concrete inputs like the amortization rules.
 *
 * Hebrew and English are checked together regardless of the UI language: a
 * Hebrew comment can carry an English slur and vice versa, and the language of
 * the interface says nothing about the language of the text.
 */

const ENTRIES: readonly ProfanityEntry[] = [...EN_PROFANITY, ...HE_PROFANITY]

/**
 * Shorter than this and the collapsed (separator-free) form matches far too
 * eagerly, e.g. 'ass' inside 'classic'. Longer entries match their collapsed
 * form too, which is what catches inflections ('fuck' -> 'fucking').
 */
const MIN_COLLAPSED_LENGTH = 4

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whole-word match. The lookarounds treat any letter or digit as part of a
 * word, which is exactly what keeps 'זין' out of 'מזין' and 'ass' out of
 * 'class'.
 */
function boundaryRegex(normalizedMatch: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalizedMatch)}(?![\\p{L}\\p{N}])`, 'u')
}

interface PreparedEntry {
  id: string
  regex: RegExp
  collapsed: string
}

// Prepared once at module load rather than per check: the entry list is static.
const PREPARED: readonly PreparedEntry[] = ENTRIES.map((entry) => {
  const normalized = normalizeForMatching(entry.match)
  return {
    id: entry.id,
    regex: boundaryRegex(normalized),
    collapsed: collapseForMatching(normalized),
  }
})

export interface ModerationVerdict {
  ok: boolean
  /**
   * The IDs of the entries that matched, never the words themselves: this is
   * what a rejection is logged with, so harmful content is not stored in the
   * logs while still leaving enough to tune the list.
   */
  matchedIds: string[]
}

/** True when the text passes the denylist. */
export function checkText(text: string): ModerationVerdict {
  const normalized = normalizeForMatching(text)
  const collapsed = collapseForMatching(normalized)

  const matchedIds: string[] = []
  for (const entry of PREPARED) {
    const hit =
      entry.regex.test(normalized) ||
      (entry.collapsed.length >= MIN_COLLAPSED_LENGTH && collapsed.includes(entry.collapsed))
    if (hit) matchedIds.push(entry.id)
  }

  return { ok: matchedIds.length === 0, matchedIds }
}

/** The full list, for tests that need to assert coverage of every entry. */
export function moderationEntries(): readonly ProfanityEntry[] {
  return ENTRIES
}
