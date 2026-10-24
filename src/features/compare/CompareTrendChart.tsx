'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import {
  formatAxisShekel,
  formatAxisShekelDetailed,
  niceRange,
  niceTicks,
  svgRound,
  xAxisTicks,
} from '@/lib/charts'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import {
  compositionSegments,
  trendValues,
  type CompositionSegment,
  type TrendMetric,
  type TrendSourceRow,
} from './trend'

/**
 * The comparison's trend charts: one small chart per metric, each plotting every
 * mix so the differences read at a glance (no toggling between them).
 *
 * The composition chart comes first, across the full width of the gallery, and
 * mirrors the calculator's combined chart: stacked קרן נטו / הצמדה / ריבית
 * columns per mix per year, from the same shared payment-composition helper.
 * The other metrics fall two per row beneath it, each with its own
 * visual language so they do not read as copies: remaining debt is a filled
 * area, cumulative paid a line with a dot per year, cumulative interest a
 * dashed line, cumulative indexation a dotted line, and the early-repayment
 * fee (the היוון a mix would owe at each year end) a plain line with a dot per
 * priced year. The rate-reset panel (the calculator's base / +step / -step
 * payment paths) is a peer of those line panels, next to the fee curve rather
 * than a section of its own: one card, one mix color, a no-change line and a
 * shaded step range.
 * Indexation is optional (hidden when no mix is indexed), and so is the fee
 * (hidden when no mix owes anything). The rate panel stays for every priced
 * mix: a mix with no contractual reset draws its no-change path alone, so a
 * fixed-only mix or a term shorter than the first reset still has a card. On
 * the cumulative-
 * interest chart a mix that ends before the horizon drops vertically to the
 * axis at its term year, so its line visibly closes instead of stopping
 * mid-air; the balance and total lines simply end at their own term. One color
 * per mix,
 * one shared legend above the grid; hovering a year shows every mix's value for
 * that chart. Each chart repeats its data as text for screen readers - never
 * chart-only.
 *
 * Measured (ResizeObserver) and rendered at real pixel size so axis text keeps a
 * legible size at every viewport. Axis labels are compact (₪8K / ₪1.4M) and all
 * text is drawn AFTER the series so a line can never cover it.
 */

export interface TrendSeries {
  /** The mix name shown in the legend and tooltip. */
  label: string
  /** The scenario's yearly schedule (its own term; a shorter mix ends early). */
  schedule: TrendSourceRow[]
}

/** The line panels, ordered like the reference gallery: debt first. */
const LINE_METRICS: TrendMetric[] = ['balance', 'total', 'interest', 'indexation', 'prepayment']

/** The full-width stacked-column panel (קרן + ריבית per year and mix). */
const COMPOSITION_METRIC = 'composition' as const

/** What a panel can draw: one of the line metrics, or the composition bars. */
type PanelMetric = TrendMetric | typeof COMPOSITION_METRIC

/** Metrics drawn as a filled area under the line; the rest stay plain lines. */
const AREA_METRICS: PanelMetric[] = ['balance']

/** One color per mix, up to the scenario maximum; themed in globals.css. */
const SERIES_TOKENS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
]

/** The lighter shade of each mix color, for the stacked bars' ריבית segment. */
const SERIES_SOFT_TOKENS = [
  'var(--series-1-soft)',
  'var(--series-2-soft)',
  'var(--series-3-soft)',
  'var(--series-4-soft)',
]

const HEIGHT = 240
const TOP = 18
const BOTTOM = 40
const MARGIN_LEFT = 78
const MARGIN_RIGHT = 18

/** The chart heading for each metric (also its screen-reader summary heading). */
function metricTitleKey(metric: PanelMetric): string {
  switch (metric) {
    case 'balance':
      return 'compare.remainingBalanceTitle'
    case 'interest':
      return 'compare.cumulativeInterestTitle'
    case 'total':
      return 'compare.totalPaymentsTitle'
    case 'indexation':
      return 'compare.cumulativeIndexationTitle'
    case 'prepayment':
      return 'compare.prepaymentFeeTitle'
    case 'composition':
      return 'compare.paymentCompositionTitle'
    default:
      return 'compare.paymentTrendTitle'
  }
}

/** The left-axis caption: what the ₪ ticks count for this metric. */
function metricAxisKey(metric: PanelMetric): string {
  switch (metric) {
    case 'balance':
      return 'calculator.charts.axisBalance'
    case 'interest':
      return 'compare.axisCumulativeInterest'
    case 'total':
      return 'compare.axisTotalPaid'
    case 'indexation':
      return 'compare.axisCumulativeIndexation'
    case 'prepayment':
      return 'compare.axisPrepaymentFee'
    default:
      return 'calculator.charts.axisMonthlyPayment'
  }
}

/** Measure the plot box so the SVG renders at real pixels (text never scales).
    Keyed on the element itself, so a plot that mounts after the first render
    (the store seeds on the client) is still measured. */
function useMeasuredWidth(element: HTMLDivElement | null): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return width
}

interface TrendLine {
  label: string
  token: string
  points: { year: number; value: number }[]
  /** Last year the mix actually runs (the horizon when it is the longest). */
  termYear: number
}

