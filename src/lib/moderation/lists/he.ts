import type { ProfanityEntry } from '../types'

/**
 * Hebrew denylist, v1. SMALL ON PURPOSE - read this before extending it.
 *
 * Sourcing: there is no equivalent of the good English open lists for Hebrew.
 * The one widely-copied multi-language list files Hebrew under the Yiddish
 * ISO code (`yid`), which is a strong sign its Hebrew column was never
 * reviewed. Dumping it in would produce both false positives and false
 * negatives, so this list is a short, hand-checked starting set instead: only
 * words that are unambiguously profanity or a slur to a Hebrew speaker. It
 * needs a native-speaker pass, and expanding it is a real task, not a copy.
 *
 * Deliberate omissions, because the everyday meaning is not profanity:
 *  - כוס: outside slang it is the ordinary word for a drinking glass
 *    ('כוס מים'), so a boundary match would reject an innocent sentence.
 *  - מטומטם / דפוק / אידיוט: constant, benign banter; blocking them would
 *    reject ordinary disagreement.
 *
 * Exact matching on the word boundary keeps the everyday lookalikes safe:
 * 'מזין' (to feed) contains 'זין' but not at a boundary, and final letter
 * forms are folded, so a final form typed mid-word still matches.
 */
export const HE_PROFANITY: readonly ProfanityEntry[] = [
  { id: 'he-zayin', match: 'זין', severity: 3, tags: ['sexual'] },
  { id: 'he-hara', match: 'חרא', severity: 3, tags: ['general'] },
  { id: 'he-zona', match: 'זונה', severity: 3, tags: ['sexual'] },
  // Covers both 'בן זונה' and the joined 'בנזונה' via the collapsed match.
  { id: 'he-ben-zona', match: 'בן זונה', severity: 4, tags: ['sexual'] },
  { id: 'he-sharmuta', match: 'שרמוטה', severity: 4, tags: ['sexual'] },
  { id: 'he-maniak', match: 'מניאק', severity: 3, tags: ['general'] },
  // One stem covers תזדיין / מזדיין / לך תזדיין through the collapsed match.
  { id: 'he-zdayen', match: 'זדיין', severity: 3, tags: ['sexual'] },
  { id: 'he-kusemek', match: 'כוסאמק', severity: 4, tags: ['sexual'] },
  { id: 'he-mefager', match: 'מפגר', severity: 3, tags: ['general'] },
  { id: 'he-kochsinel', match: 'קוקסינל', severity: 4, tags: ['lgbtq'] },
]
