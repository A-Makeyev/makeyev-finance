import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { AppModal } from './AppModal'
import { TermSlider, type TermSliderProps } from './TermSlider'

/** Keep customized terms intact until the user confirms the finished slider edit. */
export function ConfirmedTermSlider({
  requiresConfirmation,
  ...props
}: TermSliderProps & { requiresConfirmation: boolean }) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState<number | null>(null)
  const draftRef = useRef<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const testId = `${props.testId}-confirm`

  function close() {
    setPending(null)
    setDraft(null)
    draftRef.current = null
    requestAnimationFrame(() => document.getElementById(props.inputId ?? 'term-years')?.focus())
  }

  function commit() {
    const years = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (years !== null && years !== props.value) setPending(years)
  }

  return (
    <>
      <TermSlider
        {...props}
        value={draft ?? props.value}
        onValueChange={(years) => {
          if (requiresConfirmation) {
            draftRef.current = years
            setDraft(years)
          } else {
            props.onValueChange(years)
          }
        }}
        onValueCommit={commit}
      />
      <AppModal
        open={pending !== null}
        onOpenChange={(open) => { if (!open) close() }}
        testId={testId}
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <Dialog.Title className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {t('calculator.termChangeTitle')}
          </Dialog.Title>
          <Dialog.Description className="text-[15px] leading-relaxed text-ink">
            {t('calculator.termChangeBody', { years: pending })}
          </Dialog.Description>
          <div className="mt-6 modal-actions modal-actions-reversed term-confirm-actions">
            <button type="button" className="term-confirm-cancel" data-testid={`${testId}-cancel`} onClick={close}>
              {t('savedMixes.cancel')}
            </button>
            <button
              type="button"
              className="calculate-button"
              data-testid={`${testId}-apply`}
              onClick={() => {
                if (pending !== null) props.onValueChange(pending)
                close()
              }}
            >
              {t('calculator.termChangeApply')}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
