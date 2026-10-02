'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCalculator, FaRegTrashAlt, FaSpinner } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { useRouter } from '@/router'
import { formatCurrency, parseAmountText } from '@/lib/format'
import type { PropertyPurpose } from '@/lib/amortization'
import { TRACK_TYPE_COLORS } from '@/features/calculator/trackColors'
import { TrackMixDonut } from '@/features/calculator/TrackMixDonut'
import { useDeleteMix, useSavedMixes, type SavedMix } from './api'
import { summarizeSavedMix } from './summary'

/**
 * The profile page's saved-mixes list: label, track mix, live monthly payment,
 * the scenario it was saved with, load-into-calculator and delete.
 *
 * The figures come from summarizeSavedMix, which recomputes them from the
 * stored tracks rather than replaying a snapshot of old results - so a saved
 * mix always shows current numbers. The scenario figures are the saved inputs
 * (property price, equity, income), shown so a card identifies the mix without
 * opening it.
 *
 * Loading navigates to /calculators?mix=<id>: the URL names the mix, so a
 * refresh (or a bookmark) reloads it, and the calculator applies it once there.
 */

const PURPOSE_KEY: Record<PropertyPurpose, string> = {
  first: 'calculator.purposeFirst',
  upgrade: 'calculator.purposeUpgrade',
  investment: 'calculator.purposeInvestment',
}

