import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@/router'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { useAverageRates } from '@/services/rates'
import {
  averageRateForTerm,
  FALLBACK_MARKET_RATE_PERCENT,
  type AverageRateKind,
} from '@/lib/averageRates'
import { formatAmountWithCaret, formatCurrency, formatRatePercent } from '@/lib/format'
import { MAX_YEARS } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { PrepaymentPenaltyFacts } from '@/components/education/PrepaymentPenaltyFacts'
import {
  OPERATIONAL_FEE_CAP,
  cheapestPrepaymentOrder,
  prepaymentAllocationPlan,
  partialPrepaymentOutcomes,
  prepaymentDiscountSummary,
  prepaymentExtras,
} from '@/lib/prepayment'
import {
  prepaymentFeeByYear,
  prepaymentFeeRows,
  type PrepaymentFeeRow,
  type PrepaymentProjectionTrack,
} from '@/lib/prepaymentProjection'
import { ForecastChart, type ForecastSeries } from './ForecastChart'
import { TRACK_TYPE_COLORS } from './trackColors'

/** The prepayment point opens on the common "after five years" case. */
const DEFAULT_PREPAY_YEARS = 5

/**
 * Below this share of the balance the היוון fee is under ₪1 per ₪1,000, which
 * on the chart is a line flat on zero. The panel then explains why instead of
 * leaving the reader to wonder whether the chart broke.
 */
const NEGLIGIBLE_FEE_SHARE_PERCENT = 0.1

/** The priced row the table, chart and outcomes all read. */
type TrackFeeRow = PrepaymentFeeRow

const clampYears = (value: number): number => Math.min(MAX_YEARS, Math.max(1, value))

