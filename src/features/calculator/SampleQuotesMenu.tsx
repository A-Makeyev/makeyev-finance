'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppModal } from '@/components/ui/AppModal'
import { formatCurrency } from '@/lib/format'
import { SAMPLE_QUOTES, sampleQuoteTermYears, type SampleQuote } from '@/data/sampleQuotes'
import { isMixDirty, useCalculatorStore } from '@/stores/calculatorStore'

/**
 * Load one of the verified reference quotes as UNSAVED work in the calculator.
 * This is deliberately separate from the preset buttons: presets are the app's
 * recommended mixes (shared with the comparison page and an article), while
 * these are dated bank offers used to check the engine.
 */
export function SampleQuotesMenu() {
  const { t, i18n } = useTranslation()
  const [pending, setPending] = useState<SampleQuote | null>(null)

  function load(quote: SampleQuote) {
    useCalculatorStore.getState().loadSavedMix(quote.tracks, sampleQuoteTermYears(quote))
    // A sample is new unsaved work, not a saved-mix deep link.
    const url = new URL(window.location.href)
    url.searchParams.delete('mix')
    url.searchParams.delete('preset')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    setPending(null)
  }

  function select(quote: SampleQuote) {
    if (isMixDirty(useCalculatorStore.getState())) {
      setPending(quote)
      return
    }
    load(quote)
  }

  return (
    <>
      <details className="sample-quotes" data-testid="sample-quotes">
        <summary>{t('calculator.sampleQuotes.heading')}</summary>
        <p className="sample-quotes-note">{t('calculator.sampleQuotes.note')}</p>
        <ul className="sample-quotes-list">
          {SAMPLE_QUOTES.map((quote) => (
            <li key={quote.id}>
              <button
                type="button"
                className="sample-quote-button"
                data-testid={`sample-quote-${quote.id}`}
                onClick={() => select(quote)}
              >
                <strong>{t(`calculator.sampleQuotes.banks.${quote.bank}`)}</strong>
                <span>{quote.date}</span>
                <span>{formatCurrency(quote.loan)}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      <AppModal
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        testId="sample-quote-confirm"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {t('calculator.sampleQuotes.replaceTitle')}
          </h3>
          <p className="text-[15px] leading-relaxed text-ink">
            {t('calculator.sampleQuotes.replaceBody')}
          </p>
          <div className="mt-6 modal-actions modal-actions-reversed">
            <button
              type="button"
              className="reset-button"
              data-testid="sample-quote-cancel"
              onClick={() => setPending(null)}
            >
              {t('savedMixes.cancel')}
            </button>
            <button
              type="button"
              className="calculate-button"
              data-testid="sample-quote-confirm-load"
              onClick={() => pending && load(pending)}
            >
              {t('calculator.sampleQuotes.replaceAction')}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
