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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        contentClassName="max-w-[500px] !rounded-2xl !border-soft-black !shadow-[0_8px_24px_rgba(15,15,15,0.28)]"
      >
        <div className="p-6 pb-5" dir={isHebrew ? 'rtl' : 'ltr'}>
          {/* Header */}
          <div className={`mb-4 ${isHebrew ? 'text-right' : 'text-left'}`}>
            <h1 className="text-[28px] font-bold leading-tight text-soft-black">
              {t('contact.actionModal.title')}
            </h1>
            <p className="mt-1 text-[17px] font-medium text-soft-blue">
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
