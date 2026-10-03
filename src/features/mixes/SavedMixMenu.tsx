'use client'

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/ui/AppModal'
import { Link } from '@/router'
import { isMixDirty, useCalculatorStore } from '@/stores/calculatorStore'
import type { SavedMix } from './api'

interface SavedMixMenuProps {
    mixes: SavedMix[]
    count: number
    max: number
    isPending: boolean
    isError: boolean
}

export function SavedMixMenu({ mixes, count, max, isPending, isError }: SavedMixMenuProps) {
    const { t, i18n } = useTranslation()
    const menuRef = useRef<HTMLDivElement | null>(null)
    const panelRef = useRef<HTMLDivElement | null>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const closeTimerRef = useRef<number | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [pendingMix, setPendingMix] = useState<SavedMix | null>(null)
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
    }, [isError, isPending, menuOpen, mixes.length])

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

    function loadMix(mix: SavedMix) {
        useCalculatorStore
            .getState()
            .loadSavedMix(mix.tracks, mix.termYears, mix.scenario, mix.id, mix.label)
        setPendingMix(null)
        setMenuOpen(false)
        const url = new URL(window.location.href)
        url.searchParams.set('mix', mix.id)
        url.searchParams.delete('preset')
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }

    function selectMix(mix: SavedMix) {
        setMenuOpen(false)
        if (isMixDirty(useCalculatorStore.getState())) {
            setPendingMix(mix)
            return
        }
        loadMix(mix)
    }

    function handleBlur(event: FocusEvent<HTMLDivElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMenuOpen(false)
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Escape') return
        setMenuOpen(false)
        setPendingMix(null)
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
                    data-testid="my-mixes-menu-trigger"
                    className="calculate-button my-mixes-trigger"
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    aria-controls="saved-mixes-menu"
                    onClick={openMenu}
                >
                    {t('savedMixes.myMixesLink')}
                    <span data-testid="save-mix-count"> ({count}/{max})</span>
                </button>

                {menuOpen && (
                    <div
                        ref={panelRef}
                        id="saved-mixes-menu"
                        data-testid="saved-mixes-menu"
                        className="my-mixes-menu"
                        aria-label={t('savedMixes.myMixesLink')}
                        onMouseEnter={openMenu}
                        onMouseLeave={scheduleMenuClose}
                        style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : { visibility: 'hidden' }}
                    >
                        {isPending && (
                            <p className="my-mixes-menu-message" role="status">
                                {t('savedMixes.loading')}
                            </p>
                        )}
                        {isError && (
                            <p className="my-mixes-menu-message" role="alert">
                                {t('savedMixes.loadError')}
                            </p>
                        )}
                        {!isPending && !isError && mixes.length === 0 && (
                            <p className="my-mixes-menu-message">{t('savedMixes.noSavedMixes')}</p>
                        )}
                        {mixes.length > 0 && (
                            <ul className="my-mixes-menu-list">
                                {mixes.map((mix) => (
                                    <li key={mix.id}>
                                        <button
                                            type="button"
                                            data-testid={`saved-mix-menu-item-${mix.id}`}
                                            className="my-mixes-menu-item"
                                            title={mix.label}
                                            onClick={() => selectMix(mix)}
                                        >
                                            {mix.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Link
                            to="/profile#saved-mixes"
                            data-testid="my-mixes-link"
                            className="my-mixes-menu-manage"
                            onClick={() => setMenuOpen(false)}
                        >
                            {t('savedMixes.profileTitle')}
                        </Link>
                    </div>
                )}
            </div>

            <AppModal
                open={pendingMix !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingMix(null)
                }}
                testId="load-mix-confirm"
                dir={i18n.dir()}
                tone="teal"
                contentClassName="max-w-[420px]"
            >
                <div className="p-6">
                    <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
                        {t('savedMixes.loadOtherMixTitle')}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-ink">
                        {t('savedMixes.loadOtherMixBody')}
                    </p>
                    <div className="mt-6 modal-actions modal-actions-reversed">
                        <button
                            type="button"
                            data-testid="load-mix-cancel"
                            className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
                            onClick={() => setPendingMix(null)}
                        >
                            {t('savedMixes.cancel')}
                        </button>
                        <button
                            type="button"
                            data-testid="load-mix-confirm-yes"
                            className="rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)]"
                            onClick={() => pendingMix && loadMix(pendingMix)}
                        >
                            {t('savedMixes.loadOtherMixAction')}
                        </button>
                    </div>
                </div>
            </AppModal>
        </>
    )
}