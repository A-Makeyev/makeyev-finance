'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaCheck, FaSpinner } from 'react-icons/fa'
import { AppModal } from '@/components/ui/AppModal'
import { authClient } from '@/lib/auth-client'
import { Link, useRouter } from '@/router'
import {
  isMixDirty,
  serializeSavableTracks,
  serializeScenario,
  useCalculatorStore,
} from '@/stores/calculatorStore'
import { useSaveMix, useSavedMixes } from './api'

/** How long the "mix saved" toast stays up before fading. */
const TOAST_MS = 1800

/**
 * The calculator's "save this mix" control, shown beside the results cards.
 *
 * Manual by design (not autosave): the store recalculates on every keystroke,
 * so autosave would either flood the collection or need debounce logic that is
 * easy to get subtly wrong (persisting a half-typed mix). A click is a clear
 * intent - "I want to keep this".
 *
 * Signed out, the control is the sign-in prompt itself rather than a disabled
 * button: a real `disabled` attribute would swallow the click and strand a
 * signed-out visitor with no way forward.
 */
export function SaveMixButton() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session)

  const tracks = useCalculatorStore((s) => s.tracks)
  const termYears = useCalculatorStore((s) => s.termYears)
  const markMixSaved = useCalculatorStore((s) => s.markMixSaved)
  const loadedMixId = useCalculatorStore((s) => s.loadedMixId)
  const mixDirty = useCalculatorStore((s) => isMixDirty(s))
  const saveMixRequested = useCalculatorStore((s) => s.saveMixRequested)
  const clearSaveMixRequest = useCalculatorStore((s) => s.clearSaveMixRequest)

  const mixesQuery = useSavedMixes(signedIn)
  const saveMix = useSaveMix()

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [notice, setNotice] = useState<'saved' | 'cap' | 'error' | null>(null)
  // The save confirmation is a self-dismissing toast, not an inline line that
  // lingers under the button: it reports an event, so it should fade like the
  // other confirmations (wishlist, comment delete) rather than sit there.
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef<number | null>(null)

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

  const count = mixesQuery.data?.mixes.length ?? 0
  const max = mixesQuery.data?.max ?? 5
  const atCap = count >= max
  const loadedMix = loadedMixId
    ? (mixesQuery.data?.mixes.find((mix) => mix.id === loadedMixId) ?? null)
    : null
  // Updating the loaded mix uses no new slot, so the cap only blocks creates.
  const blockedByCap = atCap && !loadedMixId

  // Only entered tracks are savable; the server also requires every track to
  // hold a positive amount.
  const savableTracks = serializeSavableTracks(tracks)
  const canSave = savableTracks.length > 0
  // A stored mix with no edits since its load/save has nothing to write. The
  // control then reports that state instead of offering an action that would
  // either do nothing or silently re-send an identical mix.
  const savedClean = Boolean(loadedMixId) && !mixDirty

  function openDialog() {
    // Updating a loaded mix starts from its own name, so a rename is optional.
    setLabel(loadedMix?.label ?? '')
    setNotice(null)
    setOpen(true)
  }

  /**
   * Overwrites the loaded mix in place, with no naming prompt: it already has a
   * name, so re-asking it would make "save" look like "save as". The button's
   * spinner is the only feedback, followed by the saved toast.
   */
  async function saveExisting() {
    if (!loadedMix) return
    setNotice(null)
    try {
      const saved = await saveMix.mutateAsync({
        id: loadedMix.id,
        label: loadedMix.label,
        tracks: savableTracks,
        termYears,
        scenario: serializeScenario(useCalculatorStore.getState()),
      })
      markMixSaved(saved.id)
      setNotice('saved')
    } catch (error) {
      setNotice(error instanceof Error && error.message === 'cap' ? 'cap' : 'error')
    }
  }

  function handleSaveClick() {
    // An existing mix saves straight through; a new one is named first.
    if (loadedMix) void saveExisting()
    else openDialog()
  }

  // The unsaved-changes dialog's Save button routes through this control (the
  // one save surface); the request is cleared as soon as it is handled.
  useEffect(() => {
    if (!saveMixRequested) return
    clearSaveMixRequest()
    if (loadedMix) void saveExisting()
    else openDialog()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveExisting is recreated each render; the request flag drives this
  }, [saveMixRequested, loadedMix, clearSaveMixRequest])

  async function confirmSave() {
    const fallback = `${t('savedMixes.defaultLabel')} ${count + 1}`
    try {
      const saved = await saveMix.mutateAsync({
        // A loaded mix is overwritten in place; anything else is a new mix.
        id: loadedMixId ?? undefined,
        label: label.trim() || loadedMix?.label || fallback,
        tracks: savableTracks,
        termYears,
        // The scenario comes from the live store rather than a subscription:
        // it is read once at save time, and re-rendering this control on every
        // scenario keystroke would buy nothing.
        scenario: serializeScenario(useCalculatorStore.getState()),
      })
      // The mix in the editor is now what is stored, so leaving no longer
      // counts as unsaved work; a create adopts its new id so the next save
      // updates it instead of adding a copy.
      markMixSaved(saved.id)
      setOpen(false)
      setNotice('saved')
    } catch (error) {
      setOpen(false)
      setNotice(error instanceof Error && error.message === 'cap' ? 'cap' : 'error')
    }
  }

  // Reserves the button's slot while the session resolves, so the primary
  // action does not jump when the save control appears next to it.
  if (sessionPending) return <span className="save-mix-placeholder" aria-hidden="true" />

  return (
    <>
      {/* The saved mixes live on the profile, so the link sits beside the save
          action that feeds it, in the same button family so the row reads as
          one group. It is shown only to a signed-in visitor: the profile is
          gated, so a signed-out one would just be bounced to login. The count
          rides it in parentheses rather than as a stray line under the
          buttons. It comes BEFORE the save control, which keeps the save
          button the last thing in the row: the save action concludes the row,
          and the pointer to what is already saved reads as leading up to it.
          Flex order is DOM order, so in Hebrew this lands on the right of the
          save button, which is the end of the row in that direction too. */}
      {signedIn && (
        <Link
          to="/profile#saved-mixes"
          data-testid="my-mixes-link"
          className="calculate-button my-mixes-link"
        >
          {t('savedMixes.myMixesLink')}
          <span data-testid="save-mix-count"> ({count}/{max})</span>
        </Link>
      )}

      {signedIn ? (
        savedClean ? (
          // role="status" so the state is announced, not just drawn; it reuses
          // the button's own classes so the row does not reflow when it flips.
          <span
            role="status"
            data-testid="save-mix-saved-state"
            className="calculate-button save-mix-button save-mix-saved-state"
          >
            {/* The mark follows the label, at the end of the text in reading
                order, so it reads "saved +" rather than an icon leading a
                word. Flex order is DOM order, so this lands on the left in
                Hebrew and the right in English, which is the end of the line
                in both. */}
            {t('savedMixes.savedState')}
            <FaCheck aria-hidden="true" />
          </span>
        ) : (
          <button
            type="button"
            data-testid="save-mix"
            disabled={!canSave || blockedByCap || saveMix.isPending}
            aria-busy={saveMix.isPending}
            onClick={handleSaveClick}
            // Same button family as Show payments: identical shape, padding and
            // weight, with the secondary surface treatment from save-mix-button.
            className="calculate-button save-mix-button"
          >{/* The label swaps to "saving..." WITHOUT the button changing width: the
                idle label stays in flow (made invisible mid-save, so it also
                leaves the accessibility tree) and the saving state is laid over
                that same box instead of beside the text. An always-on spinner
                slot was tried first and left dead space in front of the label;
                sizing the button by whichever label happened to be wider would
                have moved the row on every save. */}
            <span className="save-mix-label-swap">
              <span className={saveMix.isPending ? 'invisible' : undefined}>
                {t('savedMixes.saveAction')}
              </span>
              <span className="save-mix-label-swap-active">
                {saveMix.isPending && t('savedMixes.saving')}
                {saveMix.isPending && <FaSpinner aria-hidden="true" className="animate-spin" />}
              </span>
            </span>
          </button>
        )
      ) : (
        <button
          type="button"
          data-testid="save-mix-sign-in"
          onClick={() => router.push('/login?next=/calculators')}
          className="calculate-button save-mix-button"
        >
          {t('savedMixes.signIn')}
        </button>
      )}

      {/* At the cap the save button is disabled; the standing "you can save up
          to N mixes" line was removed (user-requested). A save that still
          fails server-side is reported by the alert below. */}
      {notice === 'saved' && (
        <div
          aria-live="polite"
          data-testid="save-mix-saved"
          className={`pointer-events-none fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 transition-opacity duration-300 ${
            toastVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            dir="auto"
            className="flex max-w-[min(92vw,26rem)] items-center gap-2.5 whitespace-nowrap rounded-full bg-ink/90 px-5 py-2.5 text-[14px] font-semibold text-surface-card shadow-[0_4px_14px_0_rgba(15,15,15,0.35)] backdrop-blur-sm"
          >
            <FaCheck aria-hidden="true" className="text-[13px] text-soft-blue" />
            <span className="min-w-0 truncate">{t('savedMixes.saved')}</span>
          </div>
        </div>
      )}
      {notice === 'cap' && (
        <p role="alert" data-testid="save-mix-cap-notice" className="save-mix-notice is-error">
          {t('savedMixes.capReached')}
        </p>
      )}
      {notice === 'error' && (
        <p role="alert" data-testid="save-mix-error" className="save-mix-notice is-error">
          {t('savedMixes.saveError')}
        </p>
      )}

      <AppModal
        open={open}
        onOpenChange={setOpen}
        testId="save-mix-modal"
        dir={i18n.dir()}
        tone="teal"
        contentClassName="max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
            {t('savedMixes.saveTitle')}
          </h3>
          <label className="flex flex-col gap-1 text-start">
            <span className="text-sm text-ink-muted">{t('savedMixes.labelLabel')}</span>
            <input
              type="text"
              // No dir="auto" here: an empty auto field falls back to LTR, so
              // the Hebrew placeholder sat at the wrong edge. Inheriting the
              // modal's direction aligns the placeholder to the label - right
              // in Hebrew, left in English.
              maxLength={60}
              autoFocus
              name="mix-label"
              data-testid="save-mix-label"
              placeholder={t('savedMixes.labelPlaceholder')}
              className="w-full rounded-lg border border-line-strong bg-surface-page px-3 py-2 text-ink outline-none transition-colors hover:border-ink focus:border-ink"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              data-testid="save-mix-cancel"
              className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
              onClick={() => setOpen(false)}
            >
              {t('savedMixes.cancel')}
            </button>
            <button
              type="button"
              data-testid="save-mix-confirm"
              disabled={saveMix.isPending}
              aria-busy={saveMix.isPending}
              className="inline-flex items-center gap-2 rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={confirmSave}
            >
              {saveMix.isPending && <FaSpinner aria-hidden="true" className="animate-spin" />}
              {t('savedMixes.confirm')}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
