'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCheck, FaRegTrashAlt, FaSpinner } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { PendingContent } from '@/components/ui/PendingContent'
import { authClient } from '@/lib/auth-client'
import { useRouter } from '@/router'
import type { ExistingMortgageTrack } from './existingMortgage'
import type { FeeMode } from './computeRefinance'
import { buildRefinanceSnapshot } from './snapshot'
import { toProposedTrackInputs, type ProposedTrackState } from './proposedTrack'
import {
  isRefinanceLabelTaken,
  useDeleteRefinance,
  useSaveRefinance,
  useSavedRefinances,
  type SavedRefinance,
} from '@/features/refinances/api'

const TOAST_MS = 1800

type Notice = 'saved' | 'cap' | 'duplicate' | 'error' | null

function saveErrorNotice(error: unknown): 'cap' | 'duplicate' | 'error' {
  if (!(error instanceof Error)) return 'error'
  if (error.message === 'cap') return 'cap'
  if (error.message === 'duplicate') return 'duplicate'
  return 'error'
}

export interface LoadedRefinance {
  id: string
  label: string
}

/**
 * The refinance page's save control.
 *
 * A proposal is savable only once its proposed side is completely entered
 * (every share, rate and term is a real number). A loaded proposal saves in
 * place; a new one is named first. Signed out, the control is the sign-in
 * prompt itself, like the calculator's and compare page's save controls.
 *
 * At the cap the control still opens the dialog, which lists the saved
 * proposals with a delete action: "remove one to add another" is a path, not a
 * dead end.
 */
