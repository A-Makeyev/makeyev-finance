import i18next, { type i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { he } from './he'
import { en } from './en'

export type Language = 'hebrew' | 'english'

/** URL locale segments - `he` is the default and never appears in a URL. */
export const LOCALES: Record<Language, string> = {
  hebrew: 'he',
  english: 'en',
}

export const DEFAULT_LANGUAGE: Language = 'hebrew'

export const LANGUAGE_SEGMENTS = ['he', 'en'] as const
export type LocaleSegment = (typeof LANGUAGE_SEGMENTS)[number]

export function isLocaleSegment(value: string): value is LocaleSegment {
  return (LANGUAGE_SEGMENTS as readonly string[]).includes(value)
}

/** URL segment -> Language. The default segment maps to the default language. */
export function languageFromSegment(segment: string): Language {
  return segment === 'en' ? 'english' : 'hebrew'
}

/** The URL segment a language lives under (hebrew pages have no prefix). */
export function segmentFor(language: Language): string {
  return LOCALES[language]
}

const LANGUAGE_STORAGE_KEY = 'site_language'

const LANGUAGES: readonly Language[] = Object.keys(LOCALES) as Language[]

/**
 * Reads the persisted language choice. Browser-only and never called during
 * module init (the Vite app read localStorage at import time, which breaks
 * under SSR - here the provider calls it inside an effect).
 */
export function resolveStoredLanguage(): Language | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return raw !== null && (LANGUAGES as readonly string[]).includes(raw)
      ? (raw as Language)
      : null
  } catch {
    return null
  }
}

function persistLanguage(language: Language): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Unavailable/quota storage - the session keeps the chosen language.
  }
}

/**
 * Creates an i18next instance for ONE language. Instances are created per
 * call (the provider memoizes per locale) rather than one module-global
 * instance mutated on language change - server renders of different locales
 * must never share mutable state, which is the classic hydration-mismatch
 * trap the scoping doc calls out.
 *
 * Resources ship in the bundle (like the Vite app); the files are small and
 * they are needed on every page, so no fetch waterfall.
 */
export function createI18nInstance(language: Language): I18nInstance {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    resources: {
      he: { translation: he.translation },
      en: { translation: en.translation },
    },
    lng: LOCALES[language],
    fallbackLng: LOCALES[DEFAULT_LANGUAGE],
    interpolation: {
      // React already escapes; i18next should not double-escape.
      escapeValue: false,
    },
    returnNull: false,
    react: {
      // Everything renders inside an explicit I18nextProvider; no global
      // singleton to bind to.
      useSuspense: false,
    },
  })
  return instance
}

/**
 * Direction policy: direction follows the LOCALE. The whole Hebrew segment
 * (the unprefixed URLs) renders RTL and English under /en renders LTR, the way
 * AGENTS.md requires - not just the calculator/compare routes, which used to
 * be the only RTL pages. Markup therefore uses logical properties and `dir`
 * only where the CONTENT's direction differs from the page's (email
 * addresses, a 4-digit code, article bodies quoted in the other language).
 */
export function directionFor(language: Language): 'rtl' | 'ltr' {
  return language === 'hebrew' ? 'rtl' : 'ltr'
}

/**
 * Applies the language to the document (called from the provider on mount;
 * the server layout renders lang server-side). Document direction is owned by
 * the root layouts and re-applied per locale (see applyDocumentDirection).
 */
export function applyDocumentLanguage(language: Language): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = LOCALES[language]
}

/**
 * Applies direction to the document for the active locale. The server layouts
 * already render the right `dir`, and the pre-paint script sets it before
 * paint; this re-applies it on a client-side route or language change (a soft
 * navigation cannot re-run the pre-paint script), exactly as
 * applyDocumentDirection did under react-router.
 */
export function applyDocumentDirection(language: Language): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = directionFor(language)
}

/** Persists the choice (browser-only) - call after a successful switch. */
export function persistLanguageChoice(language: Language): void {
  persistLanguage(language)
}

/** hreflang/alternate URL for the other locale of the same page. */
export function localePath(path: string, language: Language): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (language === DEFAULT_LANGUAGE) return clean === '/' ? '/' : clean
  return `/en${clean === '/' ? '' : clean}`
}
