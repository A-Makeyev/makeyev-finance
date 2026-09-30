'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { I18nextProvider } from 'react-i18next'
import {
  applyDocumentLanguage,
  createI18nInstance,
  DEFAULT_LANGUAGE,
  resolveStoredLanguage,
  type Language,
} from '@/i18n'

export interface LocaleI18nProviderProps {
  locale: Language
  children: ReactNode
}

/**
 * Wraps the locale segment's children in an I18nextProvider built for THAT
 * locale. Server and client build the same instance from the same resources,
 * so hydration matches; there is no module-global language state to disagree
 * about.
 *
 * Language switch: the navbar navigates to the same page under the other
 * /en prefix (locale-prefixed routing), and the provider here applies the
 * document lang/dir for the new locale. The stored `site_language` choice is
 * followed once on first mount only (a user who picked English reads English
 * on their next visit even though Hebrew is the default).
 */
export function LocaleI18nProvider({ locale, children }: LocaleI18nProviderProps) {
  // One instance per mounted locale; rebuilding on locale change would drop
  // translations for a frame - the remount from the route change is enough.
  const instanceRef = useRef<ReturnType<typeof createI18nInstance> | null>(null)
  if (instanceRef.current === null) {
    instanceRef.current = createI18nInstance(locale)
  }
  const instance = instanceRef.current
  // Memo guards the strict-mode double render; the ref keeps the instance.
  useMemo(() => instance, [instance])
  const router = useRouter()

  useEffect(() => {
    applyDocumentLanguage(locale)
  }, [locale])

  // Follow a previously persisted choice once per visit. Skipped when the
  // URL already speaks that language (the /en pages), so a link someone
  // shared always shows what it says. The SAME page is kept (legacy parity:
  // picking a language never dropped you back to the home page) - only the
  // /en prefix is added.
  useEffect(() => {
    if (locale !== DEFAULT_LANGUAGE) return
    const stored = resolveStoredLanguage()
    if (stored && stored !== locale) {
      const { pathname, search } = window.location
      const target = pathname === '/' ? '/en' : `/en${pathname}`
      // Soft navigation (not window.location.replace): it preserves the JS
      // context, so nothing samples the page mid-reload, and it avoids a full
      // document reload just to change locale.
      router.replace(`${target}${search}`)
    }
  }, [locale, router])

  // No dir on this wrapper: the document-level direction policy is set by
  // the root layouts (LTR in phase 1, see (he)/layout.tsx). Components that
  // need local RTL set their own (article bodies, offline banner).
  return (
    <div lang={locale === 'hebrew' ? 'he' : 'en'}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </div>
  )
}