export function SaveRefinanceButton({
  existingTracks,
  proposedTracks,
  feeAmount,
  feeMode,
  resetStepPercent,
  loadedRefinance,
  onSaved,
  onDeletedLoaded,
}: {
  existingTracks: ExistingMortgageTrack[]
  proposedTracks: ProposedTrackState[]
  feeAmount: number
  feeMode: FeeMode
  resetStepPercent: number
  loadedRefinance: LoadedRefinance | null
  onSaved: (saved: LoadedRefinance) => void
  onDeletedLoaded: () => void
}) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session)

  const list = useSavedRefinances(signedIn)
  const saveRefinance = useSaveRefinance()
  const deleteRefinance = useDeleteRefinance()

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (notice !== 'saved') return
    setToastVisible(true)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastVisible(false), TOAST_MS)
  }, [notice])

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const proposals = list.data?.refinances ?? []
  const count = proposals.length
  const max = list.data?.max ?? 4
  const atCap = count >= max
  const snapshot = buildRefinanceSnapshot({
    existingTracks,
    proposedTracks: toProposedTrackInputs(proposedTracks),
    feeAmount,
    feeMode,
    existingResetStepPercent: resetStepPercent,
  })
  const canSave = snapshot !== null
  const blockedByCap = atCap && !loadedRefinance
  const duplicateName =
    isRefinanceLabelTaken(proposals, label, loadedRefinance?.id) ||
    (open && notice === 'duplicate')

  function openDialog() {
    setLabel(loadedRefinance?.label ?? '')
    setNotice(null)
    setOpen(true)
  }

  async function saveExisting() {
    if (!loadedRefinance || !snapshot) return
    setNotice(null)
    try {
      const saved = await saveRefinance.mutateAsync({
        id: loadedRefinance.id,
        label: loadedRefinance.label,
        snapshot,
      })
      onSaved({ id: saved.id, label: saved.label })
      setNotice('saved')
    } catch (error) {
      setNotice(saveErrorNotice(error))
    }
  }

  function handleSaveClick() {
    if (loadedRefinance) void saveExisting()
    else openDialog()
  }

  async function confirmSave() {
    if (!snapshot) return
    setNotice(null)
    try {
      const saved = await saveRefinance.mutateAsync({
        id: loadedRefinance?.id,
        label:
          label.trim() ||
          loadedRefinance?.label ||
          `${t('savedRefinances.defaultLabel')} ${count + 1}`,
        snapshot,
      })
      onSaved({ id: saved.id, label: saved.label })
      setOpen(false)
      setNotice('saved')
    } catch (error) {
      const failure = saveErrorNotice(error)
      if (failure !== 'duplicate') setOpen(false)
      setNotice(failure)
    }
  }

  async function removeProposal(proposal: SavedRefinance) {
    setDeletingId(proposal.id)
    setNotice(null)
    try {
      await deleteRefinance.mutateAsync(proposal.id)
      if (proposal.id === loadedRefinance?.id) onDeletedLoaded()
    } catch {
      setNotice('error')
    } finally {
      setDeletingId(null)
    }
  }

  if (sessionPending) {
    return (
      <span aria-hidden="true" className="compare-save-placeholder">
        {t('savedRefinances.signIn')}
      </span>
    )
  }

  return (
    <>
      {signedIn ? (
        <button
          type="button"
          data-testid="save-refinance"
          disabled={!canSave || saveRefinance.isPending}
          aria-busy={saveRefinance.isPending}
          aria-label={saveRefinance.isPending ? t('savedRefinances.saving') : undefined}
          onClick={handleSaveClick}
          className="compare-save-button relative"
        >
          <PendingContent
            pending={saveRefinance.isPending}
            spinnerTestId="save-refinance-spinner"
          >
            {t('savedRefinances.saveAction')}
          </PendingContent>
        </button>
      ) : (
        <button
          type="button"
          data-testid="save-refinance-sign-in"
          onClick={() => router.push('/login?next=/refinance')}
          className="compare-save-button"
        >
          {t('savedRefinances.signIn')}
        </button>
      )}

      {notice === 'saved' && (
        <div
          aria-live="polite"
          data-testid="save-refinance-saved"
          className={`pointer-events-none fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 transition-opacity duration-300 ${
            toastVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex max-w-[min(92vw,26rem)] items-center gap-2.5 whitespace-nowrap rounded-full bg-ink/90 px-5 py-2.5 text-[14px] font-semibold text-surface-card shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] backdrop-blur-sm">
            <FaCheck aria-hidden="true" className="text-[13px] text-soft-blue" />
            <span className="min-w-0 truncate">{t('savedRefinances.saved')}</span>
          </div>
        </div>
      )}
      {notice === 'error' && (
        <p role="alert" data-testid="save-refinance-error" className="save-mix-notice is-error">
          {t('savedRefinances.saveError')}
        </p>
      )}
      {notice === 'cap' && (
        <p role="alert" data-testid="save-refinance-cap" className="save-mix-notice is-error">
          {t('savedRefinances.capReached')}
        </p>
      )}

      <AppModal
        open={open}
        onOpenChange={setOpen}
        testId="save-refinance-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[460px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {t('savedRefinances.saveTitle')}
          </h3>

          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('savedRefinances.labelLabel')}</span>
            <input
              type="text"
              maxLength={60}
              autoFocus
              name="refinance-label"
              data-testid="save-refinance-label"
              placeholder={t('savedRefinances.labelPlaceholder')}
              className="w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value)
                if (notice === 'duplicate') setNotice(null)
              }}
            />
          </label>
          {duplicateName && (
            <p role="alert" data-testid="save-refinance-duplicate" className="mt-3 text-sm text-danger">
              {t('savedRefinances.duplicateName')}
            </p>
          )}

          {atCap && !loadedRefinance && (
            <div
              className="mt-4 rounded-lg border border-danger/40 bg-surface-soft p-3"
              data-testid="save-refinance-cap-panel"
            >
              <p className="text-sm font-medium text-ink">{t('savedRefinances.capReached')}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t('savedRefinances.capRemoveHint')}
              </p>
              <ul className="mt-3 space-y-2">
                {proposals.map((proposal) => (
                  <li key={proposal.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-ink">{proposal.label}</span>
                    <button
                      type="button"
                      data-testid={`save-refinance-remove-${proposal.id}`}
                      disabled={deletingId === proposal.id}
                      aria-busy={deletingId === proposal.id}
                      onClick={() => void removeProposal(proposal)}
                      className="saved-mix-delete-button inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-60"
                    >
                      {deletingId === proposal.id ? (
                        <FaSpinner aria-hidden="true" className="animate-spin" />
                      ) : (
                        <FaRegTrashAlt aria-hidden="true" />
                      )}
                      {t('savedRefinances.removeOne')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 modal-actions modal-actions-reversed">
            <button
              type="button"
              data-testid="save-refinance-cancel"
              className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
              onClick={() => setOpen(false)}
            >
              {t('savedRefinances.cancel')}
            </button>
            <button
              type="button"
              data-testid="save-refinance-confirm"
              disabled={!canSave || saveRefinance.isPending || deleteRefinance.isPending || blockedByCap || duplicateName}
              aria-busy={saveRefinance.isPending}
              aria-label={saveRefinance.isPending ? t('savedRefinances.saving') : undefined}
              className="relative inline-flex items-center justify-center gap-2 rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmSave}
            >
              <PendingContent
                pending={saveRefinance.isPending}
                spinnerTestId="save-refinance-confirm-spinner"
              >
                {t('savedRefinances.confirm')}
              </PendingContent>
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
