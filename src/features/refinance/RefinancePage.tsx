'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LoadingIndicator } from '@/components/ui/LoadingIndicator'
import { SavedItemsMenu } from '@/components/ui/SavedItemsMenu'
import { useTranslation } from 'react-i18next'
import { FaPlus, FaRegTrashAlt } from 'react-icons/fa'
import {
  MAX_REFINANCE_OFFERS,
  MAX_TRACKS,
  TRACK_TYPES,
  defaultResetMonthsFor,
  type AmortizationMethod,
  type TrackType,
} from '@/lib/amortization'
import { AppModal } from '@/components/ui/AppModal'
import { DateField } from '@/components/ui/DateField'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { formatAmountWithCaret, formatCurrency, formatGroupedNumber } from '@/lib/format'
import { formatDateOnly } from '@/lib/rateValidity'
import { authClient } from '@/lib/auth-client'
import { Link, setNavigationBlockGuard, useNavigate } from '@/router'
import {
  emptyExistingMortgageTrack,
  linkageForTrackType,
  type ExistingMortgageTrack,
} from './existingMortgage'
import {
  computeRefinanceSet,
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
import { TrackMixDonut } from '@/features/calculator/TrackMixDonut'
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
 * A saved mix can be loaded into a proposal's shape: its proportions become
 * the shares, and its rates, terms and methods are kept. Up to
 * MAX_REFINANCE_OFFERS proposals are edited one at a time (tabs) and compared
 * against the same existing side in one results table. One save keeps every
 * proposal with the shared existing side and the shared assumption, and the
 * plan's name is chosen in the save dialog.
 *
 * Rate resets are reset-aware on both sides: the existing tracks reset on
 * their recorded next/last reset date and cadence (counted from today's
 * as-of payment), and the proposed tracks on their own new cadence. The rate
 * change at each reset is the user's stated assumption, defaulting to 0, which
 * holds every current rate flat. The page states that assumption.
 */

/** One proposal being edited: its own tracks, fee and fee payment mode. */
interface ProposalState {
  id: string
  label: string
  tracks: ProposedTrackState[]
  feeText: string
  feeMode: FeeMode
  /** Local calendar day the offer was created; shown under its name. */
  createdOn: string
}

/**
 * The first draft offer's id is fixed: it is rendered into the fee-mode radio
 * names, so a server render and the client hydration must agree on it. Later
 * ids are generated only on the client (add, load), where no hydration
 * comparison happens.
 */
const INITIAL_PROPOSAL_ID = 'proposal-1'
let proposalSequence = 1

function createProposalId(): string {
  proposalSequence += 1
  return `proposal-${proposalSequence}`
}

function createProposalState(id: string = createProposalId()): ProposalState {
  return {
    id,
    label: '',
    tracks: initialProposedTracks(1),
    feeText: '',
    feeMode: 'cash',
    createdOn: todayDateOnly(),
  }
}

function proposalFee(proposal: ProposalState): number {
  return Math.max(0, parseNumericText(proposal.feeText) ?? 0)
}

/** The local calendar day, as the date-only string the projection expects. */
function localDateOnly(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function todayDateOnly(): string {
  return localDateOnly(new Date())
}

/** A saved record's creation timestamp on the viewer's own calendar day. */
function dateOnlyFromTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? todayDateOnly() : localDateOnly(date)
}

function signedCurrency(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatCurrency(Math.abs(value))}`
}

/** A proposal metric against the existing mortgage: lower is better. */
function lowerIsBetterTone(value: number, baseline: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(baseline)) return 'is-even'
  const difference = value - baseline
  if (Math.abs(difference) < 0.5) return 'is-even'
  return difference < 0 ? 'is-positive' : 'is-negative'
}

/** The editable state that decides whether leaving needs a warning. Tab
 *  switches, offer names and saved-record bindings are not edits. */
function offerStateSignature(
  tracks: ExistingMortgageTrack[],
  resetStepText: string,
  proposal: ProposalState,
): string {
  return JSON.stringify({
    tracks,
    resetStepText,
    proposal: {
      tracks: proposal.tracks,
      feeText: proposal.feeText,
      feeMode: proposal.feeMode,
    },
  })
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

export function RefinancePage({
  initialRefinanceId,
}: {
  /** The saved plan in the URL, resolved on the server so the first paint waits. */
  initialRefinanceId?: string
} = {}) {
  const { t, i18n } = useTranslation()
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const signedIn = Boolean(session)

  const [tracks, setTracks] = useState<ExistingMortgageTrack[]>(() => [
    {
      ...emptyExistingMortgageTrack('track-1'),
      type: 'fixed',
      linkage: 'unlinked',
      method: 'spitzer',
    },
  ])
  const [proposals, setProposals] = useState<ProposalState[]>(() => [
    createProposalState(INITIAL_PROPOSAL_ID),
  ])
  const [activeProposalId, setActiveProposalId] = useState(() => proposals[0].id)
  const [resetStepText, setResetStepText] = useState('0')
  // The projection starts at the as-of payment, so the date stays fixed for
  // the session even if the user leaves the tab open past midnight.
  const [asOfDate] = useState(todayDateOnly)
  const [loadedRefinance, setLoadedRefinance] = useState<LoadedRefinance | null>(null)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const pendingNav = useRef<string | null>(null)
  const navigate = useNavigate()

  // Each offer's last saved/created shape. Comparing the live signature to
  // these entries drives the leave warning without flagging tab switches.
  const baselineRef = useRef<Map<string, string> | null>(null)
  if (baselineRef.current === null) {
    baselineRef.current = new Map(
      proposals.map((proposal) => [
        proposal.id,
        offerStateSignature(tracks, resetStepText, proposal),
      ]),
    )
  }

  const savedMixes = useSavedMixes(signedIn)
  const mixes = savedMixes.data?.mixes ?? []

  // Saved-proposal deep link (?refinance=<id>): opening a card navigates here
  // rather than pushing state around, so a refresh or bookmark reloads it. The
  // server page reads the id, so a reload shows the loader on the very first
  // paint instead of drawing a draft form and replacing it.
  const deepLinkId = initialRefinanceId ?? null
  const savedRefinances = useSavedRefinances(signedIn)
  const appliedDeepLink = useRef<string | null>(null)
  const [missingDeepLinkId, setMissingDeepLinkId] = useState<string | null>(null)
  const deepLinkMissing = Boolean(deepLinkId) && missingDeepLinkId === deepLinkId

  useEffect(() => {
    document.title = t('refinance.metaTitle')
  }, [t])

  function applySavedRefinance(saved: SavedRefinance) {
    setTracks(saved.snapshot.existingTracks.map((track) => ({ ...track })))
    const createdOn = dateOnlyFromTimestamp(saved.createdAt)
    const next = saved.snapshot.proposals.map((proposal) => ({
      id: createProposalId(),
      label: proposal.label,
      tracks: proposedTracksFromSnapshot(proposal.proposedTracks),
      feeText: proposal.feeAmount > 0 ? formatGroupedNumber(proposal.feeAmount) : '',
      feeMode: proposal.feeMode,
      createdOn,
    }))
    // Plans saved before the assumption existed load flat.
    const loadedResetStepText = String(saved.snapshot.existingResetStepPercent ?? 0)
    const nextBaselines = new Map<string, string>()
    for (const proposal of next) {
      nextBaselines.set(
        proposal.id,
        offerStateSignature(saved.snapshot.existingTracks, loadedResetStepText, proposal),
      )
    }
    baselineRef.current = nextBaselines
    setProposals(next)
    setActiveProposalId(next[0].id)
    setResetStepText(loadedResetStepText)
    setLoadedRefinance({ id: saved.id, label: saved.label })
  }

  /**
   * Choosing a saved plan from the offers row loads it in place, like the
   * profile's "open" link does through the deep link. The URL is rewritten too,
   * so a refresh (or a bookmark) still opens this plan.
   */
  function loadSavedRefinance(saved: SavedRefinance) {
    applySavedRefinance(saved)
    const url = new URL(window.location.href)
    url.searchParams.set('refinance', saved.id)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (!deepLinkId || appliedDeepLink.current === deepLinkId || deepLinkMissing) return
    if (savedRefinances.isError) {
      setMissingDeepLinkId(deepLinkId)
      return
    }
    if (!savedRefinances.data) {
      // A signed-out visitor can never fetch the plan; do not hold the loader
      // forever when there is no session to load it with.
      if (!sessionPending && !signedIn) setMissingDeepLinkId(deepLinkId)
      return
    }
    const saved = savedRefinances.data.refinances.find((item) => item.id === deepLinkId)
    if (!saved) {
      setMissingDeepLinkId(deepLinkId)
      return
    }
    appliedDeepLink.current = deepLinkId
    applySavedRefinance(saved)
  }, [
    deepLinkId,
    deepLinkMissing,
    savedRefinances.data,
    savedRefinances.isError,
    sessionPending,
    signedIn,
  ])

  const hasUnsavedChanges = proposals.some(
    (proposal) =>
      baselineRef.current?.get(proposal.id) !==
      offerStateSignature(tracks, resetStepText, proposal),
  )

  // Reload/close and browser back-forward cannot be intercepted by the router,
  // so they get the native warning; in-app links use the dialog below.
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setNavigationBlockGuard(null)
      return
    }
    setNavigationBlockGuard((to) => {
      if (to.startsWith('/refinance') || to.startsWith('/login')) return true
      pendingNav.current = to
      setUnsavedOpen(true)
      return false
    })
    return () => setNavigationBlockGuard(null)
  }, [hasUnsavedChanges])

  // A blank assumption means "no change"; the field is an assumption, not a
  // required loan figure, so it does not block the projection.
  const resetStepPercent = parseNumericText(resetStepText) ?? 0

  const projectionSet = useMemo(
    () =>
      computeRefinanceSet({
        existingLabel: t('refinance.existingLabel'),
        tracks,
        proposals: proposals.map((proposal) => ({
          id: proposal.id,
          label: proposal.label,
          proposedTracks: toProposedTrackInputs(proposal.tracks),
          feeAmount: proposalFee(proposal),
          feeMode: proposal.feeMode,
        })),
        asOfDate,
        resetStepPercent,
      }),
    [tracks, proposals, asOfDate, resetStepPercent, t],
  )

  const activeIndex = Math.max(
    0,
    proposals.findIndex((proposal) => proposal.id === activeProposalId),
  )
  const active = proposals[activeIndex] ?? proposals[0]
  const activeProjection: RefinanceProjection | null =
    projectionSet.proposals[activeIndex] ?? null
  const existing = projectionSet.existing
  const readyProposals = projectionSet.proposals.filter((proposal) => proposal.ready)
  const showResults = existing !== null && readyProposals.length > 0

  // The best-value proposal is the one with the strongest net cash flow against
  // the existing mortgage. With one priced proposal there is nothing to beat,
  // so nothing is highlighted; ties all carry the badge.
  const pricedProposals = readyProposals.filter((proposal) => proposal.comparison)
  const bestProposalIds = new Set<string>()
  if (pricedProposals.length >= 2) {
    const bestNet = Math.max(
      ...pricedProposals.map((proposal) => proposal.comparison!.netCashFlowDelta),
    )
    if (Number.isFinite(bestNet)) {
      for (const proposal of pricedProposals) {
        if (Math.abs(proposal.comparison!.netCashFlowDelta - bestNet) < 0.005) {
          bestProposalIds.add(proposal.id)
        }
      }
    }
  }

  // Donut shares for the two top result cards: the existing tracks by current
  // balance, and the active proposal by its allocated principal.
  const existingMixShares = tracks.flatMap((track) =>
    track.type && (track.currentBalance ?? 0) > 0
      ? [{ trackId: track.id, type: track.type, amount: track.currentBalance ?? 0 }]
      : [],
  )
  const activeMixShares = active.tracks.flatMap((track, index) => {
    const amount = activeProjection?.proposedAllocations[index] ?? 0
    return amount > 0 ? [{ trackId: track.id, type: track.type, amount }] : []
  })

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

  function patchProposal(id: string, patch: Partial<ProposalState>) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === id ? { ...proposal, ...patch } : proposal,
      ),
    )
  }

  function patchProposedTrack(id: string, patch: Partial<ProposedTrackState>) {
    if (!active) return
    patchProposal(active.id, {
      tracks: active.tracks.map((track) => (track.id === id ? { ...track, ...patch } : track)),
    })
  }

  function addProposal() {
    if (proposals.length >= MAX_REFINANCE_OFFERS) return
    const next = createProposalState()
    baselineRef.current?.set(next.id, offerStateSignature(tracks, resetStepText, next))
    setProposals([...proposals, next])
    setActiveProposalId(next.id)
  }

  function removeProposal(id: string) {
    if (proposals.length <= 1) return
    const next = proposals.filter((proposal) => proposal.id !== id)
    baselineRef.current?.delete(id)
    setProposals(next)
    if (activeProposalId === id) setActiveProposalId(next[0].id)
  }

  /** The delete icon opens a warning; nothing is removed until it is confirmed. */
  function confirmRemoveProposal() {
    if (pendingRemoveId) removeProposal(pendingRemoveId)
    setPendingRemoveId(null)
  }

  function leaveWithoutSaving() {
    const target = pendingNav.current
    pendingNav.current = null
    setUnsavedOpen(false)
    setNavigationBlockGuard(null)
    if (target) navigate(target)
  }

  function stayOnPage() {
    pendingNav.current = null
    setUnsavedOpen(false)
  }

  function loadSavedMix(id: string) {
    const mix = mixes.find((item) => item.id === id)
    if (!mix || !active) return
    const next = proposedTracksFromSavedMix(mix.tracks)
    if (next.length > 0) patchProposal(active.id, { tracks: next })
  }

  /** Bind the saved plan to the page and drop a stale deep link. */
  function handleSaved(saved: LoadedRefinance) {
    // A whole-plan save makes every offer's current shape the new baseline.
    for (const proposal of proposals) {
      baselineRef.current?.set(
        proposal.id,
        offerStateSignature(tracks, resetStepText, proposal),
      )
    }
    setLoadedRefinance(saved)
    // Keep the URL on the saved plan (a new one after "save as new"): a reload
    // then reopens it instead of dropping back to an empty draft.
    const url = new URL(window.location.href)
    if (url.searchParams.get('refinance') === saved.id) return
    url.searchParams.set('refinance', saved.id)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function breakEvenText(comparison: NonNullable<RefinanceProjection['comparison']>): string {
    if (comparison.breaksEvenImmediately) return t('compare.cashFlowBreakEvenImmediate')
    if (comparison.breakEvenMonth !== null) {
      return t('compare.cashFlowBreakEvenMonth', {
        month: comparison.breakEvenMonth,
        year: Math.ceil(comparison.breakEvenMonth / 12),
      })
    }
    return t('compare.cashFlowBreakEvenNever')
  }

  /** A proposal's own name, or its localized position when unnamed. */
  function proposalLabel(proposal: { id: string; label: string }): string {
    const index = proposals.findIndex((item) => item.id === proposal.id)
    return proposal.label.trim() || t('refinance.proposalDefault', { index: index + 1 })
  }

  const activeComparison = activeProjection?.comparison ?? null
  const breakEven = activeComparison ? breakEvenText(activeComparison) : null

  const rows = activeComparison
    ? [
        {
          key: 'firstPayment',
          label: t('compare.cashFlowFirstPayment'),
          value: activeComparison.firstPaymentDelta,
        },
        {
          key: 'interest',
          label: t('compare.cashFlowInterest'),
          value: activeComparison.interestDelta,
        },
        {
          key: 'fees',
          label: t('compare.cashFlowFees'),
          value: activeComparison.feesDelta,
        },
        {
          key: 'balance',
          label: t('compare.cashFlowBalance'),
          value: activeComparison.balanceDelta,
        },
        {
          key: 'net',
          label: t('compare.cashFlowNet'),
          value: activeComparison.netCashFlowDelta,
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

  // Existing-side and shared errors are identical in every proposal's
  // projection, so the first one carries them for the page-level messages.
  const sharedMissing = projectionSet.proposals[0]?.missing ?? []
  const globalProposedMissing = (activeProjection?.missing ?? []).filter(
    (key) => key.startsWith('proposed:') && !/^proposed:\d+:/.test(key),
  )

  // A deep link resolves after mount. Until the saved plan is applied (or is
  // known to be unavailable), hold the page with a skeleton so the draft form
  // never paints and then changes shape under the reader.
  const loadingSavedPlan =
    Boolean(deepLinkId) && appliedDeepLink.current !== deepLinkId && !deepLinkMissing

  const pageHeader = (
    <div className="mb-6">
      <Link to="/compare" className="compare-back mb-4 inline-flex">
        {t('refinance.backToCompare')}
      </Link>
      <h1 className="text-3xl font-bold text-ink">{t('refinance.heading')}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
        {t('refinance.intro')}
      </p>
    </div>
  )

  if (loadingSavedPlan) {
    return (
      <main className="below-chrome min-h-screen bg-surface-page px-4 pb-20">
        <div className="refinance-shell mx-auto w-full max-w-[1160px]">
          {pageHeader}
          <div
            data-testid="refinance-loading"
            aria-busy="true"
            className="min-h-[60vh]"
          >
            <div className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
              <LoadingIndicator label={t('refinance.loadingSavedPlan')} />
              <span>{t('refinance.loadingSavedPlan')}</span>
            </div>
            <div
              aria-hidden="true"
              className="mb-4 rounded-2xl border border-line-soft bg-surface-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap gap-2">
                <div className="h-[70px] w-52 animate-pulse rounded-xl refinance-skeleton motion-reduce:animate-none" />
                <div className="h-[70px] w-52 animate-pulse rounded-xl refinance-skeleton motion-reduce:animate-none" />
                <div className="h-[70px] w-36 animate-pulse rounded-xl refinance-skeleton motion-reduce:animate-none" />
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2" aria-hidden="true">
              {[0, 1].map((column) => (
                <div
                  key={column}
                  className="rounded-2xl border border-line-soft bg-surface-card p-5"
                >
                  <div className="h-5 w-40 animate-pulse rounded refinance-skeleton motion-reduce:animate-none" />
                  <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded refinance-skeleton motion-reduce:animate-none" />
                  <div className="mt-6 space-y-4">
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="h-[88px] animate-pulse rounded-xl refinance-skeleton motion-reduce:animate-none"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    )
  }

  const saveProps = {
    existingTracks: tracks,
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      label: proposal.label,
      proposedTracks: proposal.tracks,
      feeAmount: proposalFee(proposal),
      feeMode: proposal.feeMode,
    })),
    resetStepPercent,
    loadedRefinance,
    onDeletedLoaded: () => setLoadedRefinance(null),
    suggestedLabel: proposals.length > 1
      ? t('savedRefinances.defaultPlanLabel')
      : proposalLabel(active),
  }

  return (
    <>
    <main className="below-chrome min-h-screen bg-surface-page px-4 pb-20">
      <div className="refinance-shell mx-auto w-full max-w-[1160px]">
        {pageHeader}

        {/* The switcher sits above BOTH columns: the existing and proposed
            track rows must keep starting at the same y position. */}
        <div className="mb-4 rounded-2xl border border-line-soft bg-surface-card p-4 sm:p-5">
          {/* The offers start the row, where the name field used to sit. Each
              is a two-line card (name and creation date) with a remove icon,
              and one save for the whole plan sits at the row's side. */}
          <div className="flex flex-wrap items-stretch gap-3">
            <div
              className="flex flex-wrap items-stretch gap-2"
              role="tablist"
              aria-label={t('refinance.proposalsAria')}
              data-testid="refinance-proposal-tabs"
            >
            {proposals.map((proposal, index) => {
              const selected = proposal.id === active.id
              // The card owns the border and background, so the tab and its
              // actions read as one button. The actions stay siblings of the
              // tab: a button cannot legally contain other buttons.
              return (
                <div
                  key={proposal.id}
                  role="presentation"
                  className={`relative flex w-52 flex-col rounded-xl border transition-colors ${
                    selected
                      ? 'border-ink bg-surface-soft text-ink'
                      : 'border-line-soft text-ink-muted hover:text-ink'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    id={`refinance-proposal-tab-button-${index + 1}`}
                    aria-selected={selected}
                    aria-controls="refinance-proposal-panel"
                    data-testid={`refinance-proposal-tab-${index + 1}`}
                    title={proposalLabel(proposal)}
                    onClick={() => setActiveProposalId(proposal.id)}
                    className="flex w-full flex-col justify-center rounded-xl px-3 py-2.5 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <span
                      data-testid={`refinance-proposal-name-${index + 1}`}
                      className="block truncate text-base font-semibold"
                    >
                      {proposalLabel(proposal)}
                    </span>
                    <span
                      data-testid={`refinance-proposal-date-${index + 1}`}
                      className={`mt-1 block truncate text-sm font-normal text-ink-muted ${
                        proposals.length > 1 ? 'pe-8' : ''
                      }`}
                    >
                      {formatDateOnly(proposal.createdOn, i18n.language)}
                    </span>
                  </button>

                  {/* Removing an offer asks first. The trash sits on the
                      date's line so the card stays a single visual unit. */}
                  {proposals.length > 1 && (
                    <div className="absolute bottom-2 end-3 flex items-center">
                      <button
                        type="button"
                        data-testid={`refinance-remove-proposal-${index + 1}`}
                        onClick={() => setPendingRemoveId(proposal.id)}
                        aria-label={t('refinance.removeProposal')}
                        title={t('refinance.removeProposal')}
                        className="compare-icon-link is-danger"
                      >
                        <FaRegTrashAlt aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {proposals.length < MAX_REFINANCE_OFFERS && (
              <button
                type="button"
                data-testid="refinance-add-proposal"
                onClick={addProposal}
                className="inline-flex min-h-[68px] w-52 items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
              >
                <FaPlus aria-hidden="true" />
                {t('refinance.addProposal')}
              </button>
            )}
            </div>

            {/* One save for the whole plan, at the row's side. */}
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {signedIn && (
                <SavedItemsMenu
                  items={savedRefinances.data?.refinances ?? []}
                  count={savedRefinances.data?.refinances.length ?? 0}
                  max={savedRefinances.data?.max ?? 4}
                  isPending={savedRefinances.isPending}
                  isError={savedRefinances.isError}
                  triggerLabel={t('savedRefinances.myPlansLink')}
                  triggerClassName="compare-save-button"
                  triggerTestId="my-refinances-menu-trigger"
                  menuTestId="saved-refinances-menu"
                  itemTestId={(id) => `saved-refinance-menu-item-${id}`}
                  manageHref="/profile#saved-refinances"
                  manageLabel={t('savedRefinances.profileTitle')}
                  manageTestId="my-refinances-link"
                  loadingLabel={t('savedRefinances.loading')}
                  errorLabel={t('savedRefinances.loadError')}
                  emptyLabel={t('savedRefinances.empty')}
                  onSelect={loadSavedRefinance}
                  shouldConfirm={() => hasUnsavedChanges}
                  confirmTitle={t('savedRefinances.loadOtherTitle')}
                  confirmBody={t('savedRefinances.loadOtherBody')}
                  confirmAction={t('savedRefinances.loadOtherAction')}
                  confirmTestId="load-refinance-confirm"
                  renderSaveAction={(onSaved, onPendingChange) => (
                    <SaveRefinanceButton
                      {...saveProps}
                      actionLabel={t('savedRefinances.saveAndLoad')}
                      actionTestId="load-refinance-confirm-save"
                      onPendingChange={onPendingChange}
                      onSaved={(saved) => {
                        handleSaved(saved)
                        onSaved()
                      }}
                    />
                  )}
                />
              )}
              <SaveRefinanceButton
                {...saveProps}
                onSaved={handleSaved}
                iconOnly
              />
            </div>
          </div>
        </div>

        <div
          className="refinance-columns grid gap-5 lg:grid-cols-2"
          style={
            {
              '--refinance-track-count': Math.max(tracks.length, active.tracks.length),
            } as CSSProperties
          }
        >
          <section
            className="refinance-column rounded-2xl border border-line-soft bg-surface-card p-5"
            style={{ '--refinance-column-count': tracks.length } as CSSProperties}
          >
            <div className="refinance-column-heading">
              <h2 className="text-lg font-semibold text-ink">{t('refinance.existingHeading')}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t('refinance.existingLead')}</p>

              {/* Load a saved mix into the proposal. The control sits with the
                  existing mortgage it reframes, and the mix only supplies the
                  proposal's proportions, rates, terms and methods; the
                  principal still comes from these balances. Buttons keep every
                  mix name visible, and nothing renders until a mix exists (or
                  loading really failed). While the list loads, signed-in users
                  get chip-shaped placeholders so the column does not jump when
                  the real chips arrive. */}
              {/* `sessionPending` is in here because the saved-mixes query only
                  enables once the session is known: without it the area stays
                  empty for the length of the session request, then the skeleton
                  pops in, which reads as a second load. */}
              {(sessionPending || (signedIn && savedMixes.isPending)) && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2"
                  role="status"
                  data-testid="refinance-mix-skeleton"
                >
                  <span aria-hidden="true" className="h-[30px] w-20 animate-pulse rounded-full bg-surface-soft motion-reduce:animate-none" />
                  <span aria-hidden="true" className="h-[30px] w-28 animate-pulse rounded-full bg-surface-soft motion-reduce:animate-none" />
                  <span aria-hidden="true" className="h-[30px] w-24 animate-pulse rounded-full bg-surface-soft motion-reduce:animate-none" />
                  <span className="sr-only">{t('savedMixes.loading')}</span>
                </div>
              )}
              {signedIn && !savedMixes.isPending && (savedMixes.isError || mixes.length > 0) && (
                <div className="mt-3">
                  {savedMixes.isError ? (
                    <p role="alert" className="text-xs text-danger">
                      {t('refinance.loadMixError')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {mixes.map((mix) => (
                        <button
                          key={mix.id}
                          type="button"
                          data-testid={`refinance-load-mix-${mix.id}`}
                          onClick={() => loadSavedMix(mix.id)}
                          className="rounded-full border border-line-strong bg-surface-soft px-3 py-1 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-surface-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                        >
                          {mix.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="refinance-track-list mt-4 flex flex-col gap-4">
              {tracks.map((track, index) => {
                const missing = sharedMissing.filter((key) =>
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
                        {t('refinance.balloonLabel')}
                        <NumberField
                          testId={`refinance-balloon-${index + 1}`}
                          value={track.balloonPercent ?? null}
                          onChange={(value) =>
                            patchTrack(track.id, { balloonPercent: value })
                          }
                          suffix="%"
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

            {/* This control follows this column's own track count, so the other
                column growing never pushes it down. */}
            <div className="refinance-column-add">
              {tracks.length < MAX_TRACKS && (
                <button
                  type="button"
                  data-testid="refinance-add-track"
                  className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink lg:mt-0"
                  onClick={addTrack}
                >
                  <FaPlus aria-hidden="true" />
                  {t('refinance.addTrack')}
                </button>
              )}
            </div>

            <div className="refinance-column-footer">
            {/* The keep-side assumption sits in this column's footer, opposite
                the payoff fee in the proposed column, so both fields share the
                desktop footer row and read as a pair. */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="input-group">
                {t('refinance.resetHeading')}
                <TextField
                  testId="refinance-reset-step"
                  value={resetStepText}
                  onChange={setResetStepText}
                  suffix={t('refinance.resetStepSuffix')}
                />
              </label>
            </div>
            <p
              className="mt-3 text-xs leading-relaxed text-ink-muted xl:whitespace-nowrap"
              data-testid="refinance-reset-hint"
            >
              {t('refinance.resetHint')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {t('refinance.balloonHint')}
            </p>
            {sharedMissing.includes('resetStep:invalid') && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {t('refinance.resetStepInvalid')}
              </p>
            )}
            </div>
          </section>

          <section
            id="refinance-proposal-panel"
            role="tabpanel"
            aria-labelledby={`refinance-proposal-tab-button-${activeIndex + 1}`}
            className="refinance-column rounded-2xl border border-line-soft bg-surface-card p-5"
            style={{ '--refinance-column-count': active.tracks.length } as CSSProperties}
          >
            <div className="refinance-column-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{t('refinance.proposedHeading')}</h2>
                <p className="mt-1 text-sm text-ink-muted">{t('refinance.proposedLead')}</p>
              </div>
            </div>
            </div>

            <div className="refinance-track-list mt-4 flex flex-col gap-4">
              {active.tracks.map((track, index) => {
                const missing = (activeProjection?.missing ?? []).filter((key) =>
                  key.startsWith(`proposed:${index}:`),
                )
                const amount = activeProjection?.proposedAllocations[index] ?? 0
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
                        {t('refinance.balloonLabel')}
                        <TextField
                          testId={`refinance-proposed-balloon-${index + 1}`}
                          value={track.balloonText}
                          onChange={(value) =>
                            patchProposedTrack(track.id, { balloonText: value })
                          }
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
                    {active.tracks.length > 1 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
                        onClick={() =>
                          patchProposal(active.id, {
                            tracks: removeProposedTrack(active.tracks, track.id),
                          })
                        }
                      >
                        <FaRegTrashAlt aria-hidden="true" />
                        {t('refinance.removeTrack')}
                      </button>
                    )}
                  </fieldset>
                )
              })}
            </div>

            {/* Same rule on the proposed side; only the footer row is shared. */}
            <div className="refinance-column-add">
              {active.tracks.length < MAX_TRACKS && (
                <button
                  type="button"
                  className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink lg:mt-0"
                  onClick={() =>
                    patchProposal(active.id, { tracks: addProposedTrack(active.tracks) })
                  }
                  data-testid="refinance-add-proposed-track"
                >
                  <FaPlus aria-hidden="true" />
                  {t('refinance.addTrack')}
                </button>
              )}
            </div>

            <div className="refinance-column-footer">
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="input-group">
                <span data-testid="refinance-fee-label">{t('refinance.feeLabel')}</span>
                <MoneyInput
                  testId="refinance-fee"
                  value={active.feeText}
                  suffix="₪"
                  onChange={(raw, caret) => {
                    const result = formatAmountWithCaret(raw, caret)
                    patchProposal(active.id, { feeText: result.text })
                    return result
                  }}
                />
              </label>
              {/* Same type size and top line as the fee label; only the radio
                  row drops so its centre meets the money field's centre. */}
              <fieldset className="input-group min-w-0 self-start sm:ps-4">
                <legend data-testid="refinance-fee-mode-label">
                  {t('refinance.feeModeLabel')}
                </legend>
                <div className="mt-2 flex flex-wrap gap-4 sm:mt-[19px]" data-testid="refinance-fee-mode-options">
                  {(['cash', 'capitalized'] as const).map((mode) => (
                    <label
                      key={mode}
                      className="inline-flex items-center gap-2 text-sm font-normal text-ink"
                    >
                      <input
                        type="radio"
                        name={`fee-mode-${active.id}`}
                        value={mode}
                        checked={active.feeMode === mode}
                        onChange={() => patchProposal(active.id, { feeMode: mode })}
                      />
                      {t(mode === 'cash' ? 'refinance.feeCash' : 'refinance.feeCapitalized')}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t('refinance.feeHint')}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {t('refinance.balloonHint')}
            </p>
            {activeProjection?.missing.includes('fee:invalid') && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {t('refinance.feeInvalid')}
              </p>
            )}
            {activeProjection?.ready && (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t('refinance.totalBalance')}</dt>
                  <dd className="font-semibold text-ink">
                    {formatCurrency(activeProjection.totalBalance)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">{t('refinance.proposedPrincipal')}</dt>
                  <dd
                    className="font-semibold text-ink"
                    data-testid="refinance-proposed-principal"
                  >
                    {formatCurrency(activeProjection.proposedPrincipal)}
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

        {showResults && existing ? (
          <section className="mt-6" data-testid="refinance-results">
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="refinance-result-card rounded-2xl border border-line-soft bg-surface-card p-5">
                <h2 className="text-base font-semibold text-ink">{t('refinance.existingLabel')}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.existingPayment')}</dt>
                    <dd className="font-semibold text-ink" data-testid="refinance-existing-payment">
                      {formatCurrency(existing.monthlyPayment)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.existingInterest')}</dt>
                    <dd className="font-semibold text-ink" data-testid="refinance-existing-interest">
                      {formatCurrency(existing.totalInterest)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">{t('refinance.termLabel')}</dt>
                    <dd className="font-semibold text-ink">
                      {t('refinance.monthsValue', { months: existing.termMonths })}
                    </dd>
                  </div>
                  {existing.balloonDue > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">{t('refinance.balloonDue')}</dt>
                      <dd
                        className="font-semibold text-ink"
                        data-testid="refinance-existing-balloon"
                      >
                        {formatCurrency(existing.balloonDue)}
                      </dd>
                    </div>
                  )}
                </dl>
                {existingMixShares.length > 0 && (
                  <div className="refinance-mix-block" data-testid="refinance-existing-mix">
                    <TrackMixDonut
                      shares={existingMixShares}
                      size={180}
                      className="refinance-mix-donut-chart"
                    />
                  </div>
                )}
              </article>
              {activeProjection?.ready && activeProjection.proposed ? (
                <article
                  className={`refinance-result-card rounded-2xl border border-line-soft bg-surface-card p-5${
                    bestProposalIds.has(active.id) ? ' is-best' : ''
                  }`}
                  data-testid="refinance-active-proposal-result"
                  data-best-proposal={bestProposalIds.has(active.id) ? 'true' : undefined}
                >
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    <span>{proposalLabel(active)}</span>
                    {bestProposalIds.has(active.id) && (
                      <span className="compare-best-mix-badge">
                        {t('refinance.bestProposalBadge')}
                      </span>
                    )}
                  </h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">{t('refinance.proposedPayment')}</dt>
                      <dd
                        className={`refinance-metric font-semibold text-ink ${lowerIsBetterTone(
                          activeProjection.proposed.monthlyPayment,
                          existing.monthlyPayment,
                        )}`}
                      >
                        {formatCurrency(activeProjection.proposed.monthlyPayment)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">{t('refinance.proposedInterest')}</dt>
                      <dd
                        className={`refinance-metric font-semibold text-ink ${lowerIsBetterTone(
                          activeProjection.proposed.totalInterest,
                          existing.totalInterest,
                        )}`}
                      >
                        {formatCurrency(activeProjection.proposed.totalInterest)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">{t('refinance.termLabel')}</dt>
                      <dd className="font-semibold text-ink">
                        {t('refinance.monthsValue', {
                          months: activeProjection.proposed.termMonths,
                        })}
                      </dd>
                    </div>
                    {activeProjection.proposed.balloonDue > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-ink-muted">{t('refinance.balloonDue')}</dt>
                        <dd
                          className="font-semibold text-ink"
                          data-testid="refinance-proposed-balloon-due"
                        >
                          {formatCurrency(activeProjection.proposed.balloonDue)}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {activeMixShares.length > 0 && (
                    <div className="refinance-mix-block" data-testid="refinance-active-mix">
                      <TrackMixDonut
                        shares={activeMixShares}
                        size={180}
                        className="refinance-mix-donut-chart"
                      />
                    </div>
                  )}
                </article>
              ) : (
                <article className="refinance-result-card rounded-2xl border border-line-soft bg-surface-card p-5">
                  <h2 className="text-base font-semibold text-ink">{proposalLabel(active)}</h2>
                  <p className="mt-3 text-sm text-ink-muted">
                    {t('refinance.activeProposalIncomplete')}
                  </p>
                </article>
              )}
            </div>

            {/* Every ready proposal against the same existing side. Each card
                keeps to the cash-flow-only rules stated below the section. */}
            <section className="mt-6" data-testid="refinance-proposal-comparison">
              <h2 className="text-lg font-semibold text-ink">
                {t('refinance.proposalComparisonHeading')}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {t('refinance.proposalComparisonLead')}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {readyProposals.map((proposal) => {
                  const index = proposals.findIndex((item) => item.id === proposal.id)
                  const proposalState = proposals[index]
                  const comparison = proposal.comparison
                  if (!comparison) return null
                  const isBest = bestProposalIds.has(proposal.id)
                  return (
                    <article
                      key={proposal.id}
                      className={`refinance-result-card rounded-2xl border border-line-soft bg-surface-card p-5${
                        isBest ? ' is-best' : ''
                      }`}
                      data-testid={`refinance-proposal-result-${index + 1}`}
                      data-best-proposal={isBest ? 'true' : undefined}
                    >
                      <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                        <span>{proposalLabel(proposal)}</span>
                        {isBest && (
                          <span className="compare-best-mix-badge">
                            {t('refinance.bestProposalBadge')}
                          </span>
                        )}
                      </h3>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">{t('refinance.proposedPayment')}</dt>
                          <dd
                            className={`refinance-metric font-semibold text-ink ${lowerIsBetterTone(
                              proposal.proposed?.monthlyPayment ?? 0,
                              existing.monthlyPayment,
                            )}`}
                          >
                            {formatCurrency(proposal.proposed?.monthlyPayment ?? 0)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">{t('refinance.proposedInterest')}</dt>
                          <dd
                            className={`refinance-metric font-semibold text-ink ${lowerIsBetterTone(
                              proposal.proposed?.totalInterest ?? 0,
                              existing.totalInterest,
                            )}`}
                          >
                            {formatCurrency(proposal.proposed?.totalInterest ?? 0)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">{t('compare.cashFlowFees')}</dt>
                          <dd
                            className={`refinance-metric ${
                              comparison.feesDelta > 0
                                ? 'is-positive'
                                : comparison.feesDelta < 0
                                  ? 'is-negative'
                                  : 'is-even'
                            }`}
                          >
                            {signedCurrency(comparison.feesDelta)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-muted">{t('compare.cashFlowNet')}</dt>
                          <dd
                            className={`refinance-metric ${
                              comparison.netCashFlowDelta > 0
                                ? 'is-positive'
                                : comparison.netCashFlowDelta < 0
                                  ? 'is-negative'
                                  : 'is-even'
                            }`}
                          >
                            {signedCurrency(comparison.netCashFlowDelta)}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-sm font-medium text-ink">
                        {breakEvenText(comparison)}
                      </p>
                      {proposal.hasBalloon && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {t('refinance.balloonComparisonNote')}
                        </p>
                      )}
                      {proposalState && proposalFee(proposalState) === 0 && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {t('refinance.noFeeNote')}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            {activeProjection?.ready && activeComparison ? (
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
                {activeProjection.hasBalloon && (
                  <p
                    className="compare-cashflow-note"
                    data-testid="refinance-balloon-note"
                  >
                    {t('refinance.balloonComparisonNote')}
                  </p>
                )}
              </section>
            ) : null}
          </section>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-ink-muted">{t('refinance.disclaimer')}</p>
      </div>
    </main>

    <AppModal
      open={unsavedOpen}
      onOpenChange={(openState) => {
        if (!openState) stayOnPage()
      }}
      testId="unsaved-refinance-confirm"
      dir={i18n.dir()}
      contentClassName="max-w-[440px] !border-0 !shadow-[0_12px_32px_rgba(15,15,15,0.30)]"
    >
      <div className="p-6">
        <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
          {t('refinance.unsavedTitle')}
        </h3>
        <p className="text-[15px] leading-relaxed text-ink">{t('refinance.unsavedBody')}</p>
        <div className="mt-6 modal-actions">
          <button
            type="button"
            data-testid="unsaved-refinance-stay"
            className="rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-deep)]"
            onClick={stayOnPage}
          >
            {t('refinance.unsavedStay')}
          </button>
          <button
            type="button"
            data-testid="unsaved-refinance-leave"
            className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
            onClick={leaveWithoutSaving}
          >
            {t('refinance.unsavedLeave')}
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal
      open={pendingRemoveId !== null}
      onOpenChange={(openState) => {
        if (!openState) setPendingRemoveId(null)
      }}
      testId="remove-refinance-offer-confirm"
      dir={i18n.dir()}
      tone="red"
      contentClassName="max-w-[440px]"
    >
      <div className="p-6">
        <h3 className="mb-4 text-[20px] font-bold leading-tight text-ink">
          {t('refinance.removeProposalTitle')}
        </h3>
        <p className="text-[15px] leading-relaxed text-ink">
          {t('refinance.removeProposalBody')}
        </p>
        <div className="mt-6 modal-actions">
          <button
            type="button"
            data-testid="remove-refinance-offer-cancel"
            className="rounded-[5px] border border-line-strong px-5 py-2 text-[15px] font-medium text-ink-muted transition-colors hover:text-ink"
            onClick={() => setPendingRemoveId(null)}
          >
            {t('refinance.cancel')}
          </button>
          <button
            type="button"
            data-testid="remove-refinance-offer-delete"
            className="rounded-[5px] bg-[var(--danger)] px-5 py-2 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            onClick={confirmRemoveProposal}
          >
            {t('refinance.removeProposalConfirm')}
          </button>
        </div>
      </div>
    </AppModal>
    </>
  )
}
