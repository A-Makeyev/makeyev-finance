/**
 * Shared site-state fixture data: the localStorage keys the client reads and
 * the values it accepts. The theme contract lives in client/src/theme (the
 * key is site_theme); the language key is the client's language store. The
 * fixtures/ layer (locale.ts, theme.ts) writes these through addInitScript,
 * but every spec that hand-seeds state reads the same names from here.
 */

export const STORAGE_KEYS = {
  language: 'site_language',
  theme: 'site_theme',
} as const

export type SiteLanguage = 'hebrew' | 'english'

/** The canonical value for each language, as the language store reads it. */
export const LANGUAGE_VALUES: Record<'hebrew' | 'english', SiteLanguage> = {
  hebrew: 'hebrew',
  english: 'english',
}
