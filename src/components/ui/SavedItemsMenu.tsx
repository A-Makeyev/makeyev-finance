'use client'

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingIndicator } from '@/components/ui/LoadingIndicator'
import { AppModal } from '@/components/ui/AppModal'
import { Link } from '@/router'

/**
 * The "my saved ..." dropdown shared by the compare and refinance pages. It is
 * deliberately the same shape as the calculator's saved-mix menu (see
 * SavedMixMenu): a hover/click trigger with the running count, a fixed panel
 * that stays inside the viewport, and a link to the profile's list.
 *
 * The owning page decides what choosing an item does, and whether unsaved work
 * has to be confirmed first. That keeps the page's own dirty rule authoritative
 * instead of this component guessing at another store.
 */

export interface SavedItem {
  id: string
  label: string
}

interface SavedItemsMenuProps<T extends SavedItem> {
  items: T[]
  count: number
  max: number
  isPending: boolean
  isError: boolean
  triggerLabel: string
  triggerClassName: string
  triggerTestId: string
  menuTestId: string
  itemTestId: (id: string) => string
  manageHref: string
  manageLabel: string
  manageTestId: string
  loadingLabel: string
  errorLabel: string
  emptyLabel?: string
  onSelect: (item: T) => void
  /** True when choosing another item would discard unsaved work. */
  shouldConfirm?: () => boolean
  confirmTitle?: string
  confirmBody?: string
  confirmAction?: string
  confirmTestId?: string
  renderSaveAction?: (onSaved: () => void, onPendingChange: (pending: boolean) => void) => ReactNode
}

export function SavedItemsMenu<T extends SavedItem>({
  items,
  count,
  max,
  isPending,
  isError,
  triggerLabel,
  triggerClassName,
  triggerTestId,
  menuTestId,
  itemTestId,
  manageHref,
  manageLabel,
  manageTestId,
  loadingLabel,
  errorLabel,
  emptyLabel,
  onSelect,
  shouldConfirm,
  confirmTitle,
  confirmBody,
  confirmAction,
  confirmTestId = 'saved-item-load-confirm',
  renderSaveAction,
}: SavedItemsMenuProps<T>) {
  const { t, i18n } = useTranslation()
  const menuRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingItem, setPendingItem] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null)
      return
    }

    function updatePosition() {
      const trigger = triggerRef.current
      const panel = panelRef.current
      if (!trigger || !panel) return

      const triggerBox = trigger.getBoundingClientRect()
      const panelBox = panel.getBoundingClientRect()
      const edge = 12
      const left = Math.max(
        edge,
        Math.min(triggerBox.left, window.innerWidth - panelBox.width - edge),
      )
      const below = triggerBox.bottom + 8
      const top =
        below + panelBox.height <= window.innerHeight - edge
          ? below
          : Math.max(edge, triggerBox.top - panelBox.height - 8)
      setMenuPosition((current) =>
        current?.top === top && current.left === left ? current : { top, left },
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isError, isPending, menuOpen, items.length])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    },
    [],
  )

  function openMenu() {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    setMenuOpen(true)
  }

  function scheduleMenuClose() {
    if (menuRef.current?.contains(document.activeElement)) return
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      if (menuRef.current?.matches(':hover') || panelRef.current?.matches(':hover')) return
      if (menuRef.current?.contains(document.activeElement)) return
      setMenuOpen(false)
    }, 450)
  }

  function choose(item: T) {
    setMenuOpen(false)
    if (shouldConfirm?.()) {
      setPendingItem(item)
      return
    }
    onSelect(item)
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setMenuOpen(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    setMenuOpen(false)
    setPendingItem(null)
    triggerRef.current?.focus()
  }

  return (
    <>
      <div
        ref={menuRef}
        className="my-mixes-menu-wrap"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleMenuClose}
        onFocus={openMenu}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        <button
          ref={triggerRef}
          type="button"
          data-testid={triggerTestId}
          className={triggerClassName}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-controls={menuTestId}
          onClick={openMenu}
        >
          {triggerLabel}
          <span> ({count}/{max})</span>
        </button>

        {menuOpen && (
          <div
            ref={panelRef}
            id={menuTestId}
            data-testid={menuTestId}
            className="my-mixes-menu"
            aria-label={triggerLabel}
            onMouseEnter={openMenu}
            onMouseLeave={scheduleMenuClose}
            style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : { visibility: 'hidden' }}
          >
            {isPending && (
              <LoadingIndicator className="my-mixes-menu-message w-full" label={loadingLabel} />
            )}
            {isError && (
              <p className="my-mixes-menu-message" role="alert">
                {errorLabel}
              </p>
            )}
            {!isPending && !isError && items.length === 0 && emptyLabel && (
              <p className="my-mixes-menu-message">{emptyLabel}</p>
            )}
            {items.length > 0 && (
              <ul className="my-mixes-menu-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={itemTestId(item.id)}
                      className="my-mixes-menu-item"
                      title={item.label}
                      onClick={() => choose(item)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to={manageHref}
              data-testid={manageTestId}
              className="my-mixes-menu-manage"
              onClick={() => setMenuOpen(false)}
            >
              {manageLabel}
            </Link>
          </div>
        )}
      </div>

      <AppModal
        open={pendingItem !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingItem(null)
        }}
        testId={confirmTestId}
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">{confirmTitle}</h3>
          <p className="text-[15px] leading-relaxed text-ink">{confirmBody}</p>
          <div className={`mt-6 modal-actions ${renderSaveAction ? 'flex-wrap' : 'modal-actions-reversed'}`}>
            <button
              type="button"
              data-testid={`${confirmTestId}-cancel`}
              disabled={saving}
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPendingItem(null)}
            >
              {t('savedMixes.cancel')}
            </button>
            <button
              type="button"
              data-testid={`${confirmTestId}-yes`}
              disabled={saving}
              className={renderSaveAction ? 'saved-item-load-action' : 'rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)]'}
              onClick={() => {
                if (!pendingItem) return
                const item = pendingItem
                setPendingItem(null)
                onSelect(item)
              }}
            >
              {confirmAction}
            </button>
            {pendingItem && renderSaveAction?.(() => {
              const item = pendingItem
              setPendingItem(null)
              setSaving(false)
              onSelect(item)
            }, setSaving)}
          </div>
        </div>
      </AppModal>
    </>
  )
}
