import { useCallback, useMemo, useState, type CSSProperties } from 'react'
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
import { cheapestPrepaymentOrder, partialPrepaymentOutcomes } from '@/lib/prepayment'
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

/** The priced row the table, chart and outcomes all read. */
type TrackFeeRow = PrepaymentFeeRow

const clampYears = (value: number): number => Math.min(MAX_YEARS, Math.max(1, value))

/**
 * Early-repayment fee (עמלת פירעון מוקדם) - the היוון estimate for the mix
 * currently in the calculator.
 *
 * The math lives in `src/lib/prepayment.ts`; this component only gathers the
 * inputs the formula needs straight from the schedule the user is already
 * looking at (each track's remaining payments and balance at the chosen
 * month), defaults the market comparison rate from the Bank of Israel average
 * tables (item 4), and lays the per-track result out with the cheapest payoff
 * order for a partial prepayment. The same amount then drives both legal
 * outcomes of a partial prepayment, split across tracks by balance: finish
 * earlier, or keep the maturity and lower the payment. A five-year track is
 * priced only to its next reset (section 4(1)), matching the law's shorter
 * horizon.
 *
 * `priceAt` is the whole computation for one prepayment month; the selected
 * month's table and the fee-by-date chart are both built from it, so the two
 * can never disagree, and moving the date costs one recomputation.
 *
 * The היוון fee is the statutory core. The operational fee (up to ₪60 per
 * track), the no-notice fee (up to 0.1%) and the CPI compensation for indexed
 * loans repaid on days 1-15 are not modelled; the panel's note says they are
 * charged on top. Section 3(4)'s origination-rate cap is optional: the user can
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
  const [partialText, setPartialText] = useState('')
  /** If the user has not typed a market rate yet, a single BOI suggestion is
      shown and cleared the moment they type anything themselves. */
  const [suggestedMarketText, setSuggestedMarketText] = useState('')
  /** Optional section 3(4) origination average per track, keyed by row id. */
  const [capRateTexts, setCapRateTexts] = useState<Record<string, string>>({})

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
  const partialAmount = Number.parseFloat(partialText.replace(/[,\s₪]/g, '')) || 0
  const plan = cheapestPrepaymentOrder(
    rows.map((row) => ({ id: row.id, balance: row.balance, fee: row.breakdown.fee })),
    partialAmount,
  )
  const rowById = (id: string): TrackFeeRow | undefined => rows.find((entry) => entry.id === id)
  const trackName = (id: string): string => {
    const row = rowById(id)
    return row ? t(`calculator.trackTypes.${row.type}`) : id
  }

  /**
   * What the partial amount does to each track, under both legal modes.
   *
   * The amount is split across the tracks in proportion to their balances,
   * not by the cheapest-payoff order above: the order answers "which track
   * first" for a chosen amount, while these outcomes answer "what happens to
   * the mortgage" when the same amount is spread over it. A cheapest-first
   * split would leave the longest track untouched, so it could never shorten
   * the mix - the point of one of the two modes.
   */
  const outcomeBalance = rows.reduce((sum, row) => sum + row.balance, 0)
  const outcomeAllocated = Math.min(partialAmount, outcomeBalance)
  const outcomes =
    partialAmount > 0
      ? partialPrepaymentOutcomes(
          rows.map((row) => ({
            balance: row.balance,
            amount: outcomeBalance > 0 ? (outcomeAllocated * row.balance) / outcomeBalance : 0,
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
  const asOf = rates.data?.tables.find((entry) => entry.status === 'ok')?.asOf ?? null
  const hasTracks = tracks.length > 0
  const hasResult = rows.length > 0

  const marketRateHint =
    manualMarket === null
      ? t('calculator.prepayment.marketRatePlaceholder')
      : t('calculator.prepayment.marketRateManual')

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
              {t('calculator.prepayment.prepayYearsLabel')}                  <span className="input-wrap">
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
              {t('calculator.prepayment.marketRateLabel')}
              <span className="input-wrap">
                <input
                  id="prepayment-market-rate"
                  name="prepayment-market-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={suggestedMarketRate}
                  onChange={(event) => {
                    const raw = event.target.value
                    setManualMarketText(raw)
                    setSuggestedMarketText('')
                  }}
                  placeholder={t('calculator.prepayment.marketRatePlaceholder')}
                  aria-label={t('calculator.prepayment.marketRateLabel')}
                  aria-describedby="prepayment-market-rate-hint"
                  data-testid="prepayment-market-rate"
                  data-suggested={suggestedMarketText ? 'true' : undefined}
                />
                <span aria-hidden="true">%</span>
              </span>
              <span className="prepayment-field-hint" id="prepayment-market-rate-hint">
                {marketRateHint}
              </span>
            </label>

            <label className="input-group prepayment-field">
              {t('calculator.prepayment.partialLabel')}
              <MoneyInput
                value={partialText}
                onChange={(raw, caret) => {
                  const result = formatAmountWithCaret(raw, caret)
                  setPartialText(result.text)
                  return result
                }}
                suffix="₪"
                ariaLabel={t('calculator.prepayment.partialLabel')}
                testId="prepayment-partial"
              />
              <span className="prepayment-field-hint">
                {t('calculator.prepayment.partialHint')}
              </span>
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
              </button>                  </div>
              )}              {hasResult && (
            <>
              <div className="prepayment-stats">
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
                  <strong>{formatRatePercent(feeShare)}%</strong>
                </article>
              </div>

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
                        <td className="prepayment-num">
                          {row.rateAddition > 0 ? `${formatRatePercent(row.rateAddition)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">{t('calculator.prepayment.totalLabel')}</th>
                      <td aria-hidden="true" />
                      <td aria-hidden="true" />
                      <td data-testid="prepayment-total">{formatCurrency(totalFee)}</td>
                      <td aria-hidden="true" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {cappableRows.length > 0 && (
                <details className="prepayment-note prepayment-cap" data-testid="prepayment-cap">
                  <summary>
                    <span className="collapse-caret" aria-hidden="true" />
                    {t('calculator.prepayment.capTitle')}
                  </summary>
                  <p className="prepayment-note-lead">{t('calculator.prepayment.capLead')}</p>
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
                  <div
                    className="prepayment-cap-grid"
                    // Column count as a variable, so the phone breakpoint can
                    // still fall back to one field per row.
                    style={
                      { '--cap-columns': Math.min(cappableRows.length, 3) } as CSSProperties
                    }
                  >
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
                  <p className="prepayment-note-disclaimer">{t('calculator.prepayment.capNote')}</p>
                </details>
              )}

              {partialAmount > 0 && (
                <div className="prepayment-order" data-testid="prepayment-order">
                  <p className="prepayment-order-title">
                    {t('calculator.prepayment.orderTitle')}
                  </p>
                  <p className="prepayment-order-lead">{t('calculator.prepayment.orderLead')}</p>
                  <ol className="prepayment-order-list">
                    {plan.allocations.map((allocation, index) => {
                      const row = rowById(allocation.id)
                      return (
                        <li className="prepayment-order-row" key={allocation.id}>
                          <span className="prepayment-order-rank" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="prepayment-order-name">
                            {trackName(allocation.id)}
                            {row?.breakdown.exemptReason && (
                              <span className="prepayment-order-note">
                                {t(`calculator.prepayment.exempt.${row.breakdown.exemptReason}`)}
                              </span>
                            )}
                          </span>
                          <span className="prepayment-order-figure">
                            <span className="prepayment-order-caption">
                              {t('calculator.prepayment.orderAmount')}
                            </span>
                            <span className="prepayment-order-value">
                              {formatCurrency(allocation.amount)}
                            </span>
                          </span>
                          <span className="prepayment-order-figure">
                            <span className="prepayment-order-caption">
                              {t('calculator.prepayment.orderFee')}
                            </span>
                            <span className="prepayment-order-value">
                              {formatCurrency(allocation.fee)}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                  <div className="prepayment-order-row is-total">
                    <span className="prepayment-order-rank" aria-hidden="true" />
                    <span className="prepayment-order-name">
                      {t('calculator.prepayment.orderTotalLabel')}
                    </span>
                    <span className="prepayment-order-figure">
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
                  {plan.allocated < Math.round(partialAmount) && (
                    <p className="prepayment-order-capped">
                      {t('calculator.prepayment.orderPartial', {
                        allocated: formatCurrency(plan.allocated),
                      })}
                    </p>
                  )}
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
    </section>
  )
}
