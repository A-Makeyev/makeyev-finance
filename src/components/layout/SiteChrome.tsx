'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IndexesBar, useCbsFeeds, useCpiCalculatorSync } from './IndexesBar'
import { MarketTracker } from './MarketTracker'
import { Navbar } from './Navbar'
import { OfflineBanner } from './OfflineBanner'
import { Footer } from './Footer'
import { usePathname } from '@/router'
import { applyDocumentDirection, type Language } from '@/i18n'

/**
 * The fixed chrome every page sits under: CBS Indexes strip, Markets strip,
 * Navbar, offline banner. Ported from SiteLayout.tsx once the calculator and
 * its stores migrated (phase 2); the strips now render live data exactly as
 * they did under react-router.
 *
 * Direction follows the locale: the Hebrew segment renders RTL and /en LTR
 * (see applyDocumentDirection, which re-applies it after a soft navigation).
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const pathname = usePathname()
  const feeds = useCbsFeeds()
  useCpiCalculatorSync(feeds.cpiPayload)
  const [menuOpen, setMenuOpen] = useState(false)

  // Hydration signal: set once React has attached to the server HTML, so e2e
  // can wait for interactivity instead of racing a pre-hydration paint on a
  // controlled input (the SSR HTML is visible before the bundle runs).
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
  }, [])

  // Document direction follows the locale; re-runs on navigation (a soft
  // navigation between the two locale segments cannot re-run the pre-paint
  // script) and on a language switch.
  useEffect(() => {
    const language: Language = i18n.language.startsWith('he') ? 'hebrew' : 'english'
    applyDocumentDirection(language)
  }, [pathname, i18n.language])

  // Legacy parity: sub-page URLs are page-scoped, so every navigation starts
  // at the top. This one re-runs on language switch too.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname, i18n.language])

  // The Indexes bar holds its slot while its feeds are in flight (skeleton
  // bars) and only disappears when every feed has failed. Everything that
  // offsets against it - the Markets strip's top slot and the navbar's
  // top/margin - must read the same condition, or the strips shift once the
  // numbers land.
  const indexesPresent = feeds.anySuccess || feeds.anyPending

  // The auth screen is a self-contained sign-in surface with nothing to scroll
  // past, so it drops the footer (user-requested): it is the one route with no
  // page content underneath the card.
  // usePathname() reports the locale-stripped path, so "/en/login" arrives
  // here as "/login"; testing for the prefixed form could never match.
  const isAuthSurface = pathname === '/login'

  return (
    <>
      <IndexesBar feeds={feeds} hidden={menuOpen} />
      {/* The Markets strip always renders and always keeps its height: skeleton
          bars while the first snapshot loads, rows once it lands. When the
          Indexes strip is absent it moves to the top slot. */}
      <MarketTracker hidden={menuOpen} atTop={!indexesPresent} />
      <Navbar
        indexesVisible={indexesPresent}
        marketsVisible
        indexesMissing={!indexesPresent}
        onMenuChange={setMenuOpen}
      />
      <OfflineBanner />
      <main>{children}</main>
      {!isAuthSurface && <Footer />}
    </>
  )
}
