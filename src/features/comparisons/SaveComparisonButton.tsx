'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCheck, FaRegTrashAlt, FaSpinner } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PendingContent } from '@/components/ui/PendingContent'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/router'
import {
  isComparisonDirty,
  serializeComparisonSnapshot,
  useComparisonStore,
} from '@/stores/comparisonStore'
import {
  isComparisonLabelTaken,
  useDeleteComparison,
  useSaveComparison,
  useSavedComparisons,
  type SavedComparison,
} from './api'
import { markPendingComparisonSave } from './pendingSave'

type Notice = 'saved' | 'cap' | 'duplicate' | 'error' | null

function saveErrorNotice(error: unknown): 'cap' | 'duplicate' | 'error' {
  if (!(error instanceof Error)) return 'error'
  if (error.message === 'cap') return 'cap'
  if (error.message === 'duplicate') return 'duplicate'
  return 'error'
}

/**
 * The compare page's save control. Manual by design, like the calculator's
 * save: a click is a clear intent to keep this comparison, and autosaving on
 * every keystroke would persist half-typed scenarios.
 *
 * Signed out, the control is the sign-in prompt itself (a disabled button would
 * swallow the click and leave no way forward). Signed in, a loaded comparison
 * saves in place; unsaved work is named first, exactly like a saved mix.
 */
