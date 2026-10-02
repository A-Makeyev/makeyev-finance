import type { ProfanityEntry } from '../types'

/**
 * English denylist, v1.
 *
 * Scope: words that are profanity or a slur in ordinary usage, not general
 * insults ('idiot', 'stupid'), which would block ordinary disagreement.
 *
 * Sourcing: the entries are the well-known core of the classic open profanity
 * lists (the Shutterstock list and its maintained forks, e.g. LDNOOBWV2 and
 * dsojevic/profanity-list). That corpus is a starting point, not a review:
 * expand it from a maintained list rather than by hand, and expect to tune the
 * severities against real traffic.
 *
 * The matching works on inflections for free: entries of four or more
 * characters also match their collapsed form, so 'fuck' already covers
 * 'fucking' and 'fucker', and 'shit' covers 'shitty'.
 */
export const EN_PROFANITY: readonly ProfanityEntry[] = [
  // General profanity.
  { id: 'en-fuck', match: 'fuck', severity: 4, tags: ['sexual'] },
  { id: 'en-shit', match: 'shit', severity: 3, tags: ['general'] },
  { id: 'en-motherfucker', match: 'motherfucker', severity: 4, tags: ['sexual'] },
  { id: 'en-cunt', match: 'cunt', severity: 4, tags: ['sexual'] },
  { id: 'en-asshole', match: 'asshole', severity: 3, tags: ['general'] },
  { id: 'en-ass', match: 'ass', severity: 1, tags: ['general'] },
  { id: 'en-bitch', match: 'bitch', severity: 3, tags: ['general'] },
  { id: 'en-bastard', match: 'bastard', severity: 2, tags: ['general'] },
  { id: 'en-dick', match: 'dick', severity: 2, tags: ['sexual'] },
  { id: 'en-prick', match: 'prick', severity: 2, tags: ['general'] },
  { id: 'en-wanker', match: 'wanker', severity: 3, tags: ['sexual'] },
  { id: 'en-bollocks', match: 'bollocks', severity: 3, tags: ['general'] },
  { id: 'en-piss', match: 'piss', severity: 2, tags: ['general'] },
  { id: 'en-crap', match: 'crap', severity: 1, tags: ['general'] },
  { id: 'en-pussy', match: 'pussy', severity: 3, tags: ['sexual'] },
  { id: 'en-whore', match: 'whore', severity: 3, tags: ['sexual'] },
  { id: 'en-slut', match: 'slut', severity: 3, tags: ['sexual'] },
  { id: 'en-rape', match: 'rape', severity: 4, tags: ['sexual'] },

  // Slurs. Higher severity: these are about who someone is, not what they did.
  { id: 'en-n-word', match: 'nigger', severity: 4, tags: ['racial'] },
  { id: 'en-fag', match: 'faggot', severity: 4, tags: ['lgbtq'] },
  { id: 'en-retard', match: 'retard', severity: 3, tags: ['general'] },
  { id: 'en-kike', match: 'kike', severity: 4, tags: ['religious'] },
  { id: 'en-spic', match: 'spic', severity: 4, tags: ['racial'] },
  { id: 'en-chink', match: 'chink', severity: 4, tags: ['racial'] },
]
