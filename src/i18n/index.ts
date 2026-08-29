import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { he } from './he'
import { en } from './en'

export type Language = 'hebrew' | 'english'

export const LOCALES: Record<Language, string> = {
  hebrew: 'he',
  english: 'en',
}

export const DEFAULT_LANGUAGE: Language = 'hebrew'

void i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he.translation },
    en: { translation: en.translation },
  },
  lng: LOCALES[DEFAULT_LANGUAGE],
  fallbackLng: LOCALES[DEFAULT_LANGUAGE],
  interpolation: {
    // React already escapes; i18next should not double-escape.
    escapeValue: false,
  },
  returnNull: false,
})

/**
 * Direction follows the language on the calculator page: Hebrew keeps the
 * legacy calculators.html RTL layout, English is LTR everywhere (so all
 * text/fields read left-to-right). Other pages are always LTR.
 */
export function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = LOCALES[language]
}

function isHebrew(language: Language): boolean {
  return language === 'hebrew'
}

export function applyDocumentDirection(pathname: string): void {
  const language: Language = i18n.language.startsWith('he') ? 'hebrew' : 'english'
  // Arabic/Hebrew calculator stays RTL; English is LTR so all text and
  // controls read left-to-right.
  const rtl = pathname.startsWith('/calculators') && isHebrew(language)
  document.documentElement.dir = rtl ? 'rtl' : 'ltr'
}

export async function changeLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(LOCALES[language])
  applyDocumentLanguage(language)
}

applyDocumentLanguage(DEFAULT_LANGUAGE)