export function SaveComparisonButton() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session)

  const list = useSavedComparisons(signedIn)
  const saveComparison = useSaveComparison()
  const deleteComparison = useDeleteComparison()

  const loadedComparisonId = useComparisonStore((s) => s.loadedComparisonId)
  const loadedComparisonLabel = useComparisonStore((s) => s.loadedComparisonLabel)
  const markComparisonSaved = useComparisonStore((s) => s.markComparisonSaved)
  const dirty = useComparisonStore((s) => isComparisonDirty(s))
  const saveRequested = useComparisonStore((s) => s.saveComparisonRequested)
  const clearSaveRequest = useComparisonStore((s) => s.clearSaveComparisonRequest)

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const comparisons = list.data?.comparisons ?? []
  const count = comparisons.length
  const max = list.data?.max ?? 4
  const atCap = count >= max
  const loadedComparison = loadedComparisonId
    ? (comparisons.find((item) => item.id === loadedComparisonId) ?? null)
    : null
  const blockedByCap = atCap && !loadedComparisonId
  const duplicateLabel = isComparisonLabelTaken(comparisons, label, loadedComparisonId)
  const duplicateName = duplicateLabel || (open && notice === 'duplicate')
  const savedClean = Boolean(loadedComparisonId) && !dirty

  function snapshot() {
    return serializeComparisonSnapshot(useComparisonStore.getState())
  }

  function openDialog() {
    setLabel(loadedComparisonLabel ?? loadedComparison?.label ?? '')
    setNotice(null)
    setOpen(true)
  }

  async function saveExisting() {
    const labelToUse = loadedComparisonLabel ?? loadedComparison?.label
    if (!loadedComparisonId || !labelToUse) {
      openDialog()
      return
    }
    setNotice(null)
    try {
      const saved = await saveComparison.mutateAsync({
        id: loadedComparisonId,
        label: labelToUse,
        snapshot: snapshot(),
      })
      markComparisonSaved(saved.id, saved.label)
      setNotice('saved')
    } catch (error) {
      setNotice(saveErrorNotice(error))
    }
  }

  function handleSaveClick() {
    if (loadedComparisonId) void saveExisting()
    else openDialog()
  }

  // The unsaved-changes dialog's Save routes through this control, so there is
  // exactly one save surface that knows the loaded comparison and its name.
  useEffect(() => {
    // A request made while signed out waits for the session: the visitor is
    // sent to login first, and the dialog opens when they come back.
    if (!saveRequested || !signedIn) return
    clearSaveRequest()
    if (loadedComparisonId) void saveExisting()
    else openDialog()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the request flag and session drive this
  }, [saveRequested, signedIn, loadedComparisonId, clearSaveRequest])

  async function confirmSave() {
    const fallback = `${t('savedComparisons.defaultLabel')} ${count + 1}`
    setNotice(null)
    try {
      const saved = await saveComparison.mutateAsync({
        id: loadedComparisonId ?? undefined,
        label: label.trim() || loadedComparisonLabel || fallback,
        snapshot: snapshot(),
      })
      markComparisonSaved(saved.id, saved.label)
      setOpen(false)
      setNotice('saved')
    } catch (error) {
      const failure = saveErrorNotice(error)
      if (failure !== 'duplicate') setOpen(false)
      setNotice(failure)
    }
  }

  /** Frees one slot from inside the dialog, so the cap is a path, not a wall. */
  async function removeSavedComparison(comparison: SavedComparison) {
    setDeletingId(comparison.id)
    setNotice(null)
    try {
      await deleteComparison.mutateAsync(comparison.id)
    } catch {
      setNotice('error')
    } finally {
      setDeletingId(null)
    }
  }

  if (sessionPending) {
    return (
      <span
        aria-hidden="true"
        data-testid="save-comparison-placeholder"
        className="compare-save-placeholder"
      >
        {t('savedComparisons.saveAction')}
      </span>
    )
  }

  const saveButton = (
    <button
      type="button"
      data-testid="save-comparison"
      disabled={saveComparison.isPending}
      aria-busy={saveComparison.isPending}
      aria-label={saveComparison.isPending ? t('savedComparisons.saving') : undefined}
      onClick={handleSaveClick}
      className="compare-save-button relative"
    >
      {/* Mid-save the control is exactly as wide as the saved state it is
          about to become, so the header does not jump when it settles. */}
      <PendingContent
        pending={saveComparison.isPending}
        spinnerTestId="save-comparison-spinner"
      >
        {saveComparison.isPending ? (
          <span className="inline-flex items-center gap-1.5">
            {t('savedComparisons.savedState')}
            <FaCheck aria-hidden="true" />
          </span>
        ) : (
          t('savedComparisons.saveAction')
        )}
      </PendingContent>
    </button>
  )

  return (
    <>
      {signedIn ? (
        savedClean ? (
          <span
            role="status"
            data-testid="save-comparison-saved-state"
            className="compare-save-button is-saved"
          >
            {t('savedComparisons.savedState')}
            <FaCheck aria-hidden="true" />
          </span>
        ) : (
          saveButton
        )
      ) : (
        <button
          type="button"
          data-testid="save-comparison-sign-in"
          onClick={() => {
            // Come back to this comparison and open the save dialog once the
            // session exists, instead of asking the visitor to start over.
            markPendingComparisonSave()
            router.push('/login?next=/compare')
          }}
          className="compare-save-button"
        >
          {t('savedComparisons.signIn')}
        </button>
      )}

      {notice === 'cap' && (
        <p role="alert" data-testid="save-comparison-cap" className="compare-save-notice is-error">
          {t('savedComparisons.capReached')}
        </p>
      )}
      {notice === 'duplicate' && !open && (
        <p
          role="alert"
          data-testid="save-comparison-duplicate"
          className="compare-save-notice is-error"
        >
          {t('savedComparisons.duplicateName')}
        </p>
      )}
      {notice === 'error' && (
        <p role="alert" data-testid="save-comparison-error" className="compare-save-notice is-error">
          {t('savedComparisons.saveError')}
        </p>
      )}

      <AppModal
        open={open}
        onOpenChange={setOpen}
        testId="save-comparison-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {loadedComparisonId
              ? t('savedComparisons.renameTitle')
              : t('savedComparisons.saveTitle')}
          </h3>
          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('savedComparisons.labelLabel')}</span>
            <input
              type="text"
              maxLength={60}
              autoFocus
              name="comparison-label"
              data-testid="save-comparison-label"
              placeholder={t('savedComparisons.labelPlaceholder')}
              className="w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value)
                if (notice === 'duplicate') setNotice(null)
              }}
            />
          </label>
          {duplicateName && (
            <p
              role="alert"
              data-testid="save-comparison-duplicate-hint"
              className="mt-3 text-sm text-danger"
            >
              {t('savedComparisons.duplicateName')}
            </p>
          )}
          {blockedByCap && (
            <div
              className="mt-4 rounded-lg border border-danger/40 bg-surface-soft p-3"
              data-testid="save-comparison-cap-panel"
            >
              <p className="text-sm font-medium text-ink">{t('savedComparisons.capReached')}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t('savedComparisons.capRemoveHint')}
              </p>
              <ul className="mt-3 space-y-2">
                {comparisons.map((comparison) => (
                  <li key={comparison.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-ink">{comparison.label}</span>
                    <button
                      type="button"
                      data-testid={`save-comparison-remove-${comparison.id}`}
                      disabled={deletingId === comparison.id}
                      aria-busy={deletingId === comparison.id}
                      onClick={() => void removeSavedComparison(comparison)}
                      className="saved-mix-delete-button inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                    >
                      {deletingId === comparison.id ? (
                        <FaSpinner aria-hidden="true" className="animate-spin" />
                      ) : (
                        <FaRegTrashAlt aria-hidden="true" />
                      )}
                      {t('savedComparisons.removeOne')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 modal-actions modal-actions-reversed">
            <button
              type="button"
              data-testid="save-comparison-cancel"
              className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
              onClick={() => setOpen(false)}
            >
              {t('savedComparisons.cancel')}
            </button>
            <button
              type="button"
              data-testid="save-comparison-confirm"
              disabled={saveComparison.isPending || deleteComparison.isPending || blockedByCap || duplicateName}
              aria-busy={saveComparison.isPending}
              className="relative inline-flex items-center justify-center gap-2 rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmSave}
            >
              <PendingContent
                pending={saveComparison.isPending}
                spinnerTestId="save-comparison-confirm-spinner"
              >
                {t('savedComparisons.confirm')}
              </PendingContent>
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
