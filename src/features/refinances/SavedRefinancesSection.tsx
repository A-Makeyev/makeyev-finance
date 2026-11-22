'use client'

import { useState } from 'react'
import { LoadingIndicator } from '@/components/ui/LoadingIndicator'
import { useTranslation } from 'react-i18next'
import { FaRegTrashAlt } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PendingContent } from '@/components/ui/PendingContent'
import { useRouter } from '@/router'
import { formatCurrency } from '@/lib/format'
import { formatRelativeTime } from '@/lib/relativeTime'
import { useDeleteRefinance, useSavedRefinances, type SavedRefinance } from './api'

/**
 * The profile page's saved refinance plans. Each card is one plan holding one
 * or more offers; opening it navigates to `/refinance?refinance=<id>` so a
 * refresh or bookmark reloads the same plan.
 */
export function SavedRefinancesSection() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data, isPending, isError } = useSavedRefinances(true)
  const deleteRefinance = useDeleteRefinance()
  const [pendingDelete, setPendingDelete] = useState<SavedRefinance | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const proposals = data?.refinances ?? []

  function open(proposal: SavedRefinance) {
    router.push(`/refinance?refinance=${encodeURIComponent(proposal.id)}`)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteFailed(false)
    try {
      await deleteRefinance.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
    } catch {
      setDeleteFailed(true)
    }
  }

  return (
    <section id="saved-refinances" data-testid="saved-refinances" className="scroll-mt-28">
      <h2 className="mb-4 text-lg font-semibold text-ink">
        {t('savedRefinances.profileTitle')}
      </h2>

      {isPending && (
        <LoadingIndicator testId="saved-refinances-loading" label={t('savedRefinances.loading')} className="w-full" />
      )}

      {isError && (
        <p role="alert" data-testid="saved-refinances-error" className="text-sm text-danger">
          {t('savedRefinances.loadError')}
        </p>
      )}

      {!isPending && !isError && proposals.length === 0 && (
        <p className="text-sm text-ink-muted" data-testid="saved-refinances-empty">
          {t('savedRefinances.empty')}
        </p>
      )}

      <ul className="grid gap-3 lg:auto-rows-fr lg:grid-cols-2">
        {proposals.map((proposal) => {
          const balances = proposal.snapshot.existingTracks.map((track) => track.currentBalance)
          const balanceKnown = balances.every((balance) => balance !== null)
          const totalBalance = balanceKnown
            ? balances.reduce((sum, balance) => sum + (balance ?? 0), 0)
            : null
          return (
            <li
              key={proposal.id}
              data-testid="saved-refinance-card"
              className="flex flex-col rounded-2xl border border-line-soft bg-surface-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="min-w-0 text-base font-semibold text-ink"
                  data-testid="saved-refinance-label"
                >
                  {proposal.label}
                </h3>
                <p
                  className="shrink-0 text-xs text-ink-muted"
                  data-testid="saved-refinance-updated"
                >
                  {t('savedRefinances.updated', {
                    when: formatRelativeTime(
                      Date.parse(proposal.updatedAt),
                      Date.now(),
                      i18n.language,
                    ),
                  })}
                </p>
              </div>

              <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                <div className="flex flex-col">
                  <dt className="text-xs text-ink-muted">{t('savedRefinances.existingTracks')}</dt>
                  <dd
                    className="text-base font-semibold text-ink"
                    data-testid="saved-refinance-existing-count"
                  >
                    {proposal.snapshot.existingTracks.length}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-ink-muted">{t('savedRefinances.proposals')}</dt>
                  <dd
                    className="text-base font-semibold text-ink"
                    data-testid="saved-refinance-proposed-count"
                  >
                    {proposal.snapshot.proposals.length}
                  </dd>
                </div>
                {totalBalance !== null && totalBalance > 0 && (
                  <div className="flex flex-col">
                    <dt className="text-xs text-ink-muted">{t('savedRefinances.balance')}</dt>
                    <dd
                      className="text-base font-semibold text-ink"
                      data-testid="saved-refinance-balance"
                    >
                      {formatCurrency(totalBalance)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6 lg:justify-start">
                <button
                  type="button"
                  data-testid="saved-refinance-open"
                  onClick={() => open(proposal)}
                  className="saved-mix-load-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  {t('savedRefinances.open')}
                </button>
                <button
                  type="button"
                  data-testid="saved-refinance-delete"
                  onClick={() => {
                    setDeleteFailed(false)
                    setPendingDelete(proposal)
                  }}
                  className="saved-mix-delete-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  <FaRegTrashAlt aria-hidden="true" />
                  {t('savedRefinances.delete')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <AppModal
        open={pendingDelete !== null}
        onOpenChange={(openState) => {
          if (!openState) setPendingDelete(null)
        }}
        testId="delete-refinance-modal"
        dir={i18n.dir()}
        tone="red"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-3 text-[20px] font-bold leading-tight text-ink">
            {t('savedRefinances.deleteConfirmTitle')}
          </h3>
          <p className="text-[15px] leading-relaxed text-ink">
            {t('savedRefinances.deleteConfirmBody')}
          </p>
          {deleteFailed && (
            <p role="alert" data-testid="delete-refinance-error" className="mt-3 text-sm text-danger">
              {t('savedRefinances.deleteError')}
            </p>
          )}
          <div className="mt-6 modal-actions modal-actions-reversed flex-wrap">
            <button
              type="button"
              data-testid="delete-refinance-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPendingDelete(null)}
            >
              {t('savedRefinances.cancel')}
            </button>
            <button
              type="button"
              data-testid="delete-refinance-confirm"
              disabled={deleteRefinance.isPending}
              aria-busy={deleteRefinance.isPending}
              aria-label={deleteRefinance.isPending ? t('savedRefinances.delete') : undefined}
              className="relative inline-flex items-center justify-center gap-2 rounded-[5px] bg-soft-red px-5 py-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmDelete}
            >
              <PendingContent
                pending={deleteRefinance.isPending}
                spinnerTestId="delete-refinance-spinner"
              >
                {t('savedRefinances.delete')}
              </PendingContent>
            </button>
          </div>
        </div>
      </AppModal>
    </section>
  )
}
