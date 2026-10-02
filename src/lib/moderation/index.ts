/**
 * Harmful-language filter for user-generated text.
 *
 * Server-side only in practice: the route handlers are the gate, and a
 * client-side check (if one is ever added for faster feedback) must always be
 * a courtesy on top, never the actual check, since anything the browser does
 * can be skipped by posting to the API directly.
 *
 * v1 is tier 1 + 2 from the plan: a denylist plus normalization, in Hebrew and
 * English. A hosted moderation API is a deliberate later step (another
 * dependency, another key to manage) rather than something this ships with.
 * The lists are data files under ./lists and are expected to be replaced or
 * extended from a reviewed source; see the notes in each list.
 */
export { checkText, moderationEntries, type ModerationVerdict } from './check'
export { collapseForMatching, normalizeForMatching } from './normalize'
export type { ProfanityEntry } from './types'
