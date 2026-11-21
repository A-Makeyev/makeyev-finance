'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LoadingIndicator } from '@/components/ui/LoadingIndicator'
import { useTranslation } from 'react-i18next'
import { FaPlus, FaRegTrashAlt } from 'react-icons/fa'
import {
  MAX_TRACKS,
  TRACK_TYPES,
  defaultResetMonthsFor,
  type AmortizationMethod,
  type TrackType,
} from '@/lib/amortization'
import { DateField } from '@/components/ui/DateField'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { formatAmountWithCaret, formatCurrency, formatGroupedNumber } from '@/lib/format'
import { authClient } from '@/lib/auth-client'
import { Link } from '@/router'
import {
  emptyExistingMortgageTrack,
  linkageForTrackType,
  type ExistingMortgageTrack,
} from './existingMortgage'
import {
  computeRefinance,
  type FeeMode,
  type RefinanceProjection,
} from './computeRefinance'
import {
  addProposedTrack,
  initialProposedTracks,
  parseNumericText,
  proposedTracksFromSavedMix,
  proposedTracksFromSnapshot,
  removeProposedTrack,
  toProposedTrackInputs,
  type ProposedTrackState,
} from './proposedTrack'
import { SaveRefinanceButton, type LoadedRefinance } from './SaveRefinanceButton'
import { useSavedMixes } from '@/features/mixes/api'
import { useSavedRefinances, type SavedRefinance } from '@/features/refinances/api'

/**
 * Keep-versus-refinance.
 *
 * The existing side is entered from a verified payoff statement: current
 * balance, current rate, remaining payments, track type and method. A field
 * that is not entered stays null and blocks the projection instead of being
 * guessed. The proposed side is one or more new unlinked tracks; their SHARES
 * split the total known balance (plus a capitalized fee), so the proposal is
 * always reconciled to the payoff figure. The verified fee is paid either in
 * cash or capitalized once into the principal.
 *
 * A saved mix can be loaded as the proposal's shape: its proportions become
 * the shares, and its rates, terms and methods are kept. Saving the proposal
 * stores the whole page (existing tracks, proposed tracks, fee) in the caller's
 * own saved-refinance collection.
 *
 * Rate resets are reset-aware on both sides: the existing tracks reset on
 * their recorded next/last reset date and cadence (counted from today's
 * as-of payment), and the proposed tracks on their own new cadence. The rate
 * change at each reset is the user's stated assumption, defaulting to 0, which
 * holds every current rate flat. The page states that assumption.
 */