/** A money field's typed text as a number; blank and junk read as zero. */
const parseAmountText = (text: string): number => {
  const parsed = Number.parseFloat(text.replace(/[,\s₪]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** The display text for a computed amount, in the same format the fields use. */
const amountText = (amount: number): string =>
  formatAmountWithCaret(String(Number.isFinite(amount) ? Math.max(0, amount) : 0), null).text

/**
 * Early-repayment fee (עמלת פירעון מוקדם) - the היוון estimate for the mix
 * currently in the calculator.
 *
 * The math lives in `src/lib/prepayment.ts`; this component only gathers the
 * inputs the formula needs straight from the schedule the user is already
 * looking at (each track's remaining payments and balance at the chosen
 * month), defaults the market comparison rate from the Bank of Israel average
 * tables (item 4), and lays the per-track result out with the cheapest payoff
 * order. A total entered once spreads cheapest-first across the tracks, and the
 * per-track amounts it fills can then be moved between mixes; those same
 * amounts drive both legal outcomes of a partial prepayment: finish earlier, or
 * keep the maturity and lower the payment. A five-year track is
 * priced only to its next reset (section 4(1)), matching the law's shorter
 * horizon.
 *
 * `priceAt` is the whole computation for one prepayment month; the selected
 * month's table and the fee-by-date chart are both built from it, so the two
 * can never disagree, and moving the date costs one recomputation.
 *
 * The היוון fee is the statutory core, shown as a step: the gross difference,
 * the loan-age reduction the law applies to it, and what is left. The three
 * charges that sit outside the formula (the operational fee of up to ₪60 per
 * track, the no-notice fee of up to 0.1%, and the CPI compensation for indexed
 * money repaid on days 1-15) are added in their own collapsible block, so the
 * panel's total can be read either as the fee or as the whole bank charge.
 * Section 3(4)'s origination-rate cap is optional: the user can
 * enter the BOI average rate for a track's term on the origination date, and
 * the formula then discounts at the lower of that and the contractual rate.
 * With no value the cap is left off, so the estimate may be higher than the
 * actual fee, never lower. Only tracks that carry a fee get a field: an exempt
 * track (prime, annually-reset, or at an exit station) is fee-free whatever
 * the cap says, so a field there would silently do nothing.
 */
export function PrepaymentSection() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()
  const tracks = vm.snapshot.scheduleTracks
  const annualInflation = vm.snapshot.annualInflation
  const rates = useAverageRates()

  const [prepayYearsText, setPrepayYearsText] = useState(String(DEFAULT_PREPAY_YEARS))
  const [manualMarketText, setManualMarketText] = useState('')
  const [onExitStation, setOnExitStation] = useState(false)
  /** The total the reader wants to repay now, as typed. */
  const [partialText, setPartialText] = useState('')
  /**
   * True once the reader has set the total themselves. From then on the total
   * is a budget: editing a track moves money inside it instead of changing it.
   * Before that, the per-track fields are the source and the total follows them.
   */
  const [targetMode, setTargetMode] = useState(false)
  /** The reader's own split: how much to repay from each track, as typed. */
  const [allocationTexts, setAllocationTexts] = useState<Record<string, string>>({})
  /**
   * Whether the reader has taken over the comparison-rate field. Until they
   * do, the field shows the BOI suggestion; the moment they type (or clear)
   * it, their own text is what renders and what the fee uses.
   */
  const [marketEdited, setMarketEdited] = useState(false)
  /** Optional section 3(4) origination average per track, keyed by row id. */
  const [capRateTexts, setCapRateTexts] = useState<Record<string, string>>({})
  /** The two extras that depend on the request, not on the mortgage. */
  const [noNotice, setNoNotice] = useState(false)
  const [firstHalfOfMonth, setFirstHalfOfMonth] = useState(false)

  const capRateFor = useCallback(
    (rowId: string): number | undefined => {
      const raw = capRateTexts[rowId]
      if (raw === undefined || raw.trim() === '') return undefined
      const parsed = Number.parseFloat(raw)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
    },
    [capRateTexts],
  )

  // The last month any track still carries a balance. A prepayment on this
  // month has something to price; the month after it does not, and the panel
  // says so instead of dangling the date input over an empty result.
  const termMonths = useMemo(
    () => tracks.reduce((longest, track) => Math.max(longest, track.monthlyRows.length), 0),
    [tracks],
  )
  /** Largest whole year that still has a balance, so the date field can stop there. */
  const lastPrepayYears = Math.max(1, Math.floor((termMonths - 1) / 12))

  const prepayYears = clampYears(Number.parseFloat(prepayYearsText) || DEFAULT_PREPAY_YEARS)
  const prepayMonths = Math.round(prepayYears * 12)
  const manualMarket = (() => {
    const parsed = Number.parseFloat(manualMarketText)
    return Number.isFinite(parsed) && manualMarketText.trim() !== '' ? parsed : null
  })()

  /** The schedule pieces the shared fee projection needs, one per track. */
  const projectionTracks = useMemo<PrepaymentProjectionTrack[]>(
    () =>
      tracks.map((track, index) => ({
        id: `${track.type}-${index}`,
        type: track.type,
        monthlyRows: track.monthlyRows,
        annualRatePercent: track.annualRatePercent,
        isIndexed: track.isIndexed,
        method: track.method,
      })),
    [tracks],
  )

  /** The BOI average rate for a track's own basis and remaining term. */
  const marketRateFor = useCallback(
    (track: PrepaymentProjectionTrack, remainingYears: number): number => {
      if (manualMarket !== null) return manualMarket
      const kind: AverageRateKind = track.isIndexed ? 'indexed' : 'nonIndexed'
      return averageRateForTerm(
        rates.data?.tables,
        kind,
        remainingYears,
        FALLBACK_MARKET_RATE_PERCENT,
      )
    },
    [manualMarket, rates.data],
  )

  /**
   * A one-shot suggestion for the market comparison rate field, drawn from the
   * current BOI average table and the mix's longest remaining term. It does not
   * override a value the user typed, and it is recomputed only when that storage
   * changes, so a stale table does not silently refresh a user's edit.
   */
  const suggestedMarketRate =
    manualMarket !== null
      ? ''
      : (() => {
          const status = rates.data?.tables.find((entry) => entry.status === 'ok')?.status
          if (status !== 'ok') return ''
          const longestTrack = projectionTracks.reduce<PrepaymentProjectionTrack | null>(
            (longest, track) =>
              track.monthlyRows.length > (longest?.monthlyRows.length ?? 0) ? track : longest,
            null,
          )
          if (!longestTrack || longestTrack.monthlyRows.length <= 12) return ''
          const remainingYears = longestTrack.monthlyRows.length / 12
          const kind: AverageRateKind = longestTrack.isIndexed ? 'indexed' : 'nonIndexed'
          const value = averageRateForTerm(
            rates.data?.tables,
            kind,
            remainingYears,
            FALLBACK_MARKET_RATE_PERCENT,
          )
          if (!Number.isFinite(value) || value <= 0) return ''
          return value.toFixed(2)
        })()

  /** Prices the whole mix for one prepayment month. */
  const priceAt = useCallback(
    (months: number): TrackFeeRow[] =>
      prepaymentFeeRows(projectionTracks, months, {
        marketRateFor,
        annualInflation,
        onExitStation,
        capRateFor,
      }),
    [projectionTracks, marketRateFor, annualInflation, onExitStation, capRateFor],
  )

  const rows = useMemo(() => priceAt(prepayMonths), [priceAt, prepayMonths])

  /**
   * The same per-track fee priced at the end of every loan year, for the chart.
   * One point per track per year, from the shared projection, so the curve is
   * the table's own arithmetic rather than a second model of it. Exempt tracks
   * stay on the zero line - which is the point of showing them.
   */
  const chartSeries = useMemo<ForecastSeries[]>(
    () =>
      prepaymentFeeByYear(projectionTracks, lastPrepayYears, {
        marketRateFor,
        annualInflation,
        onExitStation,
        capRateFor,
      }).map((series) => ({
        id: series.id,
        label: t(`calculator.trackTypes.${series.type}`),
        color: TRACK_TYPE_COLORS[series.type],
        points: series.points,
      })),
    [
      projectionTracks,
      lastPrepayYears,
      marketRateFor,
      annualInflation,
      onExitStation,
      capRateFor,
      t,
    ],
  )

  /** The chart's own numbers, one row per loan year, for its table view. */
  const chartRows = useMemo(
    () =>
      chartSeries.length === 0
        ? []
        : Array.from({ length: lastPrepayYears }, (_, index) => {
            const year = index + 1
            return {
              year,
              cells: chartSeries.map((series) => ({
                id: series.id,
                fee: series.points.find((point) => point.year === year)?.value,
              })),
            }
          }),
    [chartSeries, lastPrepayYears],
  )

  /** The chart card and its two outcome cards animate together: the card enters
      on first render and leaves when it empties again, so the disappearance
      itself is animated rather than a hard cut. */
  const chartBoxVisible = chartSeries.length > 0

  const totalFee = rows.reduce((sum, row) => sum + row.breakdown.fee, 0)
  const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0)
  const feeShare = totalBalance > 0 ? (totalFee / totalBalance) * 100 : 0
  /** The same full-prepayment quote the split and the ranking both start from. */
  const feeCandidates = rows.map((row) => ({
    id: row.id,
    balance: row.balance,
    fee: row.breakdown.fee,
  }))
  /**
   * The reader's own split, one amount per track, priced per track. The bank
   * repays the tracks the borrower names, and the reader may want to clear a
   * short track or leave an exempt one alone, so there is no cheapest-first
   * split to guess at: each row's fee is its own pro-rata share and the total
   * is the rows added up. `plan.order` still ranks every track cheapest-first,
   * which is the advice printed beside the inputs.
   */
  const plan = prepaymentAllocationPlan(
    feeCandidates,
    Object.fromEntries(rows.map((row) => [row.id, parseAmountText(allocationTexts[row.id] ?? '')])),
  )
  const partialAmount = plan.allocated
  /** The total the reader set, when the total field is driving the split. */
  const targetAmount = targetMode ? parseAmountText(partialText) : 0
  const remainingAmount = Math.max(0, targetAmount - plan.allocated)
  const allocatedById = new Map(
    plan.allocations.map((allocation) => [allocation.id, allocation.amount]),
  )

  /**
   * The loan-age reduction as its own step. Exempt tracks sit out of both
   * sides: their gross difference never becomes a fee, so counting it would
   * show a discount on money nobody was going to pay.
   */
  const discountSummary = prepaymentDiscountSummary(
    rows.map((row) => ({
      grossFee: row.breakdown.grossFee,
      fee: row.breakdown.fee,
      ageDiscount: row.breakdown.ageDiscount,
      exempt: row.breakdown.exemptReason !== null,
    })),
  )

  /**
   * The charges outside the discounting formula. The operational fee is per
   * track account the prepayment actually closes, the no-notice fee is on the
   * amount actually repaid (the split when one is entered, otherwise the whole
   * balance), and the CPI compensation applies to the indexed share of that
   * amount, read from the split rather than assumed proportional.
   */
  const indexedBalance = rows.reduce((sum, row) => sum + (row.isIndexed ? row.balance : 0), 0)
  const repaidAmount = partialAmount > 0 ? partialAmount : totalBalance
  const indexedRepaid =
    partialAmount > 0
      ? rows.reduce(
          (sum, row) => sum + (row.isIndexed ? (allocatedById.get(row.id) ?? 0) : 0),
          0,
        )
      : indexedBalance
  const extras = prepaymentExtras({
    trackCount: partialAmount > 0 ? plan.allocations.length : rows.length,
    amountRepaid: repaidAmount,
    indexedAmountRepaid: indexedRepaid,
    noNotice,
    firstHalfOfMonth,
    annualInflation,
  })

  // The ladder is shown in whole shekels, so the discount is the difference
  // between the two figures the reader sees, not a separately rounded number
  // that can leave the column a shekel short of adding up. `after` is the
  // table's own total, so both always agree.
  const grossShown = Math.round(discountSummary.grossFee)
  const afterShown = Math.round(discountSummary.fee)
  const discountShown = grossShown - afterShown
  // Same rule for the charges on top: the total is the sum of the figures
  // printed above it.
  const extrasTotalShown =
    afterShown +
    Math.round(extras.operationalFee) +
    Math.round(extras.noNoticeFee) +
    Math.round(extras.cpiCompensationFee)
  const rowById = (id: string): TrackFeeRow | undefined => rows.find((entry) => entry.id === id)
  const trackName = (id: string): string => {
    const row = rowById(id)
    return row ? t(`calculator.trackTypes.${row.type}`) : id
  }

  /**
   * What the split does to each track, under both legal modes. Each track is
   * reduced by the amount the reader put in its field, so the outcomes follow
   * the money's actual destination: clearing one track shortens or lowers the
   * payment on that track alone, and the untouched tracks keep their numbers.
   */
  const outcomes =
    partialAmount > 0
      ? partialPrepaymentOutcomes(
          rows.map((row) => ({
            balance: row.balance,
            amount: allocatedById.get(row.id) ?? 0,
            nextPayment: row.nextPayment,
            nextPrincipal: row.nextPrincipal,
            annualRatePercent: row.annualRatePercent,
            remainingMonths: row.remainingMonths,
            method: row.method,
            indexed: row.isIndexed,
          })),
          annualInflation,
        )
      : null

  /** "9 years 2 months" in the active language, with singular forms. */
  const formatTerm = (months: number): string => {
    if (months <= 0) return t('calculator.prepayment.outcomes.termNow')
    const years = Math.floor(months / 12)
    const rest = months % 12
    const parts: string[] = []
    if (years > 0) {
      parts.push(
        years === 1
          ? t('calculator.prepayment.outcomes.termYear')
          : t('calculator.prepayment.outcomes.termYears', { years }),
      )
    }
    if (rest > 0) {
      parts.push(
        rest === 1
          ? t('calculator.prepayment.outcomes.termMonth')
          : t('calculator.prepayment.outcomes.termMonths', { months: rest }),
      )
    }
    return parts.join(t('calculator.prepayment.outcomes.termJoin'))
  }

  // Tracks whose fee a cap can actually lower: the exempt ones are fee-free
  // whatever the origination rate was.
  const cappableRows = rows.filter((row) => !row.breakdown.exemptReason)
  /** Exempt tracks have no cap field; this line names them so the count adds up. */
  const exemptTrackNames = [
    ...new Set(
      rows
        .filter((row) => row.breakdown.exemptReason)
        .map((row) => t(`calculator.trackTypes.${row.type}`)),
    ),
  ]
  /** The rate the field shows, suggested or typed; '' while no table is loaded. */
  const shownMarketRate = marketEdited ? manualMarketText.trim() : suggestedMarketRate
  /**
   * True when the priced fee is rounding noise against the balance, which is
   * the case that leaves the chart sitting on zero: the comparison rate is at
   * or barely below the tracks' own rates. Exempt-only mixes are left out - a
   * zero there is about the exemption, and the table says so.
   */
  const feeIsNegligible =
    totalBalance > 0 && feeShare < NEGLIGIBLE_FEE_SHARE_PERCENT && cappableRows.length > 0

  const asOf = rates.data?.tables.find((entry) => entry.status === 'ok')?.asOf ?? null
  const hasTracks = tracks.length > 0
  const hasResult = rows.length > 0

  const marketRateHint =
    manualMarket === null
      ? t('calculator.prepayment.marketRatePlaceholder')
      : t('calculator.prepayment.marketRateManual')

  /**
   * The total field starts the split: typing an amount spreads it
   * cheapest-first across the tracks and fills their fields. From that point
   * the total is a budget, so editing a track moves money inside it; before a
   * total is typed, the track fields are the source and the total follows them.
   */
  const changeTotal =
    (raw: string, caret: number | null): { text: string; caret: number | null } => {
      const result = formatAmountWithCaret(raw, caret)
      const requested = parseAmountText(result.text)
      if (requested <= 0) {
        setTargetMode(false)
        setPartialText(result.text)
        setAllocationTexts({})
        return result
      }
      const auto = cheapestPrepaymentOrder(feeCandidates, requested)
      const next: Record<string, string> = {}
      for (const allocation of auto.allocations) {
        next[allocation.id] = amountText(allocation.amount)
      }
      setTargetMode(true)
      setAllocationTexts(next)
      if (auto.allocated < requested) {
        // More than the whole mix can take: show what will actually be repaid.
        const clamped = amountText(auto.allocated)
        setPartialText(clamped)
        return { text: clamped, caret: null }
      }
      setPartialText(result.text)
      return result
    }

  /**
   * One track's amount field. With a total set, the edit is a move inside that
   * budget: whatever the row gains is taken from the cheapest other rows first,
   * so the total holds and the reader can split it across one or several
   * tracks. Without a total, the rows are the source and the total follows.
   * A value above the track's balance is replaced by the balance on the spot,
   * so the number shown is the number priced.
   */
  const changeAllocation =
    (row: TrackFeeRow) =>
    (raw: string, caret: number | null): { text: string; caret: number | null } => {
      const result = formatAmountWithCaret(raw, caret)
      const requested = parseAmountText(result.text)
      // Rounded like the balance column, so the field and the table agree to
      // the shekel; the plan still caps at the exact balance.
      const cap = Math.round(row.balance)
      const desired = Math.min(requested, cap)
      const next = { ...allocationTexts, [row.id]: desired > 0 ? amountText(desired) : '' }

      if (targetMode) {
        const total = feeCandidates.reduce(
          (sum, candidate) =>
            sum + Math.min(parseAmountText(next[candidate.id] ?? ''), candidate.balance),
          0,
        )
        let excess = Math.max(0, total - targetAmount)
        // Move the excess out of the cheapest rows first: those are the rows the
        // total filled first, so the reader is effectively re-aiming that money.
        for (const id of plan.order) {
          if (excess <= 0) break
          if (id === row.id) continue
          const candidate = feeCandidates.find((entry) => entry.id === id)
          if (!candidate) continue
          const current = Math.min(parseAmountText(next[id] ?? ''), candidate.balance)
          if (current <= 0) continue
          const take = Math.min(current, excess)
          const left = current - take
          next[id] = left > 0 ? amountText(left) : ''
          excess -= take
        }
        // No other row had enough room, so the edited row itself gives way.
        if (excess > 0) {
          const reduced = Math.max(0, desired - excess)
          next[row.id] = reduced > 0 ? amountText(reduced) : ''
        }
        setAllocationTexts(next)
        const shown = next[row.id] ?? ''
        return { text: shown, caret: shown === result.text ? caret : null }
      }

      setAllocationTexts(next)
      const nextTotal = feeCandidates.reduce(
        (sum, candidate) =>
          sum + Math.min(parseAmountText(next[candidate.id] ?? ''), candidate.balance),
        0,
      )
      setPartialText(nextTotal > 0 ? amountText(nextTotal) : '')
      const shown = next[row.id] ?? ''
      return { text: shown, caret: shown === result.text ? caret : null }
    }

  /** Put whatever is still unallocated back in, cheapest track first. */
  const fillRemaining = () => {
    if (!targetMode || remainingAmount <= 0) return
    let left = remainingAmount
    const next = { ...allocationTexts }
    for (const id of plan.order) {
      if (left <= 0) break
      const candidate = feeCandidates.find((entry) => entry.id === id)
      if (!candidate) continue
      const current = Math.min(parseAmountText(next[id] ?? ''), candidate.balance)
      const room = Math.max(0, candidate.balance - current)
      if (room <= 0) continue
      const take = Math.min(room, left)
      next[id] = amountText(current + take)
      left -= take
    }
    setAllocationTexts(next)
  }

  return (
    <section className="schedule-section prepayment-calc" data-testid="prepayment-calculator">
      <div className="section-heading prepayment-heading">
        <div>
          <h2>{t('calculator.prepayment.heading')}</h2>
          <p className="prepayment-lead">{t('calculator.prepayment.lead')}</p>
        </div>
      </div>


      {!hasTracks ? (
        <p className="prepayment-empty-note" data-testid="prepayment-no-mix">
          {t('calculator.prepayment.emptyMix')}
        </p>
      ) : (
        <>
          <div className="prepayment-controls">
            <label className="input-group prepayment-field">
              <span className="prepayment-field-label">
                {t('calculator.prepayment.prepayYearsLabel')}
              </span>
              <span className="input-wrap">
                <input
                  id="prepayment-years"
                  name="prepayment-years"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={lastPrepayYears}
                  step={1}
                  value={prepayYearsText}
                  onChange={(event) => {
                    const raw = event.target.value
                    const parsed = Number.parseFloat(raw)
                    if (Number.isFinite(parsed) && parsed > lastPrepayYears) {
                      setPrepayYearsText(String(lastPrepayYears))
                      return
                    }
                    setPrepayYearsText(raw)
                  }}
                  aria-label={t('calculator.prepayment.prepayYearsLabel')}
                  aria-describedby="prepayment-years-hint"
                  data-testid="prepayment-years"
                />
                <span aria-hidden="true">{t('calculator.prepayment.yearsSuffix')}</span>
              </span>
              <span className="prepayment-field-hint" id="prepayment-years-hint">
                {t('calculator.prepayment.yearsHint', { max: lastPrepayYears })}
              </span>
            </label>

            <label className="input-group prepayment-field">
              <span className="prepayment-field-label">
                {t('calculator.prepayment.marketRateLabel')}
              </span>
              <span className="input-wrap">
                <input
                  id="prepayment-market-rate"
                  name="prepayment-market-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  // The suggestion is only the field's contents until the
                  // reader edits it; after that their text must stay visible
                  // (binding to the suggestion made every keystroke vanish).
                  value={marketEdited ? manualMarketText : suggestedMarketRate}
                  onChange={(event) => {
                    setMarketEdited(true)
                    setManualMarketText(event.target.value)
                  }}
                  placeholder={t('calculator.prepayment.marketRatePlaceholder')}
                  aria-label={t('calculator.prepayment.marketRateLabel')}
                  aria-describedby="prepayment-market-rate-hint"
                  data-testid="prepayment-market-rate"
                  data-suggested={marketEdited ? undefined : 'true'}
                />
                <span aria-hidden="true">%</span>
              </span>
              <span className="prepayment-field-hint" id="prepayment-market-rate-hint">
                {marketRateHint}
              </span>
            </label>

            <label className="input-group prepayment-field">
              <span className="prepayment-field-label">
                {t('calculator.prepayment.partialLabel')}
              </span>
              <MoneyInput
                value={partialText}
                onChange={changeTotal}
                suffix="₪"
                ariaLabel={t('calculator.prepayment.partialLabel')}
                testId="prepayment-partial"
              />
            </label>

            <label className="prepayment-checkbox">
              <input
                id="prepayment-exit-station"
                name="prepayment-exit-station"
                type="checkbox"
                checked={onExitStation}
                onChange={(event) => setOnExitStation(event.target.checked)}
                data-testid="prepayment-exit-station"
              />
              <span>{t('calculator.prepayment.exitStation')}</span>
            </label>
          </div>

          {!hasResult && (
            <div className="prepayment-empty" role="status" data-testid="prepayment-empty">
              <strong>{t('calculator.prepayment.emptyTitle')}</strong>
              <p>{t('calculator.prepayment.empty', { years: prepayYears, last: lastPrepayYears })}</p>
              <button
                type="button"
                className="prepayment-empty-action"
                data-testid="prepayment-empty-action"
                onClick={() => setPrepayYearsText(String(lastPrepayYears))}
              >
                {t('calculator.prepayment.emptyAction', { years: lastPrepayYears })}
              </button>
            </div>
          )}
          {hasResult && (
            <>
              {/* The fee curve opens the results: it prices the same mix
                  against every repayment date, so the chart frames the figures
                  below it. */}
              {chartSeries.length > 0 && (
                <article
                  key={chartBoxVisible ? 'prepayment-chart-card-visible' : 'prepayment-chart-card-hidden'}
                  className={
                    chartBoxVisible
                      ? 'prepayment-chart-card prepayment-chart-card-enter'
                      : 'prepayment-chart-card prepayment-chart-card-reflow'
                  }
                  data-with-chart={chartBoxVisible ? 'true' : 'false'}
                >
                  <div className="prepayment-chart-head">
                    <h3>{t('calculator.prepayment.chartTitle')}</h3>
                    <p className="prepayment-chart-lead">
                      {t('calculator.prepayment.chartLead')}
                    </p>
                    {/* A flat line is the honest answer when the market rate is
                        not below the loan's, so say why instead of letting the
                        zero look like a broken chart. */}
                    {feeIsNegligible && shownMarketRate !== '' && (
                      <p
                        className="prepayment-chart-near-zero"
                        data-testid="prepayment-chart-near-zero"
                      >
                        {t('calculator.prepayment.chartNearZero', { rate: shownMarketRate })}
                      </p>
                    )}
                  </div>
                  <div className="prepayment-chart">
                    <div className="prepayment-chart-plot">
                      <ForecastChart
                        series={chartSeries}
                        ariaLabel={t('calculator.prepayment.chartAria')}
                        axisTitle={t('calculator.prepayment.chartAxisFee')}
                        // The plot is capped at 760px, so its side title can sit
                        // nearer the shekel labels than the half-width cards'.
                        axisTitleX={32}
                        selectedYear={Math.min(prepayYears, lastPrepayYears)}
                        onSelectYear={(year) => setPrepayYearsText(String(year))}
                        // Taller than the forecast cards' plot: this chart shares
                        // its row with the per-year table, and at the standard
                        // height it read as a shorter strip beside it.
                        height={600}
                        testId="prepayment-chart"
                      />
                    </div>
                  </div>
                  <p className="prepayment-chart-caption">
                    {t('calculator.prepayment.chartCaption')}
                  </p>
                  <div className="prepayment-chart-details" data-testid="prepayment-chart-table">
                    {/* The bar is hidden, so the scroller itself is a focusable
                        region: keyboard users reach it with Tab and scroll it
                        with the arrow and Page keys (same as the rates table). */}
                    <div
                      className="prepayment-chart-table"
                      role="region"
                      aria-label={t('calculator.prepayment.chartTitle')}
                      tabIndex={0}
                    >
                      <table aria-label={t('calculator.prepayment.chartTableAria')}>
                        <thead>
                          <tr>
                            <th>{t('calculator.prepayment.chartTableYear')}</th>
                            {chartSeries.map((series) => (
                              <th key={series.id}>{series.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {chartRows.map((row) => (
                            <tr key={row.year}>
                              <th scope="row">{row.year}</th>
                              {row.cells.map((cell) => (
                                <td key={cell.id}>
                                  {cell.fee === undefined ? '-' : formatCurrency(cell.fee)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              )}

              {/* The three headline figures, one card each: the statutory
                  discounting fee, the balance it is charged on, and that fee
                  as a share of the balance. */}
              <div className="prepayment-stats" data-testid="prepayment-stats">
                <article className="prepayment-stat is-primary">
                  <span className="prepayment-stat-label">
                    {t('calculator.prepayment.stats.total')}
                  </span>
                  <strong data-testid="prepayment-kpi-total">{formatCurrency(totalFee)}</strong>
                </article>
                <article className="prepayment-stat">
                  <span className="prepayment-stat-label">
                    {t('calculator.prepayment.stats.balance')}
                  </span>
                  <strong>{formatCurrency(totalBalance)}</strong>
                </article>
                <article className="prepayment-stat">
                  <span className="prepayment-stat-label">
                    {t('calculator.prepayment.stats.share')}
                  </span>
                  <strong data-testid="prepayment-kpi-share">{formatRatePercent(feeShare)}%</strong>
                </article>
              </div>

              {/* The split and the extra charges share the row; the section
                  3(4) cap runs full width underneath, with its rate fields in
                  one row across the band. */}
              <div className="prepayment-result-grid">
                <div className="prepayment-order" data-testid="prepayment-order">
                  <p className="prepayment-order-title">
                    {t('calculator.prepayment.orderTitle')}
                  </p>
                  <p className="prepayment-order-lead">{t('calculator.prepayment.orderLead')}</p>
                  <ol className="prepayment-order-list">
                    {plan.order.map((id, index) => {
                      const row = rowById(id)
                      if (!row) return null
                      const allocated = plan.allocations.find((entry) => entry.id === id)
                      // Every row keeps its cost per ₪1,000, so an empty split
                      // still shows why the list is ordered the way it is.
                      const perThousand =
                        row.balance > 0 ? (row.breakdown.fee / row.balance) * 1000 : 0
                      return (
                        <li className="prepayment-order-row" key={id}>
                          <span className="prepayment-order-rank" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="prepayment-order-name">
                            <span className="prepayment-order-head">
                              <span className="prepayment-order-track">{trackName(id)}</span>
                              {index === 0 && (
                                <span
                                  className="prepayment-order-first"
                                  data-testid="prepayment-order-first"
                                >
                                  {t('calculator.prepayment.orderFirst')}
                                </span>
                              )}
                            </span>
                            {row.breakdown.exemptReason && (
                              <span className="prepayment-order-note">
                                {t(`calculator.prepayment.exempt.${row.breakdown.exemptReason}`)}
                              </span>
                            )}
                            <span
                              className="prepayment-order-note"
                              data-testid={`prepayment-order-per-thousand-${row.type}`}
                            >
                              {t('calculator.prepayment.orderPerThousand', {
                                amount: formatCurrency(perThousand),
                              })}
                            </span>
                          </span>
                          <MoneyInput
                            className="prepayment-order-amount"
                            value={allocationTexts[id] ?? ''}
                            onChange={changeAllocation(row)}
                            suffix="₪"
                            ariaLabel={t('calculator.prepayment.orderAllocateAria', {
                              track: trackName(id),
                            })}
                            testId={`prepayment-allocate-${row.type}`}
                          />
                          <span className="prepayment-order-figure">
                            <span className="prepayment-order-caption">
                              {t('calculator.prepayment.orderFee')}
                            </span>
                            <span
                              className="prepayment-order-value"
                              data-testid={`prepayment-allocate-fee-${row.type}`}
                            >
                              {formatCurrency(allocated?.fee ?? 0)}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                  {partialAmount > 0 && (
                    <div className="prepayment-order-row is-total">
                      <span className="prepayment-order-rank" aria-hidden="true" />
                      <span className="prepayment-order-name">
                        {t('calculator.prepayment.orderTotalLabel')}
                      </span>
                      <span
                        className="prepayment-order-figure"
                        data-testid="prepayment-order-total-amount"
                      >
                        <span className="prepayment-order-caption">
                          {t('calculator.prepayment.orderAmount')}
                        </span>
                        <span className="prepayment-order-value">
                          {formatCurrency(plan.allocated)}
                        </span>
                      </span>
                      <span className="prepayment-order-figure">
                        <span className="prepayment-order-caption">
                          {t('calculator.prepayment.orderFee')}
                        </span>
                        <span className="prepayment-order-value" data-testid="prepayment-order-fee">
                          {formatCurrency(plan.totalFee)}
                        </span>
                      </span>
                    </div>
                  )}
                  {remainingAmount > 0 && (
                    <div
                      className="prepayment-order-remaining"
                      data-testid="prepayment-order-remaining"
                    >
                      <p className="prepayment-order-hint">
                        {t('calculator.prepayment.orderRemaining', {
                          amount: formatCurrency(remainingAmount),
                        })}
                      </p>
                      <button
                        type="button"
                        className="prepayment-order-fill"
                        onClick={fillRemaining}
                        data-testid="prepayment-order-fill"
                      >
                        {t('calculator.prepayment.orderFillRemaining')}
                      </button>
                    </div>
                  )}
                  {partialAmount === 0 && (
                    <p className="prepayment-order-hint">
                      {t('calculator.prepayment.orderNoAmount')}
                    </p>
                  )}
                </div>

                  {/* The charges outside the formula, one row each: the name
                      and the amount share the first line, the hint sits under
                      them, and the checkbox is on that same first line. */}
                  <div className="prepayment-extras-card" data-testid="prepayment-extras">
                    <p className="prepayment-extras-title">
                      {t('calculator.prepayment.extras.title')}
                    </p>
                    <p className="prepayment-extras-lead">
                      {t('calculator.prepayment.extras.lead')}
                    </p>
                    <div className="prepayment-extras-list">
                      <div className="prepayment-extras-row">
                        <span className="prepayment-extras-label">
                          <span className="prepayment-extras-name">
                            {t('calculator.prepayment.extras.operational', {
                              cap: formatCurrency(OPERATIONAL_FEE_CAP),
                            })}
                          </span>
                          <span className="prepayment-extras-hint">
                            {t('calculator.prepayment.extras.operationalHint')}
                          </span>
                        </span>
                        <strong data-testid="prepayment-extras-operational">
                          {formatCurrency(extras.operationalFee)}
                        </strong>
                      </div>
                      <label className="prepayment-extras-row is-toggle">
                        <input
                          id="prepayment-no-notice"
                          name="prepayment-no-notice"
                          type="checkbox"
                          checked={noNotice}
                          onChange={(event) => setNoNotice(event.target.checked)}
                          data-testid="prepayment-extras-no-notice"
                        />
                        <span className="prepayment-extras-label">
                          <span className="prepayment-extras-name">
                            {t('calculator.prepayment.extras.noNotice')}
                          </span>
                          <span className="prepayment-extras-hint">
                            {t('calculator.prepayment.extras.noNoticeHint')}
                          </span>
                        </span>
                        <strong data-testid="prepayment-extras-no-notice-amount">
                          {formatCurrency(extras.noNoticeFee)}
                        </strong>
                      </label>
                      <label className="prepayment-extras-row is-toggle">
                        <input
                          id="prepayment-cpi"
                          name="prepayment-cpi"
                          type="checkbox"
                          checked={firstHalfOfMonth}
                          onChange={(event) => setFirstHalfOfMonth(event.target.checked)}
                          data-testid="prepayment-extras-cpi"
                        />
                        <span className="prepayment-extras-label">
                          <span className="prepayment-extras-name">
                            {t('calculator.prepayment.extras.cpi')}
                          </span>
                          <span className="prepayment-extras-hint">
                            {t('calculator.prepayment.extras.cpiHint')}
                          </span>
                        </span>
                        <strong data-testid="prepayment-extras-cpi-amount">
                          {formatCurrency(extras.cpiCompensationFee)}
                        </strong>
                      </label>
                    </div>
                    <div className="prepayment-extras-total">
                      <span>{t('calculator.prepayment.extras.total')}</span>
                      <strong data-testid="prepayment-extras-total">
                        {formatCurrency(extrasTotalShown)}
                      </strong>
                    </div>
                    <p className="prepayment-note-disclaimer">
                      {t('calculator.prepayment.extras.note')}
                    </p>
                  </div>

                  {/* Section 3(4)'s cap is always open beside the extra charges:
                      it changes the fee column above, so hiding it behind a
                      toggle would leave that column's numbers unexplained. */}
                  {cappableRows.length > 0 && (
                    <div className="prepayment-cap-card" data-testid="prepayment-cap">
                      <p className="prepayment-cap-title">
                        {t('calculator.prepayment.capTitle')}
                      </p>
                      <p className="prepayment-cap-lead">
                        {t('calculator.prepayment.capLead')}
                      </p>
                      {exemptTrackNames.length > 0 && (
                        <p
                          className="prepayment-cap-exempt"
                          data-testid="prepayment-cap-exempt"
                        >
                          {t('calculator.prepayment.capExempt', {
                            tracks: exemptTrackNames.join(', '),
                          })}
                        </p>
                      )}
                      <div className="prepayment-cap-grid">
                        {cappableRows.map((row) => (
                          <label className="input-group prepayment-field" key={row.id}>
                            {t(`calculator.trackTypes.${row.type}`)}
                            <span className="input-wrap">
                              <input
                                id={`prepayment-cap-${row.id}`}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.01}
                                value={capRateTexts[row.id] ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value
                                  setCapRateTexts((current) => ({ ...current, [row.id]: value }))
                                }}
                                placeholder={t('calculator.prepayment.capRatePlaceholder')}
                                aria-label={`${t('calculator.prepayment.capRateLabel')} ${trackName(row.id)}`}
                                data-testid={`prepayment-cap-${row.type}`}
                              />
                              <span aria-hidden="true">%</span>
                            </span>
                            <span
                              className="prepayment-cap-status"
                              data-active={row.breakdown.capApplied}
                              data-testid={`prepayment-cap-status-${row.type}`}
                            >
                              {row.breakdown.capApplied
                                ? t('calculator.prepayment.capStatusActive', {
                                    fee: formatCurrency(row.breakdown.fee),
                                  })
                                : t('calculator.prepayment.capStatusIdle')}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="prepayment-cap-note">
                        {t('calculator.prepayment.capNote')}
                      </p>
                    </div>
                  )}
              </div>

              <div className="table-wrap">
                <table className="prepayment-table">
                  <thead>
                    <tr>
                      <th>{t('calculator.prepayment.table.track')}</th>
                      <th>{t('calculator.prepayment.table.balance')}</th>
                      <th>{t('calculator.prepayment.table.marketRate')}</th>
                      <th>{t('calculator.prepayment.table.fee')}</th>
                      <th>{t('calculator.prepayment.table.rateAddition')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} data-testid={`prepayment-row-${row.type}`}>
                        <td>{t(`calculator.trackTypes.${row.type}`)}</td>
                        <td className="prepayment-num">{formatCurrency(row.balance)}</td>
                        <td className="prepayment-num">{formatRatePercent(row.marketRate)}%</td>
                        {/* The data-testid sits on the text-only span, so a
                            status chip beside it never joins the fee's number. */}
                        <td className="prepayment-num">
                          {row.breakdown.exemptReason ? (
                            <span
                              className="prepayment-chip is-exempt"
                              data-testid={`prepayment-fee-${row.type}`}
                            >
                              {t(`calculator.prepayment.exempt.${row.breakdown.exemptReason}`)}
                            </span>
                          ) : row.breakdown.fee > 0 ? (
                            <>
                              <span data-testid={`prepayment-fee-${row.type}`}>
                                {formatCurrency(row.breakdown.fee)}
                              </span>
                              {row.breakdown.capApplied && (
                                <span className="prepayment-chip">
                                  {t('calculator.prepayment.capped')}
                                </span>
                              )}
                            </>
                          ) : (
                            <span
                              className="prepayment-chip is-zero"
                              data-testid={`prepayment-fee-${row.type}`}
                              title={t('calculator.prepayment.noFeeWhy')}
                            >
                              {t('calculator.prepayment.noFee')}
                            </span>
                          )}
                        </td>
                        <td
                          className="prepayment-num"
                          data-testid={`prepayment-rate-addition-${row.type}`}
                        >
                          {row.breakdown.exemptReason
                            ? '-'
                            : row.rateAddition > 0
                              ? `${formatRatePercent(row.rateAddition)}%`
                              : row.breakdown.fee > 0
                                ? t('calculator.prepayment.rateAdditionTiny')
                                : `${formatRatePercent(0)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className="prepayment-total-row-label">
                        <span className="prepayment-footer-label-wide">
                          {t('calculator.prepayment.stats.balance')}
                        </span>
                        <span className="prepayment-footer-label-narrow">
                          {t('calculator.prepayment.totalLabel')}
                        </span>
                      </th>
                      <td className="prepayment-num" data-testid="prepayment-total-balance">
                        {formatCurrency(totalBalance)}
                      </td>
                      <td className="prepayment-total-label">
                        {t('calculator.prepayment.totalLabel')}
                      </td>
                      <td className="prepayment-num" data-testid="prepayment-total">
                        {formatCurrency(totalFee)}
                      </td>
                      <td aria-hidden="true" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Why the column above can read 0% everywhere: at the suggested
                  comparison rate there is simply no gap to discount. */}
              {totalFee === 0 && cappableRows.length > 0 && (
                <p className="prepayment-note-line prepayment-market-note">
                  {t('calculator.prepayment.noFeeAtMarket')}
                </p>
              )}

              {/* The exemptions are the other reason a row reads 0, and the one
                  readers ask about most: prime and annual-reset tracks never
                  pay the fee, and a five-year track is free on its reset date. */}
              {exemptTrackNames.length > 0 && (
                <p
                  className="prepayment-note-line prepayment-zero-why"
                  data-testid="prepayment-zero-why"
                >
                  {t('calculator.prepayment.zeroWhy')}
                </p>
              )}

              {/* The loyalty discount the law applies by loan age, shown as a
                  step so the fee is not a number that appears from nowhere. */}
              {discountShown > 0 && (
                <div className="prepayment-discount" data-testid="prepayment-discount">
                  <p className="prepayment-discount-title">
                    {t('calculator.prepayment.discount.title')}
                  </p>
                  <dl className="prepayment-discount-list">
                    <div className="prepayment-discount-row">
                      <dt>{t('calculator.prepayment.discount.gross')}</dt>
                      <dd data-testid="prepayment-discount-gross">
                        {formatCurrency(grossShown)}
                      </dd>
                    </div>
                    <div className="prepayment-discount-row is-discount">
                      <dt>
                        {t('calculator.prepayment.discount.amount', {
                          percent: Math.round(discountSummary.discountRate * 100),
                        })}
                      </dt>
                      <dd data-testid="prepayment-discount-amount">
                        -{formatCurrency(discountShown)}
                      </dd>
                    </div>
                    <div className="prepayment-discount-row is-total">
                      <dt>{t('calculator.prepayment.discount.after')}</dt>
                      <dd data-testid="prepayment-discount-after">
                        {formatCurrency(afterShown)}
                      </dd>
                    </div>
                  </dl>
                  <p className="prepayment-discount-hint">
                    {t('calculator.prepayment.discount.hint')}
                  </p>
                </div>
              )}

              {outcomes && (
                <div className="prepayment-outcomes" data-testid="prepayment-outcomes">
                  <p className="prepayment-outcomes-title">
                    {t('calculator.prepayment.outcomes.title')}
                  </p>
                  <p className="prepayment-outcomes-lead">
                    {t('calculator.prepayment.outcomes.lead')}
                  </p>
                  <div className="prepayment-outcomes-grid">
                    <article
                      className="prepayment-outcome enter"
                      data-testid="prepayment-outcome-shorten"
                    >
                      <h4>{t('calculator.prepayment.outcomes.shortenTitle')}</h4>
                      <strong
                        className="prepayment-outcome-payment"
                        data-testid="prepayment-shorten-payment"
                      >
                        {t('calculator.prepayment.outcomes.shortenPayment', {
                          amount: formatCurrency(outcomes.shortenTerm.monthlyPayment),
                        })}
                      </strong>
                      <span
                        className="prepayment-outcome-line"
                        data-testid="prepayment-shorten-term"
                      >
                        {t('calculator.prepayment.outcomes.shortenTerm', {
                          from: formatTerm(outcomes.unchanged.months),
                          to: formatTerm(outcomes.shortenTerm.months),
                        })}
                      </span>
                      <span className="prepayment-outcome-line">
                        {t('calculator.prepayment.outcomes.interestLeft', {
                          amount: formatCurrency(outcomes.shortenTerm.totalInterest),
                        })}
                      </span>
                    </article>

                    <article
                      className="prepayment-outcome enter"
                      data-testid="prepayment-outcome-lower"
                    >
                      <h4>{t('calculator.prepayment.outcomes.lowerTitle')}</h4>
                      <strong
                        className="prepayment-outcome-payment"
                        data-testid="prepayment-lower-payment"
                      >
                        {t('calculator.prepayment.outcomes.lowerPayment', {
                          amount: formatCurrency(outcomes.reducePayment.monthlyPayment),
                        })}
                      </strong>
                      <span className="prepayment-outcome-line">
                        {t('calculator.prepayment.outcomes.lowerWas', {
                          amount: formatCurrency(outcomes.unchanged.monthlyPayment),
                        })}
                      </span>
                      <span
                        className="prepayment-outcome-line"
                        data-testid="prepayment-lower-term"
                      >
                        {t('calculator.prepayment.outcomes.lowerTerm', {
                          term: formatTerm(outcomes.reducePayment.months),
                        })}
                      </span>
                      <span className="prepayment-outcome-line">
                        {t('calculator.prepayment.outcomes.interestLeft', {
                          amount: formatCurrency(outcomes.reducePayment.totalInterest),
                        })}
                      </span>
                    </article>                  </div>
                  <p className="prepayment-outcomes-note leave">
                    {t('calculator.prepayment.outcomes.note')}
                  </p>
                </div>              )}




            </>
          )}

          <p className="prepayment-note-line" aria-live="polite">
            {asOf
              ? t('calculator.prepayment.marketRateSource', { date: asOf })
              : t('calculator.prepayment.marketRateFallback', {
                  rate: formatRatePercent(FALLBACK_MARKET_RATE_PERCENT),
                })}{' '}
            <Link to="/rates">{t('calculator.prepayment.marketRateLink')}</Link>
          </p>
        </>
      )}

      <p className="prepayment-note-line prepayment-disclaimer">
        {t('calculator.prepayment.note')}
      </p>

      {/* Prepayment-penalty education: the four facts the article states, next
          to the fee they explain. Collapsed by default; the article is one
          click away. */}
      <details className="prepayment-note prepayment-facts-note" data-testid="prepayment-note">
        <summary>
          <span className="collapse-caret" aria-hidden="true" />
          {t('education.prepaymentPenalty.title')}
        </summary>
        <p className="prepayment-note-lead">{t('education.prepaymentPenalty.lead')}</p>
        <PrepaymentPenaltyFacts className="prepayment-facts" />
        <p className="prepayment-note-disclaimer">
          {t('education.prepaymentPenalty.disclaimer')}
        </p>
        <Link className="prepayment-note-link" to="/articles/prepayment-penalties">
          {t('education.prepaymentPenalty.articleLink')}
        </Link>
      </details>
    </section>
  )
}
