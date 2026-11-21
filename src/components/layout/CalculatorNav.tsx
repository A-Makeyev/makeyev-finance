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
  const trigger = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelClose() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
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
      <div className="nav-calculators-heading">
        <Link to="/calculators" id="calculators" data-testid="nav-link-calculators"
          className="nav-link remove-highlight" onClick={onNavigate}>
          {t('nav.calculators')}
        </Link>
        <button ref={trigger} type="button" className="nav-calculators-toggle"
          data-testid="nav-calculators-toggle" aria-label={t('nav.calculators')}
          aria-expanded={open} aria-controls="nav-calculators-menu"
          onClick={() => { cancelClose(); setOpen(value => !value) }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('#nav-calculators-menu a')?.focus())
            }
          }}>
          <FaChevronDown aria-hidden="true" />
        </button>
      </div>
      <div id="nav-calculators-menu" data-testid="nav-calculators-menu"
        className={`nav-account-menu nav-calculators-menu${open ? ' open' : ''}`}
        inert={!open} aria-hidden={!open}>
        {ITEMS.map(({ to, key, id, Icon }) => (
          <Link key={id} to={to} className="nav-account-item" data-testid={`nav-tool-${id}`}
            aria-current={pathname === to ? 'page' : undefined}
            onClick={() => { setOpen(false); onNavigate() }}>
            <Icon aria-hidden="true" /><span>{t(key)}</span>
          </Link>
        ))}
      </div>
    </li>
  )
}
