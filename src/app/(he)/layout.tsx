import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { InlineScript } from '@/components/providers/InlineScript'
import {
  PRE_PAINT_DIRECTION_SCRIPT,
  PRE_PAINT_LANGUAGE_SCRIPT,
  PRE_PAINT_THEME_SCRIPT,
} from '@/theme/prePaint'
import { SITE } from '@/config/siteConfig'
import { he } from '@/i18n/he'
import '@/styles/globals.css'

/**
 * Root layout for the DEFAULT (Hebrew, unprefixed) locale segment.
 *
 * Next route groups give each locale its own root layout, so <html lang> and
 * <html dir> are rendered server-side per locale (Hebrew here, English under
 * /en). Hebrew is RTL: direction follows the locale, and every Hebrew page
 * mirrors, not just the calculator/compare routes as it used to. The pre-paint
 * theme script ships inline in <head> via InlineScript, exactly where
 * client/index.html had it, so a stored dark theme still paints dark before
 * React hydrates.
 *
 * The shared stylesheet was written for an LTR document and mostly reads
 * correctly mirrored (flex rows reverse, text follows the start edge), so only
 * genuinely physical rules needed fixing - see the logical-property notes in
 * globals.css. The CHROME is the exception, by request: the navbar, the
 * Indexes/Markets strips and the footer keep their LTR layout in Hebrew too,
 * so they look the same on every page.
 */

export const metadata: Metadata = {
  title: {
    default: he.translation.meta.homeTitle,
    template: `%s | ${SITE.name}`,
  },
  description: he.translation.meta.homeDescription,
  icons: { icon: '/images/icon.ico' },
  alternates: {
    canonical: '/',
    languages: { he: '/', en: '/en' },
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // dir="rtl": direction follows the locale (see src/i18n/index.ts), so the
    // Hebrew segment mirrors and /en stays LTR. The pre-paint direction script
    // below writes the same value before first paint, which is why this
    // element carries suppressHydrationWarning: it covers ONLY this element's
    // own attributes (data-theme/color-scheme/dir), since React would
    // otherwise report a server/client attribute mismatch on every load. The
    // children are not suppressed, so a real mismatch inside the tree still
    // surfaces.
    <html lang="he" dir="rtl" suppressHydrationWarning>
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
