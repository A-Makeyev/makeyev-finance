import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCheck, FaTimes } from 'react-icons/fa'
import { useQuestionWishlist } from '@/stores/questionWishlistStore'

const TOAST_MS = 1800

/**
 * Self-dismissing confirmation for wishlist changes - the toggle button's
 * own state lives inside a modal the user is about to close, so the global
 * toast is the feedback that survives it. Fires on any add/remove (from the
 * modal, the floating panel or the contact form).
 */
export function QuestionWishlistToast() {
  const { t, i18n } = useTranslation()
  const isHebrew = i18n.language.startsWith('he')
  const lastAction = useQuestionWishlist((s) => s.lastAction)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!lastAction) return
    setVisible(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(false), TOAST_MS)
  }, [lastAction])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  if (!lastAction) return null

  const added = lastAction.kind === 'added'

  return (
    <div
      aria-live="polite"
      data-testid="wishlist-toast"
      className={`pointer-events-none fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        dir={isHebrew ? 'rtl' : 'ltr'}
        className="flex items-center gap-2.5 rounded-full bg-soft-black/90 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] backdrop-blur-sm"
      >
        {added ? (
          <FaCheck aria-hidden="true" className="text-[13px] text-soft-blue" />
        ) : (
          <FaTimes aria-hidden="true" className="text-[12px] text-soft-blue" />
        )}
        {added ? t('wishlist.addedToast') : t('wishlist.removedToast')}
      </div>
    </div>
  )
}
