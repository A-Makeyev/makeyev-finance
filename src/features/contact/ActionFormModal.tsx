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
        contentClassName="no-scrollbar max-w-[500px] !rounded-2xl !shadow-[0_12px_32px_rgba(15,15,15,0.30)]"
      >
        {/* Responsive scale: the form modal is the tallest dialog on the
            site, so on a phone its padding and headline step down to keep the
            fields and the send button in view without scrolling past a
            desktop-sized header. */}
        <div className="p-4 pb-4 sm:p-6 sm:pb-5" dir={isHebrew ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div className={`mb-3 sm:mb-4 ${isHebrew ? 'text-right' : 'text-left'}`}>
            <h1 className="text-[22px] font-bold leading-tight text-ink sm:text-[28px]">
              {t('contact.actionModal.title')}
            </h1>
            <p className="mt-1 text-[15px] font-medium text-soft-blue sm:text-[17px]">
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
