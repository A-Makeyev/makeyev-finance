'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NextLink from 'next/link'
import {
  FaMoon,
  FaPhoneAlt,
  FaRegEnvelope,
  FaRegUser,
  FaSignOutAlt,
  FaSun,
  FaWaze,
  FaWhatsapp,
} from 'react-icons/fa'
import { socialLinks } from '@/config/siteConfig'
import { cn } from '@/lib/cn'
import { initialsFor } from '@/lib/avatar'
import { useMediaQuery, useScrolled } from '@/hooks/useScrolled'
import { useTheme } from '@/hooks/useTheme'
import { Link, usePathname, useRouter } from '@/router'
import { authClient } from '@/lib/auth-client'
import { HOVER_CLOSE_DELAY_MS } from '@/lib/timings'

const NAV_ITEMS = [
  { to: '/', key: 'nav.home', id: 'home' },
  { to: '/services', key: 'nav.services', id: 'services' },
  { to: '/calculators', key: 'nav.calculators', id: 'calculators' },
  { to: '/articles', key: 'nav.articles', id: 'articles' },
  { to: '/contact', key: 'nav.contact', id: 'contact' },
] as const

const SOCIAL_ICONS = [
  { key: 'phone', Icon: FaPhoneAlt },
  { key: 'whatsapp', Icon: FaWhatsapp },
  { key: 'waze', Icon: FaWaze },
  { key: 'envelope', Icon: FaRegEnvelope },
] as const

interface NavbarProps {
  indexesVisible?: boolean
  /** True when the Markets strip is rendered below the Indexes strip. */
  marketsVisible?: boolean
  /** True when the Indexes strip is absent (Markets strip sits at top). */
  indexesMissing?: boolean
  onMenuChange?: (open: boolean) => void
}

