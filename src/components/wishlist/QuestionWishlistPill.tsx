'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaStar, FaTimes } from 'react-icons/fa'
import {
  hydrateWishlist,
  removeWishlistItem,
  useQuestionWishlist,
} from '@/stores/questionWishlistStore'
import {
  isResultsTopicId,
  resultsTopicTitle,
  resultsTopicSummary,
} from '@/lib/resultsTopics'
import { useRouter, usePathname } from '@/router'

/**
 * Persistent saved-questions indicator - a floating pill (bottom corner)
 * that appears once at least one topic is saved from an explanation dialog.
 * Clicking it opens a mini-list with per-item removal and a shortcut into
 * the contact flow, where the topics ride along in the email.
 *
 * Phase-1 note: nothing in the migrated pages SAVES topics yet (the save
 * buttons live in the calculator's results cards, phase 2), but a visitor
 * with questions saved under the current app still sees and manages them
 * here, and can send them from the contact page.
 *
 * Placement follows the LANGUAGE, not the page direction (non-calculator
 * pages stay LTR even in Hebrew): the pill sits on the right in Hebrew and
 * on the left in English, with the star leading the label on the same side
 * (start of the row), so it never jumps between pages.
 */
export function QuestionWishlistPill() {
  const { t } = useTranslation()
  const items = useQuestionWishlist((s) => s.items)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Load persisted topics once, browser-side (SSR-safe: both the server HTML
  // and the first client render show no pill; it appears right after mount).
  useEffect(() => {
    hydrateWishlist()
  }, [])

  // Titles and summaries follow the live language, so a saved question is
  // re-translated when the site switches Hebrew ⇄ English.
  const topics = items.map((item) =>
    isResultsTopicId(item.id)
      ? {
          item,
          title: resultsTopicTitle(t, item.id, { termYears: 0, highestLabelKind: null }),
          summary: resultsTopicSummary(t, item.id),
        }
      : { item, title: item.title, summary: item.summary },
  )

  // Navigation (e.g. the send CTA) closes the panel.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (items.length === 0) return null

  const send = () => {
    setOpen(false)
    router.push('/contact')
  }

  return (
    <div
      className={`fixed bottom-5 z-[997] ${isHebrewLayout() ? 'right-5' : 'left-5'}`}
      dir={isHebrewLayout() ? 'rtl' : 'ltr'}
      data-testid="wishlist-root"
    >
      {open && (
        <div
          role="dialog"
          aria-label={t('wishlist.panelTitle')}
          data-testid="wishlist-panel"
          className={`absolute bottom-full mb-2.5 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border-2 border-line-strong bg-surface-card p-4 shadow-[0_8px_22px_0_rgba(15,15,15,0.35)] ${
            isHebrewLayout() ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold leading-tight text-ink">
              {t('wishlist.panelTitle')}
            </h2>
            <button
              type="button"
              aria-label={t('wishlist.panelTitle')}
              data-testid="wishlist-panel-close"
              className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[15px] text-soft-dark-grey outline-none transition-colors hover:bg-soft-grey hover:text-ink focus-visible:ring-2 focus-visible:ring-soft-blue/40"
              onClick={() => setOpen(false)}
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-soft-dark-grey">
            {t('wishlist.panelHint')}
          </p>

          <ul className="wishlist-list mt-3 max-h-[45vh] space-y-2 overflow-y-auto pe-1">
            {topics.map(({ item, title, summary }) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-[5px] border border-soft-grey bg-surface-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug text-ink">{title}</p>
                  <p className="mt-1 text-[14px] leading-snug text-soft-dark-grey">{summary}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('wishlist.removeAria', { title })}
                  data-testid={`wishlist-remove-${item.id}`}
                  className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[13px] text-soft-dark-grey outline-none transition-colors hover:bg-soft-red/10 hover:text-soft-red focus-visible:ring-2 focus-visible:ring-soft-blue/40"
                  onClick={() => removeWishlistItem(item.id)}
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            data-testid="wishlist-send"
            onClick={send}
            className="mt-3 flex h-[44px] w-full items-center justify-center rounded-[5px] border border-ink bg-ink text-[15px] font-bold text-surface-card transition-colors hover:bg-surface-card hover:text-ink"
          >
            {t('wishlist.send')}
          </button>
        </div>
      )}

      <button
        type="button"
        data-testid="wishlist-pill"
        aria-expanded={open}
        aria-label={t('wishlist.badgeAria')}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2.5 text-[14px] font-semibold text-surface-card shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] outline-none transition-colors hover:bg-surface-card hover:text-ink focus-visible:ring-2 focus-visible:ring-soft-blue/40"
      >
        <FaStar aria-hidden="true" className="text-[13px] text-soft-blue" />
        {t('wishlist.badge', { count: items.length })}
      </button>
    </div>
  )
}

/** Language of the CURRENT URL segment (he pages RTL-place, en LTR-place). */
function isHebrewLayout(): boolean {
  return typeof window === 'undefined' ? true : !window.location.pathname.startsWith('/en')
}
