'use client'

import { useState } from 'react'
import { LoadingIndicator } from '@/components/ui/LoadingIndicator'
import { useTranslation } from 'react-i18next'
import { FaCopy, FaPen, FaRegTrashAlt, FaSpinner } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PendingContent } from '@/components/ui/PendingContent'
import { useRouter } from '@/router'
import { formatCurrency, parseAmountText } from '@/lib/format'
import { formatRelativeTime } from '@/lib/relativeTime'
import {
  isComparisonLabelTaken,
  useDeleteComparison,
  useSaveComparison,
  useSavedComparisons,
  type SavedComparison,
} from './api'

/**
 * The profile page's saved comparisons: label, how many mixes the snapshot
 * holds, the shared loan and property, and open/rename/duplicate/delete.
 *
 * Each card is an independent snapshot. Editing the source mixes later cannot
 * change it: the stored document is authoritative, and opening it recalculates
 * from the snapshot through the shared engine.
 */
export function SavedComparisonsSection() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data, isPending, isError } = useSavedComparisons(true)
  const saveComparison = useSaveComparison()
  const deleteComparison = useDeleteComparison()

  const [pendingDelete, setPendingDelete] = useState<SavedComparison | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [renaming, setRenaming] = useState<SavedComparison | null>(null)
  const [renameText, setRenameText] = useState('')
  const [renameNotice, setRenameNotice] = useState<'duplicate' | 'error' | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<'cap' | 'error' | null>(null)

  const comparisons = data?.comparisons ?? []

  function open(comparison: SavedComparison) {
    router.push(`/compare?comparison=${encodeURIComponent(comparison.id)}`)
  }

  function nextCopyLabel(source: SavedComparison): string {
    const base = t('savedComparisons.copyName', { label: source.label })
    let candidate = base
    let index = 2
    while (isComparisonLabelTaken(comparisons, candidate)) {
      candidate = `${base} ${index}`
      index += 1
    }
    return candidate
  }

  async function duplicate(source: SavedComparison) {
    setDuplicateId(source.id)
    setActionNotice(null)
    try {
      await saveComparison.mutateAsync({
        label: nextCopyLabel(source),
        snapshot: source.snapshot,
      })
    } catch (error) {
      // A copy is a create, so it can hit the per-user cap. The server sends
      // that as 'cap'; showing the generic save error instead would hide the
      // only actionable cause.
      const token = error instanceof Error ? error.message : 'error'
      setActionNotice(token === 'cap' ? 'cap' : 'error')
    } finally {
      setDuplicateId(null)
    }
  }

  function openRename(source: SavedComparison) {
    setRenaming(source)
    setRenameText(source.label)
    setRenameNotice(null)
  }

  async function confirmRename() {
    if (!renaming) return
    const label = renameText.trim()
    if (!label) return
    if (isComparisonLabelTaken(comparisons, label, renaming.id)) {
      setRenameNotice('duplicate')
      return
    }
    try {
      await saveComparison.mutateAsync({
        id: renaming.id,
        label,
        snapshot: renaming.snapshot,
      })
      setRenaming(null)
    } catch (error) {
      const token = error instanceof Error ? error.message : 'error'
      setRenameNotice(token === 'duplicate' ? 'duplicate' : 'error')
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteFailed(false)
    try {
      await deleteComparison.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
    } catch {
      setDeleteFailed(true)
    }
  }

  return (
    <section id="saved-comparisons" data-testid="saved-comparisons" className="scroll-mt-28">
      <h2 className="mb-4 text-lg font-semibold text-ink">
        {t('savedComparisons.profileTitle')}
      </h2>

      {isPending && (
        <LoadingIndicator testId="saved-comparisons-loading" label={t('savedComparisons.loading')} className="w-full" />
      )}

      {isError && (
        <p role="alert" data-testid="saved-comparisons-error" className="text-sm text-danger">
          {t('savedComparisons.loadError')}
        </p>
      )}

      {!isPending && !isError && comparisons.length === 0 && (
        <p className="text-sm text-ink-muted" data-testid="saved-comparisons-empty">
          {t('savedComparisons.empty')}
        </p>
      )}

      {actionNotice && (
        <p role="alert" data-testid="saved-comparisons-action-error" className="mb-3 text-sm text-danger">
          {t(
            actionNotice === 'cap'
              ? 'savedComparisons.capReached'
              : 'savedComparisons.saveError',
          )}
        </p>
      )}

      <ul className="grid gap-3 lg:auto-rows-fr lg:grid-cols-2">
        {comparisons.map((comparison) => {
          const loan = parseAmountText(comparison.snapshot.shared.mortgageSumText)
          const property = parseAmountText(comparison.snapshot.shared.propertyValueText)
          return (
            <li
              key={comparison.id}
              data-testid="saved-comparison-card"
              className="flex flex-col rounded-2xl border border-line-soft bg-surface-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="min-w-0 text-base font-semibold text-ink"
                  data-testid="saved-comparison-label"
                >
                  {comparison.label}
                </h3>
                <p
                  className="shrink-0 text-xs text-ink-muted"
                  data-testid="saved-comparison-updated"
                >
                  {t('savedComparisons.updated', {
                    when: formatRelativeTime(
                      Date.parse(comparison.updatedAt),
                      Date.now(),
                      i18n.language,
                    ),
                  })}
                </p>
              </div>

              <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
                <div className="flex flex-col">
                  <dt className="text-xs text-ink-muted">{t('savedComparisons.mixes')}</dt>
                  <dd
                    className="text-base font-semibold text-ink"
                    data-testid="saved-comparison-mix-count"
                  >
                    {comparison.snapshot.scenarios.length}
                  </dd>
                </div>
                {loan > 0 && (
                  <div className="flex flex-col">
                    <dt className="text-xs text-ink-muted">{t('savedComparisons.loan')}</dt>
                    <dd
                      className="text-base font-semibold text-ink"
                      data-testid="saved-comparison-loan"
                    >
                      {formatCurrency(loan)}
                    </dd>
                  </div>
                )}
                {property > 0 && (
                  <div className="flex flex-col">
                    <dt className="text-xs text-ink-muted">
                      {t('savedComparisons.property')}
                    </dt>
                    <dd
                      className="text-base font-semibold text-ink"
                      data-testid="saved-comparison-property"
                    >
                      {formatCurrency(property)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-auto flex flex-wrap justify-center gap-3 pt-6 lg:justify-start">
                <button
                  type="button"
                  data-testid="saved-comparison-open"
                  onClick={() => open(comparison)}
                  className="saved-mix-load-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  {t('savedComparisons.open')}
                </button>
                <button
                  type="button"
                  data-testid="saved-comparison-rename"
                  onClick={() => openRename(comparison)}
                  className="saved-mix-secondary-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  <FaPen aria-hidden="true" />
                  {t('savedComparisons.rename')}
                </button>
                <button
                  type="button"
                  data-testid="saved-comparison-duplicate"
                  disabled={duplicateId === comparison.id}
                  aria-busy={duplicateId === comparison.id}
                  onClick={() => void duplicate(comparison)}
                  className="saved-mix-secondary-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
                >
                  {duplicateId === comparison.id ? (
                    <FaSpinner aria-hidden="true" className="animate-spin" />
                  ) : (
                    <FaCopy aria-hidden="true" />
                  )}
                  {t('savedComparisons.duplicate')}
                </button>
                <button
                  type="button"
                  data-testid="saved-comparison-delete"
                  onClick={() => {
                    setDeleteFailed(false)
                    setPendingDelete(comparison)
                  }}
                  className="saved-mix-delete-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
                >
                  <FaRegTrashAlt aria-hidden="true" />
                  {t('savedComparisons.delete')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <AppModal
        open={renaming !== null}
        onOpenChange={(openState) => {
          if (!openState) setRenaming(null)
        }}
        testId="rename-comparison-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {t('savedComparisons.renameTitle')}
          </h3>
          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('savedComparisons.labelLabel')}</span>
            <input
              type="text"
              maxLength={60}
              autoFocus
              name="comparison-rename-label"
              data-testid="rename-comparison-label"
              className="w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink"
              value={renameText}
              onChange={(event) => {
                setRenameText(event.target.value)
                if (renameNotice === 'duplicate') setRenameNotice(null)
              }}
            />
          </label>
          {renameNotice === 'duplicate' && (
            <p role="alert" data-testid="rename-comparison-duplicate" className="mt-3 text-sm text-danger">
              {t('savedComparisons.duplicateName')}
            </p>
          )}
          {renameNotice === 'error' && (
            <p role="alert" data-testid="rename-comparison-error" className="mt-3 text-sm text-danger">
              {t('savedComparisons.saveError')}
            </p>
          )}
          <div className="mt-6 modal-actions modal-actions-reversed">
            <button
              type="button"
              data-testid="rename-comparison-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setRenaming(null)}
            >
              {t('savedComparisons.cancel')}
            </button>
            <button
              type="button"
              data-testid="rename-comparison-confirm"
              disabled={saveComparison.isPending || !renameText.trim()}
              aria-busy={saveComparison.isPending}
              aria-label={saveComparison.isPending ? t('savedComparisons.renameConfirm') : undefined}
              className="relative inline-flex items-center justify-center gap-2 rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmRename}
            >
              <PendingContent
                pending={saveComparison.isPending}
                spinnerTestId="rename-comparison-spinner"
              >
                {t('savedComparisons.renameConfirm')}
              </PendingContent>
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={pendingDelete !== null}
        onOpenChange={(openState) => {
          if (!openState) setPendingDelete(null)
        }}
        testId="delete-comparison-modal"
        dir={i18n.dir()}
        tone="red"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-3 text-[20px] font-bold leading-tight text-ink">
            {t('savedComparisons.deleteConfirmTitle')}
          </h3>
          <p className="text-[15px] leading-relaxed text-ink">
            {t('savedComparisons.deleteConfirmBody')}
          </p>
          {deleteFailed && (
            <p role="alert" data-testid="delete-comparison-error" className="mt-3 text-sm text-danger">
              {t('savedComparisons.deleteError')}
            </p>
          )}
          <div className="mt-6 modal-actions modal-actions-reversed flex-wrap">
            <button
              type="button"
              data-testid="delete-comparison-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setPendingDelete(null)}
            >
              {t('savedComparisons.cancel')}
            </button>
            <button
              type="button"
              data-testid="delete-comparison-confirm"
              disabled={deleteComparison.isPending}
              aria-busy={deleteComparison.isPending}
              aria-label={deleteComparison.isPending ? t('savedComparisons.delete') : undefined}
              className="relative inline-flex items-center justify-center gap-2 rounded-[5px] bg-soft-red px-5 py-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmDelete}
            >
              <PendingContent
                pending={deleteComparison.isPending}
                spinnerTestId="delete-comparison-spinner"
              >
                {t('savedComparisons.delete')}
              </PendingContent>
            </button>
          </div>
        </div>
      </AppModal>
    </section>
  )
}