/** One mix's per-year amount split into its three stack segments (monthly ₪). */
interface BarSeries {
  label: string
  token: string
  tokenSoft: string
  segments: CompositionSegment[]
}

/** One metric's chart: every mix as a line on the same axes (or grouped stacked
    bars for the payment metric, which mirrors the calculator's combined chart). */
function TrendPanel({
  metric,
  lines,
  bars,
  maxYear,
  testIdPrefix,
  wide = false,
}: {
  metric: PanelMetric
  lines: TrendLine[]
  /** Present only for the composition metric: stacked קרן/ריבית bars, one per mix. */
  bars?: BarSeries[]
  maxYear: number
  testIdPrefix: string
  /** Spans the full grid row (the composition panel leads the gallery). */
  wide?: boolean
}) {
  const { t } = useTranslation()
  const plotRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [plotEl, setPlotEl] = useState<HTMLDivElement | null>(null)
  const [active, setActive] = useState<number | null>(null)
  // The tooltip clamp needs a stable ref object; the measurement needs the
  // element itself (it may mount only after the store seeds on the client).
  const attachPlot = useCallback((node: HTMLDivElement | null) => {
    plotRef.current = node
    setPlotEl(node)
  }, [])
  const width = useMeasuredWidth(plotEl)
  useTooltipClamp(tooltipRef, plotRef, active)

  const title = t(metricTitleKey(metric))
  const axisLabel = t(metricAxisKey(metric))
  // Unique per panel: gradients/patterns are referenced by id, and the id has to
  // stay stable across renders (React re-uses the same <defs>).
  const areaId = (index: number) => `${testIdPrefix}-area-${index}`
  // ריבית is hatched in its mix's own color, so the split reads the same for
  // every mix without inventing a second color per series.
  const hatchId = (index: number) => `${testIdPrefix}-hatch-${index}`

  const layout = useMemo(() => {
    if (width <= 0 || maxYear === 0) return null
    const innerW = Math.max(1, width - MARGIN_LEFT - MARGIN_RIGHT)
    const innerH = HEIGHT - TOP - BOTTOM
    const pad = Math.min(innerW * 0.03, 14)
    const plotW = innerW - pad * 2
    const slot = plotW / maxYear
    const x = (year: number) => svgRound(MARGIN_LEFT + pad + slot * (year - 0.5))
    return { innerW, innerH, pad, slot, x }
  }, [width, maxYear])

  // Net principal can dip below zero on a long indexed mix, so the
  // composition panel needs room under the axis instead of clamping it.
  const hasNegativeNet =
    bars?.some((bar) => bar.segments.some((segment) => segment.principalNet < 0)) ?? false
  const hasIndexation =
    bars?.some((bar) => bar.segments.some((segment) => segment.indexation > 0)) ?? false

  const geometry = useMemo(() => {
    if (!layout) return null
    const maxValue = Math.max(
      1,
      ...lines.flatMap((line) => line.points.map((point) => point.value)),
    )
    const minValue = bars
      ? Math.min(0, ...bars.flatMap((bar) => bar.segments.map((segment) => segment.principalNet)))
      : 0
    const range = minValue < 0 ? niceRange(minValue, maxValue) : null
    const ticks = range ? range.ticks : niceTicks(maxValue)
    const axisMin = range ? range.axisMin : 0
    const scaleMax = range
      ? range.axisMax
      : Math.max(maxValue, ticks[ticks.length - 1] ?? maxValue)
    const y = (value: number) =>
      svgRound(TOP + layout.innerH * (1 - (value - axisMin) / (scaleMax - axisMin)))
    return { ticks, y, zeroY: y(0) }
  }, [layout, lines, bars])

  const yearTicks = useMemo(() => xAxisTicks(maxYear, false), [maxYear])

  /**
   * The polyline for one mix. Only cumulative interest gets the vertical
   * terminator: a mix that finishes before the horizon drops to the axis at
   * its term year, so its line visibly closes (user-requested). Balance and
   * total simply end at their own term.
   */
  const linePath = (line: TrendLine): string => {
    if (!layout || !geometry) return ''
    const segments = line.points.map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${layout.x(point.year)} ${geometry.y(point.value)}`,
    )
    if (metric === 'interest' && line.termYear > 0 && line.termYear < maxYear) {
      segments.push(`L ${layout.x(line.termYear)} ${geometry.y(0)}`)
    }
    return segments.join(' ')
  }

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!layout || !svgRef.current) return
    const bounds = svgRef.current.getBoundingClientRect()
    const relative = ((event.clientX - bounds.left) / bounds.width) * width - MARGIN_LEFT
    const index = Math.floor((relative - layout.pad) / Math.max(layout.slot, 1e-9))
    setActive(Math.max(0, Math.min(maxYear - 1, index)))
  }

  const activeYear = active !== null ? active + 1 : null
  const isArea = AREA_METRICS.includes(metric)

  return (
    <div className={`compare-trend${wide ? ' compare-trend-wide' : ''}`} data-testid={testIdPrefix}>
      <h3 className="compare-trend-title">{title}</h3>
      {/* Always rendered (empty for the line metrics) so every panel's header is
          the same height and the plots stay aligned across a row. */}
      <div className="compare-trend-inline-legend">
        {bars && bars.length > 0 && (
          <>
            <span>
              <i className="compare-trend-swatch compare-trend-swatch-principal" />
              {t('calculator.charts.netPrincipalLabel')}
            </span>
            {hasIndexation && (
              <span>
                <i className="compare-trend-swatch compare-trend-swatch-indexation" />
                {t('calculator.schedule.indexationHeader')}
              </span>
            )}
            <span>
              <i className="compare-trend-swatch compare-trend-swatch-interest" />
              {t('calculator.schedule.interestHeader')}
            </span>
          </>
        )}
      </div>
      <div className="compare-trend-plot" ref={attachPlot} data-testid={`${testIdPrefix}-plot`}>
        {geometry && layout && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            direction="ltr"
            role="img"
            aria-label={t('compare.chartAria', { mode: title })}
            onMouseMove={handleMove}
            onMouseLeave={() => setActive(null)}
            onClick={handleMove}
          >
            <defs>
              {lines.map((line, index) => (
                <linearGradient
                  key={`grad-${index}`}
                  id={areaId(index)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" style={{ stopColor: line.token, stopOpacity: 0.26 }} />
                  <stop offset="45%" style={{ stopColor: line.token, stopOpacity: 0.05 }} />
                  <stop offset="100%" style={{ stopColor: line.token, stopOpacity: 0 }} />
                </linearGradient>
              ))}
              {bars?.map((bar, index) => (
                <pattern
                  key={`hatch-${index}`}
                  id={hatchId(index)}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill={bar.tokenSoft} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={bar.token} strokeWidth="1.6" />
                </pattern>
              ))}
            </defs>

            {geometry.ticks.map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={MARGIN_LEFT}
                x2={width - MARGIN_RIGHT}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                className="compare-trend-gridline"
              />
            ))}

            {bars
              ? bars.length > 0 &&
                Array.from({ length: maxYear }, (_, yearIndex) => {
                  const year = yearIndex + 1
                  const zeroY = geometry.zeroY
                  // Each year is one group of side-by-side stacked bars (one per
                  // mix): net principal at the base, indexation above it and
                  // interest on top. Net principal is the mix color, interest
                  // its lighter hatch, and indexation keeps the app's one
                  // indexation color across every mix.
                  const groupW = Math.min(layout.slot * 0.9, bars.length * 22)
                  const barW = groupW / bars.length
                  const groupLeft = layout.x(year) - groupW / 2
                  const gap = Math.max(0.6, barW * 0.14)
                  const barX = (barIndex: number) =>
                    svgRound(groupLeft + barIndex * barW + gap / 2)
                  const barWidth = svgRound(Math.max(0.8, barW - gap))
                  return bars.map((bar, barIndex) => {
                    const segment = bar.segments[yearIndex]
                    if (!segment) return null
                    const netTop = geometry.y(segment.principalNet)
                    const principalTop = geometry.y(segment.principalNet + segment.indexation)
                    const paymentTop = geometry.y(segment.payment)
                    return (
                      <g key={`bar-${year}-${barIndex}`}>
                        <rect
                          x={barX(barIndex)}
                          y={Math.min(zeroY, netTop)}
                          width={barWidth}
                          height={Math.abs(zeroY - netTop)}
                          className="compare-trend-bar"
                          style={{ fill: bar.token }}
                        />
                        {hasIndexation && (
                          <rect
                            x={barX(barIndex)}
                            y={Math.min(netTop, principalTop)}
                            width={barWidth}
                            height={Math.abs(principalTop - netTop)}
                            className="compare-trend-bar compare-trend-bar-indexation"
                          />
                        )}
                        <rect
                          x={barX(barIndex)}
                          y={Math.min(principalTop, paymentTop)}
                          width={barWidth}
                          height={Math.abs(paymentTop - principalTop)}
                          className="compare-trend-bar"
                          style={{ fill: `url(#${hatchId(barIndex)})` }}
                        />
                      </g>
                    )
                  })
                })
              : (
                  <>
                    {isArea &&
                      lines.map((line, index) => {
                        const first = line.points[0]
                        const last = line.points[line.points.length - 1]
                        if (!first || !last) return null
                        const baseline = geometry.y(0)
                        const top = line.points
                          .map(
                            (point, pointIndex) =>
                              `${pointIndex === 0 ? 'M' : 'L'} ${layout.x(point.year)} ${geometry.y(point.value)}`,
                          )
                          .join(' ')
                        return (
                          <path
                            key={`area-${index}`}
                            d={`${top} L ${layout.x(last.year)} ${baseline} L ${layout.x(first.year)} ${baseline} Z`}
                            className="compare-trend-area"
                            style={{ fill: `url(#${areaId(index)})` }}
                          />
                        )
                      })}

                    {lines.map((line, index) => (
                      <path
                        key={`line-${index}`}
                        d={linePath(line)}
                        className={
                          metric === 'interest'
                            ? 'compare-trend-line compare-trend-line-dashed'
                            : metric === 'indexation'
                              ? 'compare-trend-line compare-trend-line-dotted'
                              : 'compare-trend-line'
                        }
                        style={{ stroke: line.token }}
                      />
                    ))}

                    {/* Cumulative paid and the fee curve carry a dot per year:
                        points-in-time read differently from the smooth
                        cumulative lines, and the fee is the one amount that
                        is not cumulative at all. */}
                    {(metric === 'total' || metric === 'prepayment') &&
                      lines.map((line, index) =>
                        line.points.map((point) => (
                          <circle
                            key={`point-${index}-${point.year}`}
                            cx={layout.x(point.year)}
                            cy={geometry.y(point.value)}
                            r={2.4}
                            className="compare-trend-point"
                            style={{ stroke: line.token }}
                          />
                        )),
                      )}
                  </>
                )}

            {/* Only interior when a net-principal segment dips below zero. It
                is drawn over the bars so the indexation band crossing zero
                cannot hide the baseline. */}
            {hasNegativeNet && (
              <line
                x1={MARGIN_LEFT}
                x2={width - MARGIN_RIGHT}
                y1={geometry.zeroY}
                y2={geometry.zeroY}
                className="compare-trend-zero-line"
              />
            )}

            {active !== null && (
              <>
                <line
                  x1={layout.x(active + 1)}
                  x2={layout.x(active + 1)}
                  y1={TOP}
                  y2={TOP + layout.innerH}
                  className="compare-trend-guide"
                />
                {!bars &&
                  lines.map((line, index) => {
                    const point = line.points[active]
                    if (!point) return null
                    return (
                      <circle
                        key={`dot-${index}`}
                        cx={layout.x(point.year)}
                        cy={geometry.y(point.value)}
                        r={5}
                        className="compare-trend-dot"
                        style={{ stroke: line.token }}
                      />
                    )
                  })}
              </>
            )}

            {/* Axis text drawn last so the series can never cover it. */}
            {geometry.ticks.map((tick) => (
              <text
                key={`tick-${tick}`}
                x={MARGIN_LEFT - 8}
                y={geometry.y(tick) + 4}
                className="compare-trend-tick compare-trend-tick-end"
              >
                {formatAxisShekel(tick)}
              </text>
            ))}
            {yearTicks.map((tick) => {
              // Thin the year labels when the chart is narrow: keep at least
              // ~26px between labels so they never crowd into each other.
              if (tick.label === null) return null
              const every = Math.max(1, Math.ceil(26 / Math.max(layout.slot, 1)))
              if (tick.index % every !== 0) return null
              return (
                <text
                  key={`year-${tick.index}`}
                  x={layout.x(tick.index + 1)}
                  y={HEIGHT - 20}
                  className="compare-trend-tick"
                >
                  {tick.label}
                </text>
              )
            })}
            <text
              x={12}
              y={TOP + layout.innerH / 2}
              className="compare-trend-axis-title"
              transform={`rotate(-90 12 ${TOP + layout.innerH / 2})`}
            >
              {axisLabel}
            </text>
          </svg>
        )}

        {activeYear !== null && layout && geometry && (
          <div
            ref={tooltipRef}
            className={`compare-trend-tooltip${bars ? ' compare-trend-tooltip-composition' : ''}`}
            role="status"
            style={{ left: `${((layout.x(activeYear) / width) * 100).toFixed(1)}%` }}
          >
            <strong>{t('calculator.charts.yearLabel', { year: activeYear })}</strong>
            {bars
              ? // Composition: quote all three stacked segments, not just the
                // total. The mix label appears once per row; the tooltip wraps
                // on narrow plots instead of overhanging them.
                bars.map((bar, index) => {
                  const segment = bar.segments[activeYear - 1]
                  if (!segment) return null
                  return (
                    <span key={`tip-${index}`} className="compare-trend-tooltip-row">
                      <i
                        className="compare-trend-swatch"
                        style={{ background: bar.token }}
                        aria-hidden="true"
                      />
                      {bar.label}: {t('calculator.charts.netPrincipalLabel')}{' '}
                      {formatCurrency(segment.principalNet)}
                      {hasIndexation && (
                        <>
                          {' · '}
                          {t('calculator.schedule.indexationHeader')}{' '}
                          {formatCurrency(segment.indexation)}
                        </>
                      )}
                      {' · '}
                      {t('calculator.schedule.interestHeader')}{' '}
                      {formatCurrency(segment.interest)}
                    </span>
                  )
                })
              : lines.map((line, index) => {
                  const point = line.points[activeYear - 1]
                  if (!point) return null
                  return (
                    <span key={`tip-${index}`} className="compare-trend-tooltip-row">
                      <i
                        className="compare-trend-swatch"
                        style={{ background: line.token }}
                        aria-hidden="true"
                      />
                      {line.label}: {formatCurrency(point.value)}
                    </span>
                  )
                })}
          </div>
        )}
      </div>

      {/* Text equivalent of the chart (charts are never chart-only). The
          composition panel repeats every component year by year; the line
          panels keep their from-to summary. */}
      <h4 className="sr-only">{title}</h4>
      {bars ? (
        <div className="sr-only" data-testid={`${testIdPrefix}-summary`}>
          {bars.map((bar, index) => (
            <table
              key={`sum-${index}`}
              data-testid={`${testIdPrefix}-table-${index}`}
              aria-label={bar.label}
            >
              <caption>{bar.label}</caption>
              <thead>
                <tr>
                  <th>{t('calculator.forecast.tableYear')}</th>
                  <th>{t('calculator.charts.netPrincipalLabel')}</th>
                  {hasIndexation && <th>{t('calculator.schedule.indexationHeader')}</th>}
                  <th>{t('calculator.schedule.interestHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {bar.segments.map((segment) => (
                  <tr key={segment.year}>
                    <th scope="row">{segment.year}</th>
                    <td>{formatCurrency(segment.principalNet)}</td>
                    {hasIndexation && <td>{formatCurrency(segment.indexation)}</td>}
                    <td>{formatCurrency(segment.interest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ) : (
        <ul className="sr-only" data-testid={`${testIdPrefix}-summary`}>
          {lines.map((line, index) => (
            <li key={`sum-${index}`}>
              {t('compare.trendSeriesLine', {
                label: line.label,
                from: formatCurrency(line.points[0]?.value ?? 0),
                to: formatCurrency(line.points[line.points.length - 1]?.value ?? 0),
              })}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The optional rate-reset panel: one group per priced mix that resets. */
export interface RateScenarios {
  groups: RateScenarioGroup[]
  /** Years in which any compared mix resets its rate. */
  markers: number[]
  /** The per-reset percentage-point move the scenario names quote. */
  step: number
}

export function CompareTrendChart({
  series,
  rateScenarios,
  testIdPrefix = 'compare-trend',
}: {
  series: TrendSeries[]
  /** Present only when some mix has a contractual reset to chart. */
  rateScenarios?: RateScenarios
  testIdPrefix?: string
}) {
  const { t } = useTranslation()
  if (series.length === 0) {
    return (
      <div className="compare-trend-empty" data-testid={`${testIdPrefix}-empty`}>
        {t('compare.chartsEmpty')}
      </div>
    )
  }

  // The x axis spans every mix. A shorter mix ends at its own term (the
  // interest chart drops a terminator there). The schedule length is the same
  // for a mix whichever metric is charted.
  const maxYear = series.reduce((max, entry) => Math.max(max, entry.schedule.length), 0)

  // Indexation is worth a panel only when some mix actually carries an indexed
  // track; a gallery of flat-zero lines would just add noise, so a fully
  // non-indexed comparison keeps the original four panels.
  const hasIndexation = series.some((entry) =>
    entry.schedule.some((row) => row.indexation > 0),
  )
  // Same rule for the fee: when no mix owes anything at any year end the panel
  // would be a flat line on the axis, so it is left out entirely.
  const hasPrepayment = series.some((entry) =>
    entry.schedule.some((row) => (row.prepaymentFee ?? 0) > 0),
  )
  const lineMetrics = LINE_METRICS.filter(
    (metric) =>
      (metric !== 'indexation' || hasIndexation) && (metric !== 'prepayment' || hasPrepayment),
  )

  /** One mix's per-year series for a metric. */
  const lineFor = (entry: TrendSeries, index: number, metric: TrendMetric): TrendLine => {
    const points = trendValues(entry.schedule, metric)
    return {
      label: entry.label,
      token: SERIES_TOKENS[index % SERIES_TOKENS.length],
      termYear: points[points.length - 1]?.year ?? 0,
      points,
    }
  }

  // The composition chart mirrors the calculator's combined chart: per year,
  // one stacked column per mix, split into קרן נטו / הצמדה / ריבית from the
  // same shared helper - each as the year's average monthly amount (the
  // yearly total over 12) so the axis stays "monthly payment".
  const barSeries: BarSeries[] = series.map((entry, index) => ({
    label: entry.label,
    token: SERIES_TOKENS[index % SERIES_TOKENS.length],
    tokenSoft: SERIES_SOFT_TOKENS[index % SERIES_SOFT_TOKENS.length],
    segments: compositionSegments(entry.schedule),
  }))

  return (
    <div className="compare-trend-grid" data-testid={testIdPrefix}>
      <ul
        className="compare-trend-legend"
        aria-label={t('compare.trendLegendAria')}
        data-testid={`${testIdPrefix}-legend`}
      >
        {series.map((entry, index) => (
          <li key={`legend-${index}`}>
            <i
              className="compare-trend-swatch"
              style={{ background: SERIES_TOKENS[index % SERIES_TOKENS.length] }}
              aria-hidden="true"
            />
            {entry.label}
          </li>
        ))}
      </ul>
      <TrendPanel
        metric={COMPOSITION_METRIC}
        maxYear={maxYear}
        testIdPrefix={`${testIdPrefix}-${COMPOSITION_METRIC}`}
        bars={barSeries}
        wide
        // The tooltip and the screen-reader summary quote the mix's total
        // monthly payment next to the two stacked segments.
        lines={series.map((entry, index) => lineFor(entry, index, 'payment'))}
      />
      {lineMetrics.map((metric) => (
        <TrendPanel
          key={metric}
          metric={metric}
          maxYear={maxYear}
          testIdPrefix={`${testIdPrefix}-${metric}`}
          lines={series.map((entry, index) => lineFor(entry, index, metric))}
        />
      ))}
      {/* Same card, same width, directly after the fee curve: the rate paths
          read as one more metric of the same comparison, not a separate
          section. */}
      {rateScenarios && rateScenarios.groups.length > 0 && (
        <RateScenarioChart
          groups={rateScenarios.groups}
          markers={rateScenarios.markers}
          step={rateScenarios.step}
          spanYear={maxYear}
        />
      )}
    </div>
  )
}

/** One payment path in a mix's rate scenario: no change, +step or -step. */
export interface RateScenarioPath {
  id: string
  label: string
  dash?: 'dashed' | 'dotted'
  points: { year: number; value: number }[]
}

/** One mix's three rate paths, all in the mix's own color. */
export interface RateScenarioGroup {
  key: string
  label: string
  color: string
  paths: RateScenarioPath[]
  /** Contractual reset years (empty when no track resets within its term). */
  resetYears: number[]
}

/**
 * The comparison's rate-reset forecast as one panel of the trend gallery:
 * same card, title, measured width and 240px plot as the other metrics, placed
 * next to the fee curve. One color per mix, one solid no-change line, and a
 * shaded band between the +step and -step paths, with a marker at every reset
 * year. Drawing the three paths as three full strokes turned the panel into a
 * thicket once more than one mix was priced, so the two step paths became the
 * band's edges instead; their exact values stay in the hover tooltip and the
 * table per mix. A mix without a contractual reset contributes a single
 * no-change line and no band. The mix colors are named once in the gallery's
 * shared legend, so the card repeats only the strokes it actually draws. The
 * figures are also exposed as a table per mix for screen readers, so the panel
 * stays graph-only on screen without being chart-only for assistive tech.
 */
export function RateScenarioChart({
  groups,
  markers,
  step,
  spanYear,
  testId = 'compare-rate-chart',
}: {
  groups: RateScenarioGroup[]
  markers: number[]
  /** The per-reset percentage-point move used by the scenario names. */
  step: number
  /** The gallery's shared x-axis span, so the card aligns with its row peer. */
  spanYear?: number
  testId?: string
}) {
  const { t, i18n } = useTranslation()
  const plotRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [plotEl, setPlotEl] = useState<HTMLDivElement | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const attachPlot = useCallback((node: HTMLDivElement | null) => {
    plotRef.current = node
    setPlotEl(node)
  }, [])
  const width = useMeasuredWidth(plotEl)
  useTooltipClamp(tooltipRef, plotRef, active)

  // A locale-aware list ("6 and 11" / "6 ו-11") so the years do not reverse
  // visually in RTL.
  const formatResetYears = (years: number[]): string =>
    new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(
      years.map(String),
    )

  const paths = useMemo(
    () =>
      groups.flatMap((group) =>
        group.paths.map((path) => ({
          ...path,
          color: group.color,
          mix: group.label,
          mixKey: group.key,
        })),
      ),
    [groups],
  )

  // One no-change line per mix, and one shaded band for the step range. Three
  // full strokes per mix turned the panel into a thicket once several mixes
  // were priced; the band keeps the same range readable, while the tooltip and
  // the table below still quote each path exactly.
  const bands = useMemo(
    () =>
      groups.flatMap((group) => {
        const up = group.paths.find((path) => path.dash === 'dashed')
        const down = group.paths.find((path) => path.dash === 'dotted')
        return up && down ? [{ key: group.key, color: group.color, up, down }] : []
      }),
    [groups],
  )

  const basePaths = useMemo(
    () =>
      groups.flatMap((group) => {
        const base = group.paths.find((path) => path.dash === undefined) ?? group.paths[0]
        return base ? [{ key: group.key, color: group.color, path: base }] : []
      }),
    [groups],
  )

  const dataMaxYear = useMemo(
    () =>
      groups.reduce(
        (max, group) =>
          Math.max(max, ...group.paths.flatMap((path) => path.points.map((point) => point.year))),
        0,
      ),
    [groups],
  )
  // Match the gallery's axis: a mix that resets for a shorter term still sits
  // on the same year scale as the fee curve next to it.
  const maxYear = Math.max(dataMaxYear, spanYear ?? 0)

  const layout = useMemo(() => {
    if (width <= 0 || maxYear === 0) return null
    const innerW = Math.max(1, width - MARGIN_LEFT - MARGIN_RIGHT)
    const innerH = HEIGHT - TOP - BOTTOM
    const pad = Math.min(innerW * 0.03, 14)
    const plotW = innerW - pad * 2
    const slot = plotW / maxYear
    const x = (year: number) => svgRound(MARGIN_LEFT + pad + slot * (year - 0.5))
    return { innerW, innerH, pad, slot, x }
  }, [width, maxYear])

  const geometry = useMemo(() => {
    if (!layout || paths.length === 0) return null
    const values = paths.flatMap((path) => path.points.map((point) => Math.max(0, point.value)))
    if (values.length === 0) return null
    const maxValue = Math.max(...values)
    const minValue = Math.min(...values)
    // A payment axis is zoomed to the data: a 1pp reset is a small step, and a
    // zero baseline would flatten every path into the same line. The detailed
    // tick formatter keeps the shekel labels distinct on that narrow range.
    const padding = Math.max((maxValue - minValue) * 0.08, maxValue * 0.01, 1)
    const range = niceRange(Math.max(0, minValue - padding), maxValue + padding)
    const span = Math.max(range.axisMax - range.axisMin, 1e-9)
    const y = (value: number) =>
      svgRound(
        TOP +
          layout.innerH *
            (1 - (Math.max(range.axisMin, Math.min(range.axisMax, value)) - range.axisMin) / span),
      )
    return { ticks: range.ticks, y }
  }, [layout, paths])

  const yearTicks = useMemo(() => xAxisTicks(maxYear, false), [maxYear])
  const resetYears = useMemo(
    () =>
      Array.from(new Set(markers)).filter((year) => year >= 1 && year <= maxYear),
    [markers, maxYear],
  )
  // With no contractual reset every path is the no-change one, so the band key
  // is left out instead of promising a range the chart does not draw.
  const hasSteps = bands.length > 0
  // A fixed, prime or fixed-indexed mix has no contractual reset, so its three
  // forecast paths are identical and only one line is drawn. Say so instead of
  // leaving the missing band to look like missing data.
  const rateNote =
    bands.length === 0
      ? t('compare.rateScenarioNoResetNote')
      : bands.length < basePaths.length
        ? t('compare.rateScenarioPartialNote')
        : null
  const activeYear = active !== null ? active + 1 : null

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!layout || !svgRef.current) return
    const bounds = svgRef.current.getBoundingClientRect()
    const relative = ((event.clientX - bounds.left) / bounds.width) * width - MARGIN_LEFT
    const index = Math.floor((relative - layout.pad) / Math.max(layout.slot, 1e-9))
    setActive(Math.max(0, Math.min(maxYear - 1, index)))
  }

  const pathFor = (path: RateScenarioPath): string => {
    if (!layout || !geometry) return ''
    return path.points
      .map((point, index) => {
        const px = layout.x(point.year)
        const py = geometry.y(point.value)
        if (index === 0) return `M ${px} ${py}`
        const previous = path.points[index - 1]
        return `L ${px} ${geometry.y(previous.value)} L ${px} ${py}`
      })
      .join(' ')
  }

  /**
   * The band between the two step paths: the upper edge forward, the lower
   * edge back, closed. Both edges keep the step shape (horizontal until the
   * next year, then vertical), so the fill follows the real payment jumps
   * instead of sloping through them.
   */
  const bandFor = (
    upper: RateScenarioPath['points'],
    lower: RateScenarioPath['points'],
  ): string => {
    if (!layout || !geometry) return ''
    const count = Math.min(upper.length, lower.length)
    if (count === 0) return ''
    const upperVertices: string[] = []
    const lowerVertices: string[] = []
    for (let index = 0; index < count; index++) {
      const px = layout.x(upper[index].year)
      const upperY = geometry.y(upper[index].value)
      const lowerY = geometry.y(lower[index].value)
      if (index === 0) {
        upperVertices.push(`${px} ${upperY}`)
        lowerVertices.push(`${px} ${lowerY}`)
        continue
      }
      upperVertices.push(`${px} ${geometry.y(upper[index - 1].value)}`, `${px} ${upperY}`)
      lowerVertices.push(`${px} ${geometry.y(lower[index - 1].value)}`, `${px} ${lowerY}`)
    }
    return `M ${upperVertices.concat(lowerVertices.reverse()).join(' L ')} Z`
  }

  return (
    <div className="compare-trend" data-testid={testId}>
      <h3 className="compare-trend-title">{t('compare.rateScenariosTitle')}</h3>
      {/* One color per mix already sits in the gallery's shared legend above;
          this key explains the two marks this panel adds. */}
      <div className="compare-trend-inline-legend compare-rate-key">
        <span>
          <svg className="chart-swatch-line" width="18" height="12" aria-hidden="true">
            <line
              x1="0"
              y1="6"
              x2="18"
              y2="6"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
          {t('calculator.forecast.scenarios.base')}
        </span>
        {hasSteps && (
          <span>
            <i className="compare-rate-band-swatch" aria-hidden="true" />
            {t('compare.rateScenarioRange', { step })}
          </span>
        )}
      </div>

      {/* Reset dates belong beside each mix's name, not hidden in the tooltip:
          they explain which mixes carry the shaded scenario range. */}
      <ul className="compare-rate-mix-list" aria-label={t('compare.rateResetListAria')}>
        {groups.map((group) => {
          const resetText =
            group.resetYears.length > 0
              ? t('compare.rateMixResetYears', { years: formatResetYears(group.resetYears) })
              : t('compare.rateMixNoReset')
          return (
            <li key={`resets-${group.key}`} aria-label={`${group.label}, ${resetText}`}>
              <i
                className="compare-trend-swatch"
                style={{ background: group.color }}
                aria-hidden="true"
              />
              <span className="compare-rate-mix-label">{group.label}</span>
              <span className="compare-rate-mix-resets">{resetText}</span>
            </li>
          )
        })}
      </ul>

      <div className="compare-trend-plot" ref={attachPlot} data-testid={`${testId}-plot`}>
        {geometry && layout && (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            direction="ltr"
            role="img"
            aria-label={t('compare.rateScenariosAria')}
            onMouseMove={handleMove}
            onMouseLeave={() => setActive(null)}
            onClick={handleMove}
          >
            {geometry.ticks.map((tick) => (
              <line
                key={`grid-${tick}`}
                x1={MARGIN_LEFT}
                x2={width - MARGIN_RIGHT}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                className="compare-trend-gridline"
              />
            ))}

            {resetYears.map((year) => (
              <line
                key={`reset-${year}`}
                x1={layout.x(year)}
                x2={layout.x(year)}
                y1={TOP}
                y2={TOP + layout.innerH}
                className="forecast-reset-line"
                aria-hidden="true"
              />
            ))}

            {/* Bands first, then the no-change lines: a later mix's fill must
                never dim an earlier mix's line. */}
            {bands.map((band) => (
              <path
                key={`band-${band.key}`}
                d={bandFor(band.up.points, band.down.points)}
                className="compare-rate-band"
                style={{ fill: band.color }}
              />
            ))}
            {basePaths.map((base) => (
              <path
                key={`line-${base.key}`}
                d={pathFor(base.path)}
                className="compare-trend-line compare-rate-base"
                style={{ stroke: base.color }}
              />
            ))}

            {active !== null && (
              <>
                <line
                  x1={layout.x(active + 1)}
                  x2={layout.x(active + 1)}
                  y1={TOP}
                  y2={TOP + layout.innerH}
                  className="compare-trend-guide"
                />
                {basePaths.map((base) => {
                  const point = base.path.points.find((entry) => entry.year === active + 1)
                  if (!point) return null
                  return (
                    <circle
                      key={`dot-${base.key}`}
                      cx={layout.x(point.year)}
                      cy={geometry.y(point.value)}
                      r={5}
                      className="compare-trend-dot"
                      style={{ stroke: base.color }}
                    />
                  )
                })}
              </>
            )}

            {geometry.ticks.map((tick) => (
              <text
                key={`tick-${tick}`}
                x={MARGIN_LEFT - 8}
                y={geometry.y(tick) + 4}
                className="compare-trend-tick compare-trend-tick-end"
              >
                {formatAxisShekelDetailed(tick)}
              </text>
            ))}
            {yearTicks.map((tick) => {
              // Thin the year labels when the panel is narrow, same rule as
              // the trend gallery: at least ~26px between labels.
              if (tick.label === null) return null
              const every = Math.max(1, Math.ceil(26 / Math.max(layout.slot, 1)))
              if (tick.index % every !== 0) return null
              return (
                <text
                  key={`year-${tick.index}`}
                  x={layout.x(tick.index + 1)}
                  y={HEIGHT - 20}
                  className="compare-trend-tick"
                >
                  {tick.label}
                </text>
              )
            })}
            <text
              x={12}
              y={TOP + layout.innerH / 2}
              className="compare-trend-axis-title"
              transform={`rotate(-90 12 ${TOP + layout.innerH / 2})`}
            >
              {t('calculator.charts.axisMonthlyPayment')}
            </text>
          </svg>
        )}

        {activeYear !== null && layout && geometry && (
          <div
            ref={tooltipRef}
            className="compare-trend-tooltip"
            role="status"
            style={{ left: `${((layout.x(activeYear) / width) * 100).toFixed(1)}%` }}
          >
            <strong>{t('calculator.charts.yearLabel', { year: activeYear })}</strong>
            {paths.map((path) => {
              const point = path.points.find((entry) => entry.year === activeYear)
              if (!point) return null
              return (
                <span key={`tip-${path.mixKey}-${path.id}`} className="compare-trend-tooltip-row">
                  <i
                    className="compare-trend-swatch"
                    style={{ background: path.color }}
                    aria-hidden="true"
                  />
                  {t('compare.rateSeriesLabel', {
                    mix: path.mix,
                    scenario: path.label,
                  })}
                  : {formatCurrency(point.value)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {rateNote && (
        <p className="compare-trend-note" data-testid={`${testId}-note`}>
          {rateNote}
        </p>
      )}

      {/* Text equivalent of the chart, invisible on screen: the card is
          graph-only visually, not for screen readers. */}
      <h4 className="sr-only">{t('compare.rateScenariosTitle')}</h4>
      <div className="sr-only">
        {groups.map((group) => {
          const base = group.paths.find((path) => path.dash === undefined) ?? group.paths[0]
          if (!base) return null
          return (
            <table
              key={`table-${group.key}`}
              data-testid={`compare-rate-table-${group.key}`}
              aria-label={t('compare.rateTableAria', { mix: group.label })}
            >
              <caption>{group.label}</caption>
              <thead>
                <tr>
                  <th>{t('calculator.forecast.tableYear')}</th>
                  {group.paths.map((path) => (
                    <th key={path.id}>{path.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {base.points.map((point) => (
                  <tr
                    key={point.year}
                    className={resetYears.includes(point.year) ? 'is-reset' : undefined}
                  >
                    <th scope="row">{point.year}</th>
                    {group.paths.map((path) => (
                      <td key={path.id}>
                        {formatCurrency(
                          path.points.find((entry) => entry.year === point.year)?.value ?? 0,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </div>
    </div>
  )
}