export function Navbar({
  indexesVisible = false,
  marketsVisible = false,
  indexesMissing = false,
  onMenuChange,
}: NavbarProps) {
  const { t, i18n } = useTranslation()
  const { isDark, toggle: toggleTheme } = useTheme()
  // isPending: the session lookup is still in flight (no way to know yet).
  // data: null while signed out, the { user, session } pair once signed in.
  // The avatar/menu render only after the lookup lands, so a signed-in
  // visitor never flashes the sign-in icon.
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const pathname = usePathname()
  const router = useRouter()
  const scrolled = useScrolled()
  const isDesktop770 = useMediaQuery('(min-width: 770px)')
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuChecked, setMenuChecked] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement | null>(null)
  const accountCloseTimer = useRef<number | null>(null)

  const solid = scrolled || menuOpen
  // The bar is now ONE frosted glass treatment at every scroll position and on
  // every page (user-requested: no per-page colour change), so the link / line
  // colours follow the THEME and not the scroll: --ink, which is near-black in
  // light and near-white in dark, stays legible on both tinted slabs. Applying
  // this unconditionally is what lets nav#navbar paint one theme-tinted glass
  // everywhere instead of the old dark top-state tint that only worked over a
  // dark hero banner.
  const linksDark = true
  const linesDark = true

  // Legacy stop-scrolling body lock while the panel is open.
  useEffect(() => {
    document.body.classList.toggle('stop-scrolling', menuOpen)
    return () => document.body.classList.remove('stop-scrolling')
  }, [menuOpen])

  /** Legacy close sequence: slide out immediately, then drop the nav back to
      its place once the panel has cleared (~280ms). */
  const closeMenu = useCallback(() => {
    setMenuChecked(false)
    window.setTimeout(() => setMenuOpen(false), 280)
  }, [])

  // Notify parent of the menu's VISUAL state (for hiding indexes bar on
  // mobile). `menuChecked` flips immediately on both open and close, unlike
  // `menuOpen` which lags 500ms behind on close - so driving the indexes bar
  // from `menuChecked` keeps it animating in sync with the panel sliding
  // instead of waiting out that delay.
  useEffect(() => {
    onMenuChange?.(menuChecked)
  }, [menuChecked, onMenuChange])

  const toggleMenu = useCallback(() => {
    if (menuOpen) {
      document.body.classList.remove('stop-scrolling')
      closeMenu()
    } else {
      document.body.classList.add('stop-scrolling')
      setMenuOpen(true)
      setMenuChecked(true)
    }
  }, [menuOpen, closeMenu])

  // Legacy resize handler closes an open menu.
  useEffect(() => {
    const onResize = () => {
      if (menuOpen) toggleMenu()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [menuOpen, toggleMenu])

  const backToHeader = useCallback(() => {
    if (menuOpen) {
      closeMenu()
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [menuOpen, closeMenu])

  const onLogoClick = useCallback(() => {
    if (menuOpen) {
      closeMenu()
      return
    }
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Legacy logo carried href="/" on sub-pages. The router adapter sends
      // it to the current locale's home.
      router.push('/')
    }
  }, [menuOpen, closeMenu, pathname, router])

  /**
   * Language switch, locale-routing edition: instead of mutating a global
   * i18n instance (the Vite app), it navigates to the same page under the
   * other locale's segment. `site_language` is persisted on the way out so
   * the visit's choice sticks for next time. The raw href is computed here
   * (not via the Link adapter) because it deliberately targets the OTHER
   * locale.
   */
  const isHebrew = i18n.language.startsWith('he')
  const languageSwitchHref = isHebrew ? `/en${pathname === '/' ? '' : pathname}` : pathname

  const cancelAccountClose = useCallback(() => {
    if (accountCloseTimer.current !== null) {
      window.clearTimeout(accountCloseTimer.current)
      accountCloseTimer.current = null
    }
  }, [])

  /**
   * Hover-out closes the menu again. Deferred by the app's hover grace so the
   * pointer can cross the 8px gap between the trigger and the panel - every
   * re-entry (back onto the avatar or onto the menu, which is inside the same
   * wrapper) cancels the pending close.
   */
  const scheduleAccountClose = useCallback(() => {
    if (accountCloseTimer.current !== null) return
    accountCloseTimer.current = window.setTimeout(() => {
      accountCloseTimer.current = null
      setAccountMenuOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }, [])

  // Drop any pending hover-close on unmount.
  useEffect(() => cancelAccountClose, [cancelAccountClose])

  // Close the account menu on any outside click, Escape, or route change.
  useEffect(() => {
    if (!accountMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        cancelAccountClose()
        setAccountMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelAccountClose()
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountMenuOpen, cancelAccountClose])

  useEffect(() => {
    setAccountMenuOpen(false)
  }, [pathname])

  const user = session?.user ?? null
  const avatarUrl = user?.image ?? null
  // Name initials for the fallback avatar (e.g. "נ" or "AB"). A name made
  // only of whitespace falls back to the empty-avatar glyph. Shared with the
  // profile header via lib/avatar so the two surfaces cannot drift.
  const initials = initialsFor(user?.name)

  const onSignOut = useCallback(async () => {
    setAccountMenuOpen(false)
    if (menuOpen) closeMenu()
    await authClient.signOut()
    // Signed-out lands on the home page (per spec); the strips and session
    // state re-render from the fresh route.
    router.push('/')
  }, [menuOpen, closeMenu, router])

  return (
    <nav
      id="navbar"
      data-testid="navbar"
      data-menu-open={menuOpen ? 'true' : 'false'}
      className={cn(
        'transition-colors duration-500',
        solid && 'navbar-scrolling',
        // While the sheet is on screen the bar must shed its backdrop-filter:
        // it would otherwise become the containing block for the fixed sheet
        // and collapse it (see nav#navbar.menu-open in globals.css).
        menuOpen && 'menu-open',
        solid && isDesktop770 && 'nav-scrolling-resize',
        indexesVisible && !menuOpen && 'adjust-nav',
        marketsVisible && !menuOpen && 'adjust-markets',
        marketsVisible && !menuOpen && indexesMissing && 'no-indexes',
        linksDark && 'links-dark',
        linesDark && 'lines-dark',
      )}
    >
      <input
        id="nav-toggle"
        type="checkbox"
        checked={menuChecked}
        onChange={(event) => {
          if (event.target.checked !== menuChecked) toggleMenu()
        }}
      />

      <div className="logo flex justify-start">
        <Link
          to="/"
          id="logo-image"
          data-testid="logo"
          aria-label={t('nav.home')}
          className={cn(
            'remove-highlight flex cursor-pointer items-center justify-start border-none bg-transparent p-0 transition-all duration-1000',
          )}
          onClick={onLogoClick}
        >
          {/* BOTH logos render and CSS shows the right one (see
              nav#navbar .logo-light / .logo-dark in globals.css), instead of
              picking `src` from the theme in JS.

              Picking src from useTheme() was SSR-unsafe: the theme lives in
              localStorage, so the server has no idea which one is active and
              always rendered Logo.png. On a hard load in dark mode React then
              logged a hydration mismatch and - per its own rule - refused to
              patch the attribute, leaving the DARK logo on the dark glass
              (invisible). A CSS-only swap cannot mismatch, because
              data-theme is already on <html> by the pre-paint script before
              first paint. */}
          <img
            src="/images/Logo.png"
            alt=""
            data-testid="logo-solid"
            className="logo-dark block w-full h-auto max-h-[75px] object-contain transition-all duration-1000"
          />
          <img
            src="/images/Logo-T.png"
            alt=""
            data-testid="logo-transparent"
            className="logo-light block w-full h-auto max-h-[75px] object-contain transition-all duration-1000"
          />
        </Link>
      </div>

      {/* Centred content: nav links + social icons. The account control is a
          sibling OUTSIDE this group, pinned to the bar's right edge (see
          .nav-bar-controls in globals.css). */}
      <div className="nav-center flex-col md:flex-row md:items-center md:justify-start">
        <ul id="nav-list" data-testid={menuChecked ? 'mobile-nav-panel-open' : 'mobile-nav-panel'} className="nav-content w-full flex-col md:flex-row md:items-center md:justify-start gap-4 md:gap-6">
          {NAV_ITEMS.map((item) => renderNavItem(item))}
          <div className="nav-icons-center w-full flex justify-center md:w-auto md:justify-start">
            <SocialIconsRow />
          </div>
        </ul>

        {/* The account control: pinned to the RIGHT edge of the bar at every
          width (below 1200px the hamburger owns the left and the logo stays
          centred). Kept out of #nav-list so it stays on the bar while the
          sheet, now links + socials only, slides down behind it. The language
          switch used to sit here too; it is now a row in the account menu. */}
        <ul className="nav-bar-controls" data-testid="nav-bar-controls">
          {/* Account control. While the session is being looked up a muted
                skeleton circle holds the trigger's slot (the slot used to sit
                empty, so the row jumped when the icon appeared; the skeleton
                wears the same colour as the nav links). Both session states
                render the same circular trigger and menu: signed in it holds
                the photo/initials avatar and the identity + profile + sign-out
                items; signed out it holds the person-glyph circle and the
                sign-in entry. The color mode row sits in the menu in both
                states, so the menu is now the only theme toggle. */}
          <li>
            {sessionPending ? (
              <span
                className="nav-auth-pending"
                aria-hidden="true"
                data-testid="nav-auth-pending"
              >
                <span className="nav-auth-skeleton" />
              </span>
            ) : (
              <div
                className="nav-account"
                ref={accountRef}
                data-testid="nav-account"
                onPointerEnter={cancelAccountClose}
                onPointerLeave={(event) => {
                  // Touch fires pointerleave right after the tap, which
                  // would close the menu the tap just opened - only the
                  // mouse hover-out closes it here.
                  if (event.pointerType !== 'touch') scheduleAccountClose()
                }}
                onBlur={(event) => {
                  // Close once focus leaves the whole control (trigger +
                  // menu). This is the keyboard half of what the old CSS
                  // :focus-within rule did, and its removal is what lets a
                  // CLICKED-open menu disappear on hover-out: the click
                  // focuses the trigger, and a lingering focus-within kept
                  // the menu painted after the pointer had left.
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    cancelAccountClose()
                    setAccountMenuOpen(false)
                  }
                }}
              >
                <button
                  type="button"
                  data-testid="nav-avatar"
                  className="nav-link remove-highlight flex items-center"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  // No native title here: hovering the trigger opens the
                  // account menu, whose identity line already names the
                  // user, so a tooltip would only overlap it.
                  aria-label={user ? user.name || t('auth.account') : t('auth.account')}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  onPointerEnter={(event) => {
                    // Hover peek is a MOUSE gesture. On touch the browser
                    // fires compatibility mouse events just before the
                    // tap's click, which would open the menu and let the
                    // click immediately toggle it shut - so a tap could
                    // never open it. Touch opens on click instead.
                    if (event.pointerType !== 'touch') setAccountMenuOpen(true)
                  }}
                  onFocus={(event) => {
                    // Keyboard only, like HelpTooltip: a tap also focuses
                    // this button, and opening here would hand the tap's
                    // click a close to perform.
                    if (event.currentTarget.matches(':focus-visible')) {
                      setAccountMenuOpen(true)
                    }
                  }}
                >
                  {user && avatarUrl ? (
                    // Google profile photo, when the provider returned
                    // one. referrerPolicy="no-referrer"
                    // keeps the auth header out of Google's request.
                    <img
                      src={avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="nav-avatar-img"
                      data-testid="nav-avatar-img"
                    />
                  ) : user && initials ? (
                    <span className="nav-avatar-img nav-avatar-fallback" aria-hidden="true">
                      {initials}
                    </span>
                  ) : (
                    // Signed out (or no photo and no initials): the person
                    // glyph in the same circle, so the trigger reads
                    // identically in both session states.
                    <span
                      className="nav-avatar-img nav-avatar-empty"
                      aria-hidden="true"
                      data-testid="nav-avatar-empty"
                    >
                      <FaRegUser />
                    </span>
                  )}
                </button>
                <div
                  className={cn('nav-account-menu', accountMenuOpen && 'open')}
                  data-testid="nav-account-menu"
                  role="menu"
                  aria-label={t('auth.account')}
                  aria-hidden={!accountMenuOpen}
                  // The bar is deliberately LTR on every locale, but the
                  // menu is content: it follows the page direction, so the
                  // Hebrew menu reads right-to-left with each row's icon
                  // before its text.
                  dir={i18n.dir()}
                >
                  {/* Identity first: the account's own name sits at the top
                        of the menu, above the site preferences and the
                        actions, so the menu reads as "who am I" and then what
                        I can do here. */}
                  {user && (
                    <div className="nav-account-id" data-testid="nav-account-id" dir="auto">
                      {user.name || user.email}
                    </div>
                  )}
                  {/* Preferences block (both session states): the language
                        switch, then the color-mode toggle. Both render the
                        same icon-then-label row, so the two "site settings"
                        read as one group. */}
                  <div className="nav-account-prefs">
                    {/* Language switch. It targets the OTHER locale, so it
                          carries the raw href (computed above) rather than
                          going through the locale-aware Link adapter, and it
                          persists the choice on the way out. */}
                    <NextLink
                      href={languageSwitchHref}
                      role="menuitem"
                      className="nav-account-item nav-account-lang"
                      data-testid="nav-account-language"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        if (menuOpen) closeMenu()
                        try {
                          localStorage.setItem('site_language', isHebrew ? 'english' : 'hebrew')
                        } catch {
                          // Storage unavailable - the choice applies to this visit.
                        }
                      }}
                    >
                      <img
                        aria-hidden="true"
                        src={isHebrew ? 'https://flagcdn.com/w40/us.png' : 'https://flagcdn.com/w40/il.png'}
                        alt=""
                        width={24}
                        height={16}
                        className="nav-account-flag"
                        loading="eager"
                      />
                      <span>{t('nav.switchLanguage')}</span>
                    </NextLink>
                    <button
                      type="button"
                      role="menuitem"
                      className="nav-account-item nav-account-theme"
                      data-testid="nav-account-theme"
                      onClick={toggleTheme}
                    >
                      {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
                      <span>{t(isDark ? 'nav.lightMode' : 'nav.darkMode')}</span>
                    </button>
                  </div>
                  {user ? (
                    <>
                      <Link
                        to="/profile"
                        role="menuitem"
                        className="nav-account-item"
                        data-testid="nav-account-profile"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <FaRegUser aria-hidden="true" />
                        <span>{t('auth.profileItem')}</span>
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="nav-account-item"
                        data-testid="nav-account-signout"
                        onClick={onSignOut}
                      >
                        <FaSignOutAlt aria-hidden="true" />
                        <span>{t('auth.signOut')}</span>
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      role="menuitem"
                      className="nav-account-item"
                      data-testid="nav-account-signin"
                      onClick={() => {
                        if (menuOpen) closeMenu()
                        setAccountMenuOpen(false)
                      }}
                    >
                      <FaRegUser aria-hidden="true" />
                      <span>{t('auth.loginLink')}</span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </li>
        </ul>
      </div>

      <label htmlFor="nav-toggle" className="menu-icon remove-highlight" id="menu" data-testid="hamburger">
        <div className="line" />
        <div className="line" />
        <div className="line" />
      </label>
    </nav>
  )

  function renderNavItem(item: (typeof NAV_ITEMS)[number]) {
    const isActive = pathname === item.to
    if (isActive) {
      return (
        <li key={item.to}>
          <a
            id={item.id}
            data-testid={`nav-link-${item.id}`}
            className="nav-link remove-highlight"
            href="javascript:void(0);"
            onClick={backToHeader}
          >
            {t(item.key)}
          </a>
        </li>
      )
    }
    return (
      <li key={item.to}>
        <Link
          id={item.id}
          to={item.to}
          data-testid={`nav-link-${item.id}`}
          className="nav-link remove-highlight"
          onClick={() => {
            if (menuOpen) closeMenu()
          }}
        >
          {t(item.key)}
        </Link>
      </li>
    )
  }

  function SocialIconsRow() {
    const links = socialLinks('hebrew')
    return (
      <>
        {SOCIAL_ICONS.map(({ key, Icon }) => {
          const link = links[key]
          return (
            <li key={key}>
              <a
                className="nav-link icon remove-highlight"
                href={link}
                target="_blank"
                rel="noreferrer"
                data-testid={`nav-social-${key}`}
              >
                <Icon aria-hidden="true" />
              </a>
            </li>
          )
        })}
      </>
    )
  }
}
