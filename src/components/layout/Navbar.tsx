import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import {
  FaFacebookSquare,
  FaPhoneAlt,
  FaRegEnvelope,
  FaWaze,
  FaWhatsapp,
} from 'react-icons/fa'
import { changeLanguage } from '@/i18n'
import { socialLinks } from '@/config/siteConfig'
import { cn } from '@/lib/cn'
import { useMediaQuery, useScrolled } from '@/hooks/useScrolled'

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
  { key: 'facebook', Icon: FaFacebookSquare },
] as const

interface NavbarProps {
  indexesVisible?: boolean
  onMenuChange?: (open: boolean) => void
}

export function Navbar({ indexesVisible = false, onMenuChange }: NavbarProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const scrolled = useScrolled()
  const isDesktop770 = useMediaQuery('(min-width: 770px)')
  const isMobileTop = useMediaQuery('(max-width: 800px)')
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuChecked, setMenuChecked] = useState(false)

  const solid = scrolled || menuOpen
  const linksDark = solid || isMobileTop
  const linesDark = solid

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
  // `menuOpen` which lags 500ms behind on close — so driving the indexes bar
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
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Legacy logo carried href="/" on sub-pages.
      window.location.assign('/')
    }
  }, [menuOpen, closeMenu, location.pathname])

  return (
    <nav
      id="navbar"
      data-testid="navbar"
      data-menu-open={menuOpen ? 'true' : 'false'}
      className={cn(
        'transition-colors duration-500',
        solid && 'navbar-scrolling',
        solid && isDesktop770 && 'nav-scrolling-resize',
        indexesVisible && !menuOpen && 'adjust-nav',
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
          <img
            src={solid ? '/images/Logo.png' : '/images/Logo-T.png'}
            alt=""
            data-testid={solid ? 'logo-solid' : 'logo-transparent'}
            className="block w-full h-auto max-h-[75px] object-contain transition-all duration-1000"
          />
        </Link>
      </div>

      {/* Centered content: nav links + social icons + language switch */}
      <div className="nav-center flex-col md:flex-row md:items-center md:justify-start md:ml-8">
        <ul id="nav-list" data-testid={menuChecked ? 'mobile-nav-panel-open' : 'mobile-nav-panel'} className="nav-content w-full flex-col md:flex-row md:items-center md:justify-start gap-4 md:gap-6">
          {NAV_ITEMS.map((item) => renderNavItem(item))}
          <div className="nav-icons-center w-full flex justify-center md:w-auto md:justify-start">
            <SocialIconsRow />
            {/* Language switch — flag only */}
            <li>
              <a
                href="javascript:void(0);"
                data-testid="language-switch"
                className="nav-link remove-highlight flex items-center"
                title={i18n.language.startsWith('he') ? 'Switch to English' : 'החלף לעברית'}
                aria-label={i18n.language.startsWith('he') ? 'Switch to English' : 'החלף לעברית'}
                onClick={(event) => {
                  event.preventDefault()
                  if (menuOpen) closeMenu()
                  void changeLanguage(i18n.language.startsWith('he') ? 'english' : 'hebrew')
                }}
              >
                <img
                  aria-hidden="true"
                  src={i18n.language.startsWith('he') ? 'https://flagcdn.com/w40/us.png' : 'https://flagcdn.com/w40/il.png'}
                  alt=""
                  width={24}
                  height={16}
                  className="block h-4 w-6 object-cover rounded-sm shadow-sm"
                  loading="eager"
                />
              </a>
            </li>
          </div>
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
    const isActive = location.pathname === item.to
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