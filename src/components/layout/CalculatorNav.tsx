'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCalculator, FaChevronDown, FaExchangeAlt, FaSyncAlt } from 'react-icons/fa'
import { Link, usePathname } from '@/router'
import { HOVER_CLOSE_DELAY_MS } from '@/lib/timings'
import { requestRefinanceSeed } from '@/features/refinance/pendingSeed'

const ITEMS = [
  { to: '/calculators', key: 'nav.calculators', id: 'calculator', Icon: FaCalculator },
  { to: '/compare', key: 'compare.openFromCalculator', id: 'compare', Icon: FaExchangeAlt },
  { to: '/refinance', key: 'refinance.openLink', id: 'refinance', Icon: FaSyncAlt },
] as const

/**
 * The calculators item is a disclosure, not a link with a separate arrow:
 * the whole label opens the menu on click/tap, so touch users never have to
 * hit a small chevron. Hover is a desktop-only shortcut (pointerType gate);
 * it is never the only way in. The landing page is the first row of the menu.
 */
export function CalculatorNav({ onNavigate }: { onNavigate: () => void }) {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLLIElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A hover-opened menu closes on hover-out; a clicked/keyboard-opened one is
  // PINNED and waits for an outside click, Escape, or focus leaving. Using a
  // ref (not the `open` state) keeps the decision correct when a pointerenter
  // and the click land in the same React batch, and on narrow screens where
  // the inline accordion shifts the layout and fires pointerleave right after
  // the click that opened it.
  const pinned = useRef(false)

  function cancelClose() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => {
    setOpen(false)
    pinned.current = false
    cancelClose()
  }, [pathname])
  useEffect(() => cancelClose, [])
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        pinned.current = false
        setOpen(false)
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      cancelClose()
      pinned.current = false
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
        if (event.pointerType === 'mouse' && !pinned.current) setOpen(true)
      }}
      onPointerLeave={event => {
        if (event.pointerType !== 'mouse' || pinned.current) return
        cancelClose()
        timer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS)
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          pinned.current = false
          setOpen(false)
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          cancelClose()
          pinned.current = false
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <button ref={trigger} type="button" id="calculators"
        data-testid="nav-calculators-toggle"
        className="nav-link remove-highlight nav-calculators-trigger"
        aria-expanded={open} aria-controls="nav-calculators-menu"
        onClick={() => {
          cancelClose()
          if (pinned.current) {
            pinned.current = false
            setOpen(false)
          } else {
            pinned.current = true
            setOpen(true)
          }
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            pinned.current = true
            setOpen(true)
            requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('#nav-calculators-menu a')?.focus())
          }
        }}>
        <span className="nav-calculators-label">
          {t('nav.tools')}
          <FaChevronDown className="nav-calculators-chevron" aria-hidden="true" />
        </span>
      </button>
      <div id="nav-calculators-menu" data-testid="nav-calculators-menu"
        className={`nav-account-menu nav-calculators-menu${open ? ' open' : ''}`}
        inert={!open} aria-hidden={!open}>
        {ITEMS.map(({ to, key, id, Icon }) => (
          <Link key={id} to={to} className="nav-account-item" data-testid={`nav-tool-${id}`}
            aria-current={pathname === to ? 'page' : undefined}
            // Capture phase: the seed has to be requested before the Link's own
            // guard check can veto the navigation (the calculator's unsaved
            // dialog then decides, and confirming still lands on a seeded page).
            onClickCapture={() => {
              if (id === 'refinance' && pathname === '/calculators') requestRefinanceSeed()
            }}
            onClick={() => { pinned.current = false; setOpen(false); onNavigate() }}>
            <Icon aria-hidden="true" /><span>{t(key)}</span>
          </Link>
        ))}
      </div>
    </li>
  )
}
