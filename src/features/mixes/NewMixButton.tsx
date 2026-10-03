'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/ui/AppModal'
import { useCalculatorStore, isMixDirty } from '@/stores/calculatorStore'

export function NewMixButton() {
    const { t, i18n } = useTranslation()
    const mixDirty = useCalculatorStore((state) => isMixDirty(state))
    const detachMix = useCalculatorStore((state) => state.detachMix)
    const reset = useCalculatorStore((state) => state.reset)
    const [confirmOpen, setConfirmOpen] = useState(false)

    function startNewMix() {
        setConfirmOpen(false)
        detachMix()
        reset()
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`)
    }

    return (
        <>
            <button
                type="button"
                data-testid="new-mix"
                onClick={() => (mixDirty ? setConfirmOpen(true) : startNewMix())}
                className="calculate-button save-mix-button new-mix-button"
            >
                {t('savedMixes.newMix')}
            </button>

            <AppModal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                testId="new-mix-confirm"
                dir={i18n.dir()}
                tone="teal"
                contentClassName="max-w-[420px]"
            >
                <div className="p-6">
                    <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
                        {t('savedMixes.newMixConfirmTitle')}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-ink">
                        {t('savedMixes.newMixConfirmBody')}
                    </p>
                    <div className="mt-6 modal-actions modal-actions-reversed">
                        <button
                            type="button"
                            data-testid="new-mix-cancel"
                            className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
                            onClick={() => setConfirmOpen(false)}
                        >
                            {t('savedMixes.cancel')}
                        </button>
                        <button
                            type="button"
                            data-testid="new-mix-confirm-yes"
                            className="rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)]"
                            onClick={startNewMix}
                        >
                            {t('savedMixes.newMixConfirmAction')}
                        </button>
                    </div>
                </div>
            </AppModal>
        </>
    )
}