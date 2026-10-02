/**
 * The denylist entry shape. `id` is a stable, non-profane label for the entry
 * (used in logs and tests instead of the word itself, so a rejected post is
 * never recorded verbatim).
 */
export interface ProfanityEntry {
  /** Lowercase id, e.g. 'en-shit' or 'he-hara'. Never the word itself. */
  id: string
  /** The word or phrase to match, in its normal spelling. */
  match: string
  severity: 1 | 2 | 3 | 4
  tags?: readonly string[]
}
