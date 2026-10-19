'use client'

import { useTranslation } from 'react-i18next'
import {
  formatAverageRate,
  type AverageRateTablePayload,
} from '@/lib/averageRates'
import { formatDateOnly } from '@/lib/rateValidity'

interface RatesTableProps {
  table: AverageRateTablePayload
  onRetry: () => void
  retrying: boolean
}

/**
 * One average-rate table: the current publication plus the last 12 monthly
 * rows. The source workbook stores the table in the opposite reading direction
 * to this presentation, so the parser has already normalized every row to
 * { validFrom, average, buckets } and this component only renders it.
 */
export function RatesTable({ table, onRetry, retrying }: RatesTableProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const title = t(table.kind === 'indexed' ? 'rates.indexedTitle' : 'rates.nonIndexedTitle')
  const note = t(table.kind === 'indexed' ? 'rates.indexedNote' : 'rates.nonIndexedNote')
  const current = table.rows[0]
  const titleId = `rates-table-title-${table.kind}`
  const hintId = `rates-table-hint-${table.kind}`
  const regionLabel = `${title}, ${t('rates.historyTitle')}`

  return (
    <section
      className="rounded-[5px] border border-line-strong bg-surface-card p-4 sm:p-7"
      data-testid={`rates-section-${table.kind}`}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 id={titleId} className="text-xl font-bold text-ink sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-ink-muted">{note}</p>
        </div>
      </div>

      {table.status === 'stale' && (
        <p
          data-testid={`rates-stale-${table.kind}`}
          className="mt-4 rounded-[5px] border border-soft-yellow bg-soft-yellow/15 px-3 py-2 text-sm leading-relaxed text-ink"
        >
          {t('rates.stale')}
        </p>
      )}

      {table.status === 'unavailable' ? (
        <div
          className="mt-4 rounded-[5px] border border-line-strong bg-surface-soft px-4 py-4"
          data-testid={`rates-unavailable-${table.kind}`}
        >
          <p className="text-sm leading-relaxed text-ink-muted">{t('rates.unavailable')}</p>
          <button
            type="button"
            data-testid={`rates-retry-${table.kind}`}
            onClick={onRetry}
            disabled={retrying}
            className="mt-3 rounded-[5px] border border-line-strong bg-surface-card px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft-blue disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? t('rates.retrying') : t('rates.retry')}
          </button>
        </div>
      ) : current ? (
        <>
          <div className="rates-current mt-4 px-4 py-3" data-testid={`rates-current-${table.kind}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('rates.current')}
              </span>
              <span className="text-2xl font-bold text-ink sm:text-3xl">
                {formatAverageRate(current.average, locale)}
              </span>
              <span className="text-sm text-ink-muted">
                {t('rates.validFrom', { date: formatDateOnly(current.validFrom, locale) })}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-ink">{t('rates.historyTitle')}</h3>
            <p className="text-xs text-ink-muted">{t('rates.historyCaption')}</p>
          </div>
          <p id={hintId} className="mt-1 text-xs text-ink-muted sm:hidden">
            {t('rates.historyHint')}
          </p>

          <div
            className="rates-table-wrap mt-2"
            role="region"
            aria-label={regionLabel}
            aria-describedby={hintId}
            tabIndex={0}
            data-testid={`rates-table-wrap-${table.kind}`}
          >
            <table className="rates-table" data-testid={`rates-table-${table.kind}`}>
              <caption className="sr-only">
                {title}. {t('rates.historyCaption')}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('rates.month')}</th>
                  <th scope="col">{t('rates.average')}</th>
                  {table.buckets.map((bucket) => (
                    <th key={bucket} scope="col">
                      {t(`rates.buckets.${bucket}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => {
                  const isCurrent = index === 0
                  return (
                    <tr
                      key={row.validFrom}
                      className={isCurrent ? 'rates-current-row' : undefined}
                      data-testid={
                        isCurrent ? `rates-current-row-${table.kind}` : `rates-row-${table.kind}`
                      }
                    >
                      <th scope="row">
                        <span>{formatDateOnly(row.validFrom, locale)}</span>
                        {isCurrent && (
                          <span className="rates-current-badge">{t('rates.currentBadge')}</span>
                        )}
                      </th>
                      <td className="rates-num">{formatAverageRate(row.average, locale)}</td>
                      {table.buckets.map((bucket) => (
                        <td key={bucket} className="rates-num">
                          {formatAverageRate(row.buckets[bucket] ?? null, locale)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p
          className="mt-4 rounded-[5px] border border-line-strong bg-surface-soft px-4 py-3 text-sm text-ink-muted"
          data-testid={`rates-empty-${table.kind}`}
        >
          {t('rates.empty')}
        </p>
      )}
    </section>
  )
}
