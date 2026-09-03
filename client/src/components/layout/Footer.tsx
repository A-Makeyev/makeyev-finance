import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import {
  FaFacebookSquare,
  FaPhoneSquareAlt,
  FaRegEnvelope,
  FaWaze,
  FaWhatsapp,
} from 'react-icons/fa'
import { socialLinks } from '@/config/siteConfig'

const SOCIAL_ENTRIES = [
  { key: 'facebook', hoverClass: 'facebook-fill', Icon: FaFacebookSquare },
  { key: 'envelope', hoverClass: 'email-fill', Icon: FaRegEnvelope },
  { key: 'waze', hoverClass: 'waze-fill', Icon: FaWaze },
  { key: 'whatsapp', hoverClass: 'whatsapp-fill', Icon: FaWhatsapp },
  { key: 'phone', hoverClass: 'phone-fill', Icon: FaPhoneSquareAlt },
] as const

/** Legacy .socials row - footer (white) and modal (black) variants. */
export function SocialLinks({ variant = 'footer' }: { variant?: 'footer' | 'modal' }) {
  const links = socialLinks('hebrew')
  return (
    <div className="socials">
      {SOCIAL_ENTRIES.map(({ key, hoverClass, Icon }) => (
        <a
          key={key}
          className={`icon remove-highlight ${variant === 'modal' ? 'text-soft-black' : ''}`}
          href={links[key]}
          target="_blank"
          rel="noreferrer"
          data-testid={`social-${key}`}
        >
          <Icon aria-hidden="true" className={hoverClass} />
        </a>
      ))}
    </div>
  )
}

export function Footer() {
  const { t } = useTranslation()
  const location = useLocation()
  const year = new Date().getFullYear()

  // Legacy parity: calculators.html was the only legacy page whose footer
  // links swapped Services and Articles - every other page (and the navbar)
  // used Home · Services · Calculators · Articles · Contact.
  const standardNav = [
    { to: '/services', label: t('nav.services') },
    { to: '/calculators', label: t('nav.calculators') },
    { to: '/articles', label: t('nav.articles') },
  ]
  const footerNav = [
    { to: '/', label: t('nav.home') },
    ...(location.pathname === '/calculators'
      ? [
          { to: '/articles', label: t('nav.articles') },
          { to: '/calculators', label: t('nav.calculators') },
          { to: '/services', label: t('nav.services') },
        ]
      : standardNav),
    { to: '/contact', label: t('nav.contact') },
  ]

  // Pin the footer to LTR: the Hebrew calculators page flips the document to
  // RTL, which would mirror the links and social icons (ראשי would sit on the
  // right). The footer must read the same on every page, so keep it LTR -
  // Hebrew labels still render correctly inside an LTR flow.
  return (
    <footer className="footer" dir="ltr">
      <div style={{ marginBottom: '-15px' }}>
        <div id="trademark">
          <span>{t('footer.trademark', { year })}</span>
        </div>
        <div className="footer-links">
          {footerNav.map((item, index) => (
            <FragmentWithSeparator
              key={item.to}
              showSeparator={index > 0}
              separator={
                <span aria-hidden="true">&#183;</span>
              }
            >
              {location.pathname === item.to ? (
                <a
                  className="footer-link remove-highlight"
                  href="javascript:void(0);"
                  data-testid={`footer-link-${item.to === '/' ? 'home' : item.to.slice(1)}`}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  className="footer-link remove-highlight"
                  to={item.to}
                  data-testid={`footer-link-${item.to === '/' ? 'home' : item.to.slice(1)}`}
                >
                  {item.label}
                </Link>
              )}
            </FragmentWithSeparator>
          ))}
        </div>
      </div>

      <SocialLinks />
    </footer>
  )
}

function FragmentWithSeparator({
  showSeparator,
  separator,
  children,
}: {
  showSeparator: boolean
  separator: ReactNode
  children: ReactNode
}) {
  return (
    <>
      {showSeparator && separator}
      <p>{children}</p>
    </>
  )
}
