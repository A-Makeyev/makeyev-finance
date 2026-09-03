import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { FaStar, FaTimes } from 'react-icons/fa'
import { useQuestionWishlist } from '@/stores/questionWishlistStore'
import { useLocalizedResultsTopics } from '@/features/calculator/resultsTopics'

/**
 * Persistent saved-questions indicator - a floating pill (bottom corner)
 * that appears once at least one topic is saved from an explanation dialog.
 * Clicking it opens a mini-list with per-item removal and a shortcut into
 * the contact flow, where the topics ride along in the email.
 *
 * Placement follows the LANGUAGE, not the page direction (non-calculator
 * pages stay LTR even in Hebrew): the pill sits on the right in Hebrew and
 * on the left in English, with the star leading the label on the same side
 * (start of the row), so it never jumps between pages.
 */
export function QuestionWishlistPill() {
  const { t, i18n } = useTranslation()
  const isHebrew = i18n.language.startsWith('he')
  const items = useQuestionWishlist((s) => s.items)
  // Titles and summaries follow the live language, so a saved question is
  // re-translated when the site switches Hebrew ⇄ English.
  const topics = useLocalizedResultsTopics(items)
  const remove = useQuestionWishlist((s) => s.remove)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Navigation (e.g. the send CTA) closes the panel.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (items.length === 0) return null

  const send = () => {
    setOpen(false)
    navigate('/contact')
  }

  return (
    <div
      className={`fixed bottom-5 z-[997] ${isHebrew ? 'right-5' : 'left-5'}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      data-testid="wishlist-root"
    >
      {open && (
        <div
          role="dialog"
          aria-label={t('wishlist.panelTitle')}
          data-testid="wishlist-panel"
          className={`absolute bottom-full mb-2.5 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl border-2 border-soft-black bg-soft-white p-4 shadow-[0_8px_22px_0_rgba(15,15,15,0.35)] ${
            isHebrew ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold leading-tight text-soft-black">
              {t('wishlist.panelTitle')}
            </h2>
            <button
              type="button"
              aria-label={t('wishlist.panelTitle')}
              data-testid="wishlist-panel-close"
              className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[15px] text-soft-dark-grey outline-none transition-colors hover:bg-soft-grey hover:text-soft-black focus-visible:ring-2 focus-visible:ring-soft-blue/40"
              onClick={() => setOpen(false)}
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-soft-dark-grey">
            {t('wishlist.panelHint')}
          </p>

          <ul className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto pe-1">
            {topics.map(({ item, title, summary }) => (
              <li
                key={item.id}
                className="flex items-start gap-2 rounded-[5px] border border-soft-grey bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug text-soft-black">{title}</p>
                  <p className="mt-1 text-[14px] leading-snug text-soft-dark-grey">{summary}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('wishlist.removeAria', { title })}
                  data-testid={`wishlist-remove-${item.id}`}
                  className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full text-[13px] text-soft-dark-grey outline-none transition-colors hover:bg-soft-red/10 hover:text-soft-red focus-visible:ring-2 focus-visible:ring-soft-blue/40"
                  onClick={() => remove(item.id)}
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
            className="mt-3 flex h-[44px] w-full items-center justify-center rounded-[5px] border border-soft-black bg-soft-black text-[15px] font-bold text-white transition-colors hover:bg-white hover:text-soft-black"
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
        className="flex items-center gap-2 rounded-full border-2 border-soft-black bg-soft-black px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] outline-none transition-colors hover:bg-white hover:text-soft-black focus-visible:ring-2 focus-visible:ring-soft-blue/40"
      >
        <FaStar aria-hidden="true" className="text-[13px] text-soft-blue" />
        {t('wishlist.badge', { count: items.length })}
      </button>
    </div>
  )
}
