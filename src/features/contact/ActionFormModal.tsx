'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/ui/AppModal'
import { ContactForm, type ContactSubmitOutcome } from './ContactForm'
import { MessageModal } from './MessageModal'

export interface ActionFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActionFormModal({ open, onOpenChange }: ActionFormModalProps) {
  const { t, i18n } = useTranslation()
  const isHebrew = i18n.language.startsWith('he')
  const [outcome, setOutcome] = useState<ContactSubmitOutcome | null>(null)
  const resetRef = useRef<(() => void) | null>(null)

  const closeAll = () => {
    onOpenChange(false)
    setOutcome(null)
    if (window.navigator.onLine) resetRef.current?.()
  }

  useEffect(() => {
    if (!open && !outcome) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll()
    }
    document.body.addEventListener('keydown', onKey)
    return () => document.body.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeAll is stable-in-practice (closes the modal), legacy parity
  }, [open, outcome])

  const handleOutcome = (result: ContactSubmitOutcome) => {
    onOpenChange(false)
    window.setTimeout(() => {
      setOutcome(result)
      document.body.style.cursor = ''
    }, 150)
  }

  return (
    <>
      <AppModal
        open={open}
        onOpenChange={onOpenChange}
        tone="blue"
        testId="action-form-modal"
        dir={isHebrew ? 'rtl' : 'ltr'}
        // The blue accent comes from tone="blue"; keep it (do not override
        // the border here) so the form modal reads as the same control
        // family as the valid fields and the send button.
        // `!max-w` beats the shared AppModal base's max-w-[500px]: both are
        // plain utilities, so without the important flag the 500px one wins
        // by source order. The 60px drop and the height cap (viewport minus
        // 200px) keep the dialog clear of the sticky header at the top and
        // ~40px off the bottom on a short window. Together they guarantee a
        // top edge at least 160px down, however short the viewport is; the
        // form scrolls inside the cap instead of sliding under the header.
        contentClassName="no-scrollbar !max-w-[380px] !max-h-[calc(100dvh_-_200px)] !top-[calc(50%_+_60px)] !rounded-2xl !shadow-[0_12px_32px_rgba(15,15,15,0.30)]"
      >
        {/* Compact by design at every width: the form modal is the tallest
            dialog on the site, so its fields, rhythm and type are one step
            tighter than the standalone contact form (see the scoped rules in
            globals.css) and it is 100px narrower than the shared AppModal
            base, so it stops dominating the screen on a laptop or a wide
            monitor alike. */}
        <div className="p-4" dir={isHebrew ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div
            className={`mb-2 ${isHebrew ? 'text-right' : 'text-left'}`}
          >
            <h1 className="text-[18px] font-bold leading-tight text-ink sm:text-[19px]">
              {t('contact.actionModal.title')}
            </h1>
            <p className="mt-1 text-[13px] font-medium text-soft-blue sm:text-[14px]">
              {t('contact.actionModal.subtitle')}
            </p>
          </div>

          {/* Form */}
          <div className="w-full">
            <ContactForm
              variant="action"
              onOutcome={handleOutcome}
              registerReset={(fn) => (resetRef.current = fn)}
            />
          </div>
        </div>
      </AppModal>

      <MessageModal
        state={outcome ? { status: outcome.status, detail: outcome.detail } : null}
        firstName={outcome?.name}
        linksVariant="social"
        onClose={() => {
          setOutcome(null)
          if (window.navigator.onLine) resetRef.current?.()
        }}
      />
    </>
  )
}