/** The local calendar day, as the date-only string the projection expects. */
function todayDateOnly(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function signedCurrency(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatCurrency(Math.abs(value))}`
}

/** Text stays text while the user types, so a decimal point is never eaten.
 *  Money fields also get the calculator's live thousands grouping, with the
 *  caret kept where the same digit count was before the reformat. */
function NumberField({
  value,
  onChange,
  testId,
  inputMode = 'decimal',
  suffix,
  grouped = false,
}: {
  value: number | null
  onChange: (value: number | null) => void
  testId: string
  inputMode?: 'decimal' | 'numeric'
  suffix?: string
  grouped?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const caretRef = useRef<number | null>(null)
  const [text, setText] = useState(() =>
    value === null ? '' : grouped ? formatGroupedNumber(value) : String(value),
  )

  useLayoutEffect(() => {
    if (caretRef.current === null || !inputRef.current) return
    inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  })

  return (
    <span className="input-wrap">
      <input
        ref={inputRef}
        inputMode={inputMode}
        data-testid={testId}
        value={text}
        onChange={(event) => {
          if (!grouped) {
            setText(event.target.value)
            onChange(parseNumericText(event.target.value))
            return
          }
          const element = event.target
          const result = formatAmountWithCaret(element.value, element.selectionStart)
          element.value = result.text
          caretRef.current = result.caret
          if (result.caret !== null) element.setSelectionRange(result.caret, result.caret)
          setText(result.text)
          onChange(parseNumericText(result.text))
        }}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  )
}

/** A controlled text field for the proposed side's text-backed state. */
function TextField({
  value,
  onChange,
  testId,
  inputMode = 'decimal',
  suffix,
}: {
  value: string
  onChange: (value: string) => void
  testId: string
  inputMode?: 'decimal' | 'numeric'
  suffix?: string
}) {
  return (
    <span className="input-wrap">
      <input
        inputMode={inputMode}
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {suffix && <span>{suffix}</span>}
    </span>
  )
}

export function RefinancePage() {
  const { t } = useTranslation()
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session)

  const [tracks, setTracks] = useState<ExistingMortgageTrack[]>(() => [
    {
      ...emptyExistingMortgageTrack('track-1'),
      type: 'fixed',
      linkage: 'unlinked',
      method: 'spitzer',
    },
  ])
  const [proposedTracks, setProposedTracks] = useState<ProposedTrackState[]>(() =>
    initialProposedTracks(1),
  )
  const [feeText, setFeeText] = useState('')
  const [feeMode, setFeeMode] = useState<FeeMode>('cash')
  const [resetStepText, setResetStepText] = useState('0')
  // The projection starts at the as-of payment, so the date stays fixed for
  // the session even if the user leaves the tab open past midnight.
  const [asOfDate] = useState(todayDateOnly)
  const [loadedRefinance, setLoadedRefinance] = useState<LoadedRefinance | null>(null)

  const savedMixes = useSavedMixes(signedIn)
  const mixes = savedMixes.data?.mixes ?? []

  // Saved-proposal deep link (?refinance=<id>): opening a card navigates here
  // rather than pushing state around, so a refresh or bookmark reloads it.
  const [deepLinkId, setDeepLinkId] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('refinance')
    if (id) setDeepLinkId(id)
  }, [])
  const savedRefinances = useSavedRefinances(Boolean(deepLinkId) && signedIn)
  const deepLinkLoaded = useRef(false)

  useEffect(() => {
    document.title = t('refinance.metaTitle')
  }, [t])

  function applySavedRefinance(saved: SavedRefinance) {
    setTracks(saved.snapshot.existingTracks.map((track) => ({ ...track })))
    setProposedTracks(
      proposedTracksFromSnapshot(saved.snapshot.proposedTracks),
    )
    setFeeText(saved.snapshot.feeAmount > 0 ? formatGroupedNumber(saved.snapshot.feeAmount) : '')
    setFeeMode(saved.snapshot.feeMode)
    // Proposals saved before the assumption existed load flat.
    setResetStepText(String(saved.snapshot.existingResetStepPercent ?? 0))
    setLoadedRefinance({ id: saved.id, label: saved.label })
  }

  useEffect(() => {
    if (deepLinkLoaded.current || !deepLinkId || !savedRefinances.data) return
    const saved = savedRefinances.data.refinances.find((item) => item.id === deepLinkId)
    if (!saved) return
    deepLinkLoaded.current = true
    applySavedRefinance(saved)
  }, [deepLinkId, savedRefinances.data])

  const feeAmount = Math.max(0, parseNumericText(feeText) ?? 0)
  // A blank assumption means "no change"; the field is an assumption, not a
  // required loan figure, so it does not block the projection.
  const resetStepPercent = parseNumericText(resetStepText) ?? 0

  const projection = useMemo<RefinanceProjection>(
    () =>
      computeRefinance({
        existingLabel: t('refinance.existingLabel'),
        proposedLabel: t('refinance.proposedLabel'),
        tracks,
        proposedTracks: toProposedTrackInputs(proposedTracks),
        feeAmount,
        feeMode,
        asOfDate,
        resetStepPercent,
      }),
    [tracks, proposedTracks, feeAmount, feeMode, asOfDate, resetStepPercent, t],
  )

  function patchTrack(id: string, patch: Partial<ExistingMortgageTrack>) {
    setTracks((current) =>
      current.map((track) => (track.id === id ? { ...track, ...patch } : track)),
    )
  }

  function addTrack() {
    setTracks((current) =>
      current.length >= MAX_TRACKS
        ? current
        : [
            ...current,
            {
              ...emptyExistingMortgageTrack(`track-${crypto.randomUUID()}`),
              type: 'fixed',
              linkage: 'unlinked',
              method: 'spitzer',
            },
          ],
    )
  }

  function removeTrack(id: string) {
    setTracks((current) =>
      current.length <= 1 ? current : current.filter((track) => track.id !== id),
    )
  }

  function patchProposedTrack(id: string, patch: Partial<ProposedTrackState>) {
    setProposedTracks((current) =>
      current.map((track) => (track.id === id ? { ...track, ...patch } : track)),
    )
  }

  function loadSavedMix(id: string) {
    const mix = mixes.find((item) => item.id === id)
    if (!mix) return
    const next = proposedTracksFromSavedMix(mix.tracks)
    if (next.length > 0) setProposedTracks(next)
  }

  /** Hand a saved proposal back to the page (and drop a stale deep link). */
  function handleSaved(saved: LoadedRefinance) {
    setLoadedRefinance(saved)
    const url = new URL(window.location.href)
    if (url.searchParams.get('refinance') !== saved.id) return
    url.searchParams.delete('refinance')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const breakEven = projection.comparison
    ? projection.comparison.breaksEvenImmediately
      ? t('compare.cashFlowBreakEvenImmediate')
      : projection.comparison.breakEvenMonth !== null
        ? t('compare.cashFlowBreakEvenMonth', {
            month: projection.comparison.breakEvenMonth,
            year: Math.ceil(projection.comparison.breakEvenMonth / 12),
          })
        : t('compare.cashFlowBreakEvenNever')
    : null

  const rows = projection.comparison
    ? [
        {
          key: 'firstPayment',
          label: t('compare.cashFlowFirstPayment'),
          value: projection.comparison.firstPaymentDelta,
        },
        {
          key: 'interest',
          label: t('compare.cashFlowInterest'),
          value: projection.comparison.interestDelta,
        },
        {
          key: 'fees',
          label: t('compare.cashFlowFees'),
          value: projection.comparison.feesDelta,
        },
        {
          key: 'balance',
          label: t('compare.cashFlowBalance'),
          value: projection.comparison.balanceDelta,
        },
        {
          key: 'net',
          label: t('compare.cashFlowNet'),
          value: projection.comparison.netCashFlowDelta,
        },
      ]
    : []

  /** A blocking key -> the missing field's label (existing or proposed). */
  function missingFieldLabel(key: string): string {
    const parts = key.split(':')
    if (parts[0] === 'proposed') {
      // proposed:<index>:<field> or proposed:<field>
      return t(`refinance.missing.${parts.length === 2 ? parts[1] : parts[2]}`)
    }
    return t(`refinance.missing.${parts[1]}`)
  }

  const globalProposedMissing = projection.missing.filter(
    (key) => key.startsWith('proposed:') && !/^proposed:\d+:/.test(key),
  )

  return (
    <main className="below-chrome min-h-screen bg-surface-page px-4 pb-20">
      <div className="refinance-shell mx-auto w-full max-w-[1160px]">
        <div className="mb-6">
          <Link to="/compare" className="compare-back mb-4 inline-flex">
            {t('refinance.backToCompare')}
          </Link>
          <h1 className="text-3xl font-bold text-ink">{t('refinance.heading')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {t('refinance.intro')}
          </p>
        </div>

        <div
          className="refinance-columns grid gap-5 lg:grid-cols-2"
          style={{ '--refinance-track-count': Math.max(tracks.length, proposedTracks.length) } as CSSProperties}
        >
          <section className="refinance-column rounded-2xl border border-line-soft bg-surface-card p-5">
            <div className="refinance-column-heading">
            <h2 className="text-lg font-semibold text-ink">{t('refinance.existingHeading')}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t('refinance.existingLead')}</p>
            </div>

            <div className="refinance-track-list mt-4 flex flex-col gap-4">
              {tracks.map((track, index) => {
                const missing = projection.missing.filter((key) =>
                  key.startsWith(`${track.id}:`),
                )
                return (
                  <fieldset
                    key={`${loadedRefinance?.id ?? 'draft'}:${track.id}`}
                    className="rounded-xl border border-line-soft p-4"
                    data-testid={`refinance-track-${index + 1}`}
                  >
                    <legend className="px-2 text-sm font-semibold text-ink">
                      {t('refinance.trackLabel', { index: index + 1 })}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="input-group">
                        {t('refinance.typeLabel')}
                        <FlipSelect
                          value={track.type ?? ''}
                          onChange={(value) => {
                            const type = (value || null) as TrackType | null
                            patchTrack(track.id, {
                              type,
                              linkage: linkageForTrackType(type),
                            })
                          }}
                          testId={`refinance-type-${index + 1}`}
                        >
                          <option value="">{t('refinance.unknownOption')}</option>
                          {TRACK_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {t(`calculator.trackTypes.${type}`)}
                            </option>
                          ))}
                        </FlipSelect>
                      </label>
                      <label className="input-group">
                        {t('refinance.balanceLabel')}
                        <NumberField
                          testId={`refinance-balance-${index + 1}`}
                          value={track.currentBalance}
                          onChange={(value) => patchTrack(track.id, { currentBalance: value })}
                          suffix="₪"
                          grouped
                        />
                      </label>
                      <label className="input-group">
                        {t('refinance.rateLabel')}
                        <NumberField
                          testId={`refinance-rate-${index + 1}`}
                          value={track.contractedAnnualRate}
                          onChange={(value) =>
                            patchTrack(track.id, { contractedAnnualRate: value })
                          }
                          suffix="%"
                        />
                      </label>
                      <label className="input-group">
                        {t('refinance.remainingLabel')}
                        <NumberField
                          testId={`refinance-remaining-${index + 1}`}
                          inputMode="numeric"
                          value={track.remainingMonths}
                          onChange={(months) =>
                            patchTrack(track.id, {
                              remainingMonths:
                                months === null ? null : Math.max(1, Math.round(months)),
                            })
                          }
                          suffix={t('refinance.monthsSuffix')}
                        />
                      </label>
                      <label className="input-group sm:col-span-2">
                        {t('refinance.methodLabel')}
                        <FlipSelect
                          value={track.method ?? ''}
                          onChange={(value) =>
                            patchTrack(track.id, {
                              method: (value || null) as AmortizationMethod | null,
                            })
                          }
                          testId={`refinance-method-${index + 1}`}
                        >
                          <option value="">{t('refinance.unknownOption')}</option>
                          <option value="spitzer">{t('calculator.track.methodSpitzer')}</option>
                          <option value="equalPrincipal">
                            {t('calculator.track.methodEqualPrincipal')}
                          </option>
                        </FlipSelect>
                      </label>
                      {/* Only a track with a contractual reset has a next
                          reset date to record. Fixed and prime tracks hide
                          it instead of showing a field that cannot apply. */}
                      {defaultResetMonthsFor(track.type ?? 'fixed') > 0 && (
                        <label className="input-group sm:col-span-2">
                          {t('refinance.nextResetLabel')}
                          <span className="input-wrap">
                            <DateField
                              value={track.nextRateResetDate ?? ''}
                              onChange={(value) =>
                                patchTrack(track.id, { nextRateResetDate: value || null })
                              }
                              placeholder={t('calculator.approvalDateFormat')}
                              describedBy={`refinance-next-reset-hint-${index + 1}`}
                              testId={`refinance-next-reset-${index + 1}`}
                            />
                          </span>
                          <span
                            id={`refinance-next-reset-hint-${index + 1}`}
                            className="visually-hidden"
                          >
                            {t('refinance.nextResetHint')}
                          </span>
                        </label>
                      )}
                    </div>
                    {missing.length > 0 && (
                      <p className="mt-2 text-xs text-danger" role="status">
                        {t('refinance.missingLine', {
                          fields: missing.map(missingFieldLabel).join(', '),
                        })}
                      </p>
                    )}
                    {tracks.length > 1 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
                        onClick={() => removeTrack(track.id)}
                      >
                        <FaRegTrashAlt aria-hidden="true" />
                        {t('refinance.removeTrack')}
                      </button>
                    )}
                  </fieldset>
                )
              })}
            </div>

            <div className="refinance-column-footer">
            {tracks.length < MAX_TRACKS && (
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink"
                onClick={addTrack}
              >
                <FaPlus aria-hidden="true" />
                {t('refinance.addTrack')}
              </button>
            )}
            </div>
          </section>

          <section className="refinance-column rounded-2xl border border-line-soft bg-surface-card p-5">
            <div className="refinance-column-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('refinance.proposedHeading')}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t('refinance.proposedLead')}</p>
                {loadedRefinance && (
                  <p className="mt-2 text-xs text-ink-muted" data-testid="refinance-editing-proposal">
                    {t('refinance.editingProposal')}: <strong>{loadedRefinance.label}</strong>
                  </p>
                )}
              </div>
              <SaveRefinanceButton
                existingTracks={tracks}
                proposedTracks={proposedTracks}
                feeAmount={feeAmount}
                feeMode={feeMode}
                resetStepPercent={resetStepPercent}
                loadedRefinance={loadedRefinance}
                onSaved={handleSaved}
                onDeletedLoaded={() => setLoadedRefinance(null)}
              />
            </div>

            {/* Load the proposal's shape from a saved mix. Only the proportions,
                rates, terms and methods are used; the principal still comes
                from the existing balances. Hidden when there is nothing to
                load, so no empty box sits in the form. */}
            {signedIn && (savedMixes.isPending || savedMixes.isError || mixes.length > 0) && (
              <div className="mt-4 flex min-h-24 flex-col justify-center rounded-xl border border-line-soft p-3">
                {savedMixes.isPending ? (
                  <LoadingIndicator label={t('refinance.loadMixLoading')} className="w-full" />
                ) : savedMixes.isError ? (
                  <p role="alert" className="text-xs text-danger">
                    {t('refinance.loadMixError')}
                  </p>
                ) : (
                  <label className="input-group">
                    {t('refinance.loadMixLabel')}
                    <FlipSelect
                      value=""
                      onChange={loadSavedMix}
                      testId="refinance-load-mix"
                    >
                      <option value="">{t('refinance.loadMixPlaceholder')}</option>
                      {mixes.map((mix) => (
                        <option key={mix.id} value={mix.id}>
                          {mix.label}
                        </option>
                      ))}
                    </FlipSelect>
                  </label>
                )}
              </div>
            )}
            </div>

            <div className="refinance-track-list mt-4 flex flex-col gap-4">
              {proposedTracks.map((track, index) => {
                const missing = projection.missing.filter((key) =>
                  key.startsWith(`proposed:${index}:`),
                )
                const amount = projection.proposedAllocations[index] ?? 0
                return (
                  <fieldset
                    key={track.id}
                    className="rounded-xl border border-line-soft p-4"
                    data-testid={`refinance-proposed-track-${index + 1}`}
                  >
                    <legend className="px-2 text-sm font-semibold text-ink">
                      {t('refinance.trackLabel', { index: index + 1 })}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="input-group">
                        {t('refinance.typeLabel')}
                        <FlipSelect
                          value={track.type}
                          onChange={(value) => {
                            const type = value as TrackType
                            patchProposedTrack(track.id, {
                              type,
                              resetMonths: defaultResetMonthsFor(type),
                            })
                          }}
                          testId={`refinance-proposed-type-${index + 1}`}
                        >
                          {TRACK_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {t(`calculator.trackTypes.${type}`)}
                            </option>
                          ))}
                        </FlipSelect>
                      </label>
                      <label className="input-group">
                        {t('refinance.shareLabel')}
                        <TextField
                          testId={`refinance-proposed-share-${index + 1}`}
                          value={track.shareText}
                          onChange={(value) => patchProposedTrack(track.id, { shareText: value })}
                          suffix="%"
                        />
                      </label>
                      <label className="input-group">
                        {t('refinance.newRateLabel')}
                        <TextField
                          testId={
                            index === 0
                              ? 'refinance-new-rate'
                              : `refinance-proposed-rate-${index + 1}`
                          }
                          value={track.rateText}
                          onChange={(value) => patchProposedTrack(track.id, { rateText: value })}
                          suffix="%"
                        />
                      </label>
                      <label className="input-group">
                        {t('refinance.newTermLabel')}
                        <TextField
                          testId={
                            index === 0
                              ? 'refinance-new-term'
                              : `refinance-proposed-term-${index + 1}`
                          }
                          inputMode="numeric"
                          value={track.yearsText}
                          onChange={(value) => patchProposedTrack(track.id, { yearsText: value })}
                          suffix={t('refinance.yearsSuffix')}
                        />
                      </label>
                      <label className="input-group sm:col-span-2">
                        {t('refinance.methodLabel')}
                        <FlipSelect
                          value={track.method}
                          onChange={(value) =>
                            patchProposedTrack(track.id, {
                              method: value as AmortizationMethod,
                            })
                          }
                          testId={
                            index === 0
                              ? 'refinance-new-method'
                              : `refinance-proposed-method-${index + 1}`
                          }
                        >
                          <option value="spitzer">{t('calculator.track.methodSpitzer')}</option>
                          <option value="equalPrincipal">
                            {t('calculator.track.methodEqualPrincipal')}
                          </option>
                        </FlipSelect>
                      </label>
                    </div>
                    {amount > 0 && (
                      <p
                        className="mt-2 text-xs text-ink-muted"
                        data-testid={`refinance-proposed-amount-${index + 1}`}
                      >
                        {t('refinance.proposedAmount')}: {formatCurrency(amount)}
                      </p>
                    )}
                    {missing.length > 0 && (
                      <p className="mt-2 text-xs text-danger" role="status">
                        {t('refinance.missingLine', {
                          fields: missing.map(missingFieldLabel).join(', '),
                        })}
                      </p>
                    )}
                    {proposedTracks.length > 1 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
                        onClick={() => setProposedTracks(removeProposedTrack(proposedTracks, track.id))}
                      >
                        <FaRegTrashAlt aria-hidden="true" />
                        {t('refinance.removeTrack')}
                      </button>
                    )}
                  </fieldset>
                )
              })}
            </div>

            <div className="refinance-column-footer">
            {proposedTracks.length < MAX_TRACKS && (
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink"
                onClick={() => setProposedTracks(addProposedTrack(proposedTracks))}
                data-testid="refinance-add-proposed-track"
              >
                <FaPlus aria-hidden="true" />
                {t('refinance.addTrack')}
              </button>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="input-group sm:col-span-2">
                {t('refinance.feeLabel')}
                <MoneyInput
                  testId="refinance-fee"
                  value={feeText}
                  suffix="₪"
                  onChange={(raw, caret) => {
                    const result = formatAmountWithCaret(raw, caret)
                    setFeeText(result.text)
                    return result
                  }}
                />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm text-ink-muted">{t('refinance.feeModeLabel')}</legend>
                <div className="mt-2 flex flex-wrap gap-4">
                  {(['cash', 'capitalized'] as const).map((mode) => (
                    <label key={mode} className="inline-flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="fee-mode"
                        value={mode}
                        checked={feeMode === mode}
                        onChange={() => setFeeMode(mode)}
                      />
                      {t(mode === 'cash' ? 'refinance.feeCash' : 'refinance.feeCapitalized')}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t('refinance.feeHint')}</p>
            {projection.ready && (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t('refinance.totalBalance')}</dt>
                  <dd className="font-semibold text-ink">{formatCurrency(projection.totalBalance)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t('refinance.proposedPrincipal')}</dt>
                  <dd
                    className="font-semibold text-ink"
                    data-testid="refinance-proposed-principal"
                  >
                    {formatCurrency(projection.proposedPrincipal)}
                  </dd>
                </div>
              </dl>
            )}

            {globalProposedMissing.length > 0 && (
              <p className="mt-3 text-xs text-danger" role="status">
                {t('refinance.missingLine', {
                  fields: globalProposedMissing.map(missingFieldLabel).join(', '),
                })}
              </p>
            )}
            </div>
          </section>
        </div>

        {/* The forecast assumption applies to BOTH sides: applying a rate
            rise only to the existing mortgage would bias the comparison. */}
        <div className="mt-5 rounded-2xl border border-line-soft bg-surface-card p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h2 className="text-base font-semibold text-ink">
                {t('refinance.resetHeading')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {t('refinance.resetHint')}
              </p>
            </div>
            <label className="input-group sm:w-48">
              {t('refinance.resetStepLabel')}
              <TextField
                testId="refinance-reset-step"
                value={resetStepText}
                onChange={setResetStepText}
                suffix={t('refinance.resetStepSuffix')}
              />
            </label>
          </div>
          {projection.missing.includes('resetStep:invalid') && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {t('refinance.resetStepInvalid')}
            </p>
          )}
        </div>

        {projection.ready && projection.existing && projection.proposed ? (
          <section className="mt-6" data-testid="refinance-results">
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-line-soft bg-surface-card p-5">
                <h2 className="text-base font-semibold text-ink">{t('refinance.existingLabel')}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.existingPayment')}</dt>
                    <dd className="font-semibold text-ink" data-testid="refinance-existing-payment">
                      {formatCurrency(projection.existing.monthlyPayment)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.existingInterest')}</dt>
                    <dd className="font-semibold text-ink" data-testid="refinance-existing-interest">
                      {formatCurrency(projection.existing.totalInterest)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.termLabel')}</dt>
                    <dd className="font-semibold text-ink">
                      {t('refinance.monthsValue', { months: projection.existing.termMonths })}
                    </dd>
                  </div>
                </dl>
              </article>
              <article className="rounded-2xl border border-line-soft bg-surface-card p-5">
                <h2 className="text-base font-semibold text-ink">{t('refinance.proposedLabel')}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.proposedPayment')}</dt>
                    <dd className="font-semibold text-ink">
                      {formatCurrency(projection.proposed.monthlyPayment)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.proposedInterest')}</dt>
                    <dd className="font-semibold text-ink">
                      {formatCurrency(projection.proposed.totalInterest)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.termLabel')}</dt>
                    <dd className="font-semibold text-ink">
                      {t('refinance.monthsValue', { months: projection.proposed.termMonths })}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>

            <section className="compare-cashflow mt-6" data-testid="refinance-comparison">
              <h2>{t('refinance.comparisonHeading')}</h2>
              <p className="compare-cashflow-lead">{t('refinance.comparisonLead')}</p>
              <article className="compare-cashflow-card">
                <dl className="compare-cashflow-metrics">
                  {rows.map((row) => (
                    <div key={row.key}>
                      <dt>{row.label}</dt>
                      <dd
                        className={
                          row.value > 0 ? 'is-positive' : row.value < 0 ? 'is-negative' : 'is-even'
                        }
                        data-testid={`refinance-cashflow-${row.key}`}
                      >
                        {signedCurrency(row.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="compare-cashflow-break-even" data-testid="refinance-break-even">
                  {breakEven}
                </p>
              </article>
              <p className="compare-cashflow-note">{t('refinance.comparisonNote')}</p>
            </section>
          </section>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-ink-muted">{t('refinance.disclaimer')}</p>
      </div>
    </main>
  )
}
