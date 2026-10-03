import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { InlineScript } from '@/components/providers/InlineScript'
import {
  PRE_PAINT_DIRECTION_SCRIPT,
  PRE_PAINT_LANGUAGE_SCRIPT,
  PRE_PAINT_THEME_SCRIPT,
} from '@/theme/prePaint'
import { SITE } from '@/config/siteConfig'
import { en } from '@/i18n/en'
import '@/styles/globals.css'

/**
 * Root layout for the ENGLISH locale segment (/en/...). Mirrors the Hebrew
 * root layout with lang="en" dir="ltr" and English metadata defaults.
 * Russian (or any future locale) becomes another (locale) group the same way.
 */

export const metadata: Metadata = {
  title: {
    default: en.translation.meta.homeTitle,
    template: `%s | ${SITE.name}`,
  },
  description: en.translation.meta.homeDescription,
  icons: { icon: '/images/icon.ico' },
  alternates: {
    canonical: '/en',
    languages: { he: '/', en: '/en' },
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning covers ONLY this element's own attributes: the
    // pre-paint scripts below write data-theme/color-scheme (and dir) onto
    // <html> before React hydrates, which React would otherwise report as a
    // server/client attribute mismatch on every load. The children are not
    // suppressed, so a real mismatch inside the tree still surfaces.
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Lato:wght@100;300;400;700&display=swap"
        />
        <InlineScript script={PRE_PAINT_LANGUAGE_SCRIPT} />
        <InlineScript script={PRE_PAINT_THEME_SCRIPT} />
        <InlineScript script={PRE_PAINT_DIRECTION_SCRIPT} />
      </head>
      <body>{children}</body>
    </html>
  )
}
