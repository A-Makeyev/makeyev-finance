import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'
import { applyDocumentDirection } from '@/i18n'
import { useCbsFeeds, IndexesBar, useCpiCalculatorSync } from './IndexesBar'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { OfflineBanner } from './OfflineBanner'

/** Scrolls to top on route change (MPA parity: every navigation started at the top). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export function SiteLayout() {
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  const feeds = useCbsFeeds()
  useCpiCalculatorSync(feeds.cpiPayload)
  const [menuOpen, setMenuOpen] = useState(false)

  // Direction: RTL on the Hebrew calculator page, LTR everywhere in
  // English (and on non-calculator pages). Re-runs on route AND language
  // change so the calculator flips when the user switches languages.
  useEffect(() => {
    applyDocumentDirection(pathname)
  }, [pathname, i18n.language])

  return (
    <>
      <ScrollToTop />
      <IndexesBar feeds={feeds} hidden={menuOpen} />
      <Navbar indexesVisible={feeds.anySuccess} onMenuChange={setMenuOpen} />
      <OfflineBanner />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
