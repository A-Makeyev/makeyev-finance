'use client'

import { useTranslation } from 'react-i18next'
import { ScrollCue } from '@/components/layout/ScrollCue'
import { useAverageRates } from '@/services/rates'
import { RatesTable } from './RatesTable'

/**
 * The average mortgage-rate page.
 *
 * Data comes from GET /api/rates/average, which parses the Bank of Israel's
 * official workbooks on the server. Both tables render independently: a failed
 * refresh of one never hides the other, and a stale table says so instead of
 * presenting an old number as current.
 */
export function AverageRatesPage() {
  const { t, i18n } = useTranslation()
  const { data, isPending, isError, isFetching, refetch } = useAverageRates()
  const retry = () => {
    void refetch()
  }

  return (
    <>
      <section className="sub-header">
        <div className="text-box">
          <h1 className="gradient-text-no-hover">{t('rates.title')}</h1>
          <p>{t('rates.subtitle')}</p>
        </div>
        <ScrollCue />
      </section>

      <section className="rates-page" dir={i18n.dir()} data-testid="rates-page">
        <div className="rounded-[5px] border border-line-strong bg-surface-card p-4 sm:p-7">
          <p className="max-w-[70ch] text-base leading-relaxed text-ink">{t('rates.intro')}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-ink-muted">{t('rates.source')}</span>
            <a
              href={t('rates.sourceUrl')}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="rates-source-link"
              className="text-sm font-semibold text-soft-dark-blue underline underline-offset-4 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft-blue"
            >
              {t('rates.sourceLink')}
            </a>
          </div>
        </div>

        {isPending && (
          <div
            className="mt-6 rounded-[5px] border border-line-strong bg-surface-card px-4 py-6 text-center"
            data-testid="rates-loading"
            aria-busy="true"
          >
            <p className="text-base text-ink-muted">{t('rates.loading')}</p>
          </div>
        )}

        {isError && (
          <div
            className="mt-6 rounded-[5px] border border-line-strong bg-surface-card p-5"
            data-testid="rates-error"
            role="alert"
          >
            <h2 className="text-lg font-bold text-ink">{t('rates.errorTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t('rates.errorBody')}</p>
            <button
              type="button"
              data-testid="rates-retry"
              onClick={retry}
              disabled={isFetching}
              className="mt-4 rounded-[5px] border border-line-strong bg-surface-soft px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? t('rates.retrying') : t('rates.retry')}
            </button>
          </div>
        )}

        {data && (
          <div className="mt-6 space-y-6">
            {data.tables.map((table) => (
              <RatesTable
                key={table.kind}
                table={table}
                onRetry={retry}
                retrying={isFetching}
              />
            ))}
          </div>
        )}

        <div className="mt-6 rounded-[5px] border border-line-strong bg-surface-soft p-4">
          <ul className="list-disc space-y-2 ps-5 text-xs leading-relaxed text-ink-muted">
            <li>{t('rates.footnotes.periods')}</li>
            {data?.tables.some((table) => table.kind === 'nonIndexed') && (
              <li>{t('rates.footnotes.upTo1')}</li>
            )}
            <li>{t('rates.footnotes.source')}</li>
          </ul>
        </div>
      </section>
    </>
  )
}
