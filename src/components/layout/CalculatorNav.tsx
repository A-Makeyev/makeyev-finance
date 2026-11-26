'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCalculator, FaChevronDown, FaExchangeAlt, FaSyncAlt } from 'react-icons/fa'
import { Link, usePathname } from '@/router'
import { HOVER_CLOSE_DELAY_MS } from '@/lib/timings'

const ITEMS = [
  { to: '/calculators', key: 'nav.calculators', id: 'calculator', Icon: FaCalculator },
  { to: '/compare', key: 'compare.openFromCalculator', id: 'compare', Icon: FaExchangeAlt },
  { to: '/refinance', key: 'refinance.openLink', id: 'refinance', Icon: FaSyncAlt },
] as const

export function CalculatorNav({ onNavigate }: { onNavigate: () => void }) {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLLIElement>(null)
  const trigger = useRef<HTMLAnchorElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelClose() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  function toggle() {
    cancelClose()
    setOpen(value => !value)
  }

  function openAndFocusFirst() {
    cancelClose()
    setOpen(true)
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLAnchorElement>('#nav-calculators-menu a')?.focus(),
    )
  }

  useEffect(() => {
    setOpen(false)
    cancelClose()
  }, [pathname])
  useEffect(() => cancelClose, [])
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      cancelClose()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <li ref={root} className="nav-calculators" dir={i18n.dir()}
      onPointerEnter={event => {
        cancelClose()
        if (event.pointerType === 'mouse') setOpen(true)
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'mouse') return
        cancelClose()
        timer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS)
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          cancelClose()
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      {/* The label itself is the disclosure: one box, same nav-link styling as
          the other items, with the chevron on the label's text line, so it
          cannot sit off their baseline. A <button> role rather than a link,
          because activating it opens the menu; the calculator page is the
          menu's first item. */}
      <a ref={trigger} id="calculators" role="button" tabIndex={0}
        data-testid="nav-link-calculators"
        className="nav-link nav-calculators-trigger remove-highlight"
        aria-haspopup="menu" aria-expanded={open} aria-controls="nav-calculators-menu"
        onClick={toggle}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggle()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            openAndFocusFirst()
          }
        }}>
        {t('nav.tools')}
        <FaChevronDown aria-hidden="true" className="nav-calculators-chevron" />
      </a>
      <div id="nav-calculators-menu" data-testid="nav-calculators-menu"
        className={`nav-account-menu nav-calculators-menu${open ? ' open' : ''}`}
        role="menu" inert={!open} aria-hidden={!open}>
        {ITEMS.map(({ to, key, id, Icon }) => (
          <Link key={id} to={to} role="menuitem" className="nav-account-item" data-testid={`nav-tool-${id}`}
            aria-current={pathname === to ? 'page' : undefined}
            onClick={() => { setOpen(false); onNavigate() }}>
            <Icon aria-hidden="true" /><span>{t(key)}</span>
          </Link>
        ))}
      </div>
    </li>
  )
}