export function SavedMixesSection() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data, isPending, isError } = useSavedMixes(true)
  const deleteMix = useDeleteMix()
  const [pendingDelete, setPendingDelete] = useState<SavedMix | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const mixes = data?.mixes ?? []

  function load(mix: SavedMix) {
    router.push(`/calculators?mix=${encodeURIComponent(mix.id)}`)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteFailed(false)
    try {
      await deleteMix.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
    } catch {
      setDeleteFailed(true)
    }
  }

  return (
    <section id="saved-mixes" data-testid="saved-mixes" className="scroll-mt-28">
      <h2 className="mb-4 text-lg font-semibold text-ink">{t('savedMixes.profileTitle')}</h2>

      {isPending && (
        <p className="text-sm text-ink-muted" data-testid="saved-mixes-loading">
          {t('savedMixes.loading')}
        </p>
      )}

      {isError && (
        <p role="alert" data-testid="saved-mixes-error" className="text-sm text-danger">
          {t('savedMixes.loadError')}
        </p>
      )}

      {!isPending && !isError && mixes.length === 0 && (
        <p className="text-sm text-ink-muted" data-testid="saved-mixes-empty">
          {t('savedMixes.empty')}
        </p>
      )}

      <ul className="grid gap-3 lg:auto-rows-fr lg:grid-cols-2">
        {mixes.map((mix) => {
          const summary = summarizeSavedMix(mix.tracks)
          const scenario = mix.scenario
          const propertyPrice = scenario ? parseAmountText(scenario.propertyValueText) : 0
          const capital = scenario ? parseAmountText(scenario.capitalText) : 0
          const income = scenario ? parseAmountText(scenario.incomeText) : 0
          return (
            <li
              key={mix.id}
              data-testid="saved-mix-card"
              className="flex flex-col rounded-2xl border border-line-soft bg-surface-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold text-ink" data-testid="saved-mix-label">
                  {mix.label}
                </h3>
              </div>

              {/* Scenario details sit first, the ring at the inline-end: in the
                  Hebrew layout that puts the ring on the LEFT, matching the
                  request, while the logical order still flips for LTR. */}
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {mix.tracks.length > 0 && (
                    <dl className="flex flex-wrap gap-x-7 gap-y-3">
                      <div className="flex flex-col">
                        <dt className="text-xs text-ink-muted">{t('savedMixes.total')}</dt>
                        <dd
                          className="text-base font-semibold text-ink"
                          data-testid="saved-mix-total"
                        >
                          {formatCurrency(summary.totalAmount)}
                        </dd>
                      </div>
                      <div className="flex flex-col">
                        <dt className="text-xs text-ink-muted">{t('savedMixes.monthlyPayment')}</dt>
                        <dd
                          className="text-base font-semibold text-ink"
                          data-testid="saved-mix-payment"
                        >
                          {formatCurrency(summary.monthlyPayment)}
                        </dd>
                      </div>
                      {propertyPrice > 0 && (
                        <div className="flex flex-col">
                          <dt className="text-xs text-ink-muted">
                            {t('savedMixes.propertyPrice')}
                          </dt>
                          <dd
                            className="text-base font-semibold text-ink"
                            data-testid="saved-mix-property"
                          >
                            {formatCurrency(propertyPrice)}
                          </dd>
                        </div>
                      )}
                      {capital > 0 && (
                        <div className="flex flex-col">
                          <dt className="text-xs text-ink-muted">{t('savedMixes.capital')}</dt>
                          <dd
                            className="text-base font-semibold text-ink"
                            data-testid="saved-mix-capital"
                          >
                            {formatCurrency(capital)}
                          </dd>
                        </div>
                      )}
                      {income > 0 && (
                        <div className="flex flex-col">
                          <dt className="text-xs text-ink-muted">{t('savedMixes.income')}</dt>
                          <dd
                            className="text-base font-semibold text-ink"
                            data-testid="saved-mix-income"
                          >
                            {formatCurrency(income)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {scenario && (
                    <p className="text-xs text-ink-muted" data-testid="saved-mix-purpose">
                      {t('savedMixes.purpose')}: {t(PURPOSE_KEY[scenario.purpose])}
                    </p>
                  )}

                  {/* The text equivalent of the ring: every track's type, share,
                      amount. The data never depends on reading the graphic. */}
                  <ul className="flex flex-wrap gap-2" data-testid="saved-mix-tracks">
                    {summary.parts.map((part, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: TRACK_TYPE_COLORS[part.type] }}
                        />
                        {t(`calculator.trackTypes.${part.type}`)}
                        <span className="text-ink-muted">
                          {Math.round(part.sharePercent)}% · {formatCurrency(part.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {mix.tracks.length > 0 && (
                  <div className="saved-mix-donut" data-testid="saved-mix-donut">
                    {/* Term phrase sits centered directly above the ring. */}
                    <span className="text-sm font-medium text-ink-muted" data-testid="saved-mix-term">
                      {t('savedMixes.termFor', { count: mix.termYears })}
                    </span>
                    <TrackMixDonut
                      shares={summary.parts.map((part, index) => ({
                        trackId: `part-${index}`,
                        type: part.type,
                        amount: part.amount,
                      }))}
                      size={176}
                      showLegend={false}
                      className="saved-mix-donut-chart"
                    />
                  </div>
                )}
              </div>
              <div className="mt-auto flex flex-wrap justify-center gap-3 pt-8 lg:justify-start">
                <button
                  type="button"
                  data-testid="saved-mix-load"
                  onClick={() => load(mix)}
                  className="saved-mix-load-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  <FaCalculator aria-hidden="true" />
                  {t('savedMixes.load')}
                </button>
                <button
                  type="button"
                  data-testid="saved-mix-delete"
                  onClick={() => {
                    setDeleteFailed(false)
                    setPendingDelete(mix)
                  }}
                  className="saved-mix-delete-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  <FaRegTrashAlt aria-hidden="true" />
                  {t('savedMixes.delete')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <AppModal
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        testId="delete-mix-modal"
        dir={i18n.dir()}
        tone="red"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-3 text-[20px] font-bold leading-tight text-ink">
            {t('savedMixes.deleteConfirmTitle')}
          </h3>
          <p className="text-[15px] leading-relaxed text-ink">
            {t('savedMixes.deleteConfirmBody')}
          </p>
          {deleteFailed && (
            <p role="alert" data-testid="delete-mix-error" className="mt-3 text-sm text-danger">
              {t('savedMixes.deleteError')}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              data-testid="delete-mix-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPendingDelete(null)}
            >
              {t('savedMixes.cancel')}
            </button>
            <button
              type="button"
              data-testid="delete-mix-confirm"
              disabled={deleteMix.isPending}
              aria-busy={deleteMix.isPending}
              className="inline-flex items-center gap-2 rounded-[5px] bg-soft-red px-5 py-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmDelete}
            >
              {deleteMix.isPending && (
                <FaSpinner
                  aria-hidden="true"
                  data-testid="delete-mix-spinner"
                  className="animate-spin"
                />
              )}
              {t('savedMixes.delete')}
            </button>
          </div>
        </div>
      </AppModal>
    </section>
  )
}
