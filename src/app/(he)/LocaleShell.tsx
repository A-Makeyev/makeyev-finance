'use client'

import type { ReactNode } from 'react'
import { LocaleContextProvider } from '@/router'
import { LocaleI18nProvider } from '@/components/providers/LocaleI18nProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { SiteChrome } from '@/components/layout/SiteChrome'
import { QuestionWishlistPill } from '@/components/wishlist/QuestionWishlistPill'
import { QuestionWishlistToast } from '@/components/wishlist/QuestionWishlistToast'

/**
 * The client boundary for the DEFAULT (Hebrew) locale segment: locale
 * context (for the router adapters), per-locale i18n instance, the fixed
 * chrome, and the global wishlist overlays.
 */
export function LocaleShell({ children }: { children: ReactNode }) {
  return (
    <LocaleContextProvider segment="he">
      <LocaleI18nProvider locale="hebrew">
        <QueryProvider>
          <SiteChrome>
            {children}
          </SiteChrome>
          <QuestionWishlistPill />
          <QuestionWishlistToast />
        </QueryProvider>
      </LocaleI18nProvider>
    </LocaleContextProvider>
  )
}
