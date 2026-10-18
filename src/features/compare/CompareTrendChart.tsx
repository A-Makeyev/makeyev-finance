'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { formatAxisShekel, niceTicks, svgRound, xAxisTicks } from '@/lib/charts'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import { trendValues, type TrendMetric, type TrendSourceRow } from './trend'

/**
 * The comparison's trend charts: one small chart per metric, each plotting every
 * mix so the differences read at a glance (no toggling between them).
 *
 * The composition chart comes first, across the full width of the gallery, and
 * mirrors the calculator's combined chart: stacked קרן/ריבית columns per mix per
 * year. The other four metrics fall two per row beneath it, each with its own
 * visual language so they do not read as copies: remaining debt is a filled
 * area, cumulative paid a line with a dot per year, cumulative interest a
 * dashed line, cumulative indexation a dotted line. On the cumulative-
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
const LINE_METRICS: TrendMetric[] = ['balance', 'total', 'interest', 'indexation']

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

/** One mix's per-year amount split into its two stack segments (monthly ₪). */
interface BarSeries {
  label: string
  token: string
  tokenSoft: string
  segments: { year: number; principal: number; interest: number }[]
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

  const geometry = useMemo(() => {
    if (!layout) return null
    const maxValue = Math.max(
      1,
      ...lines.flatMap((line) => line.points.map((point) => point.value)),
    )
    const ticks = niceTicks(maxValue)
    const scaleMax = Math.max(maxValue, ticks[ticks.length - 1] ?? maxValue)
    const y = (value: number) => svgRound(TOP + layout.innerH * (1 - value / scaleMax))
    return { ticks, y }
  }, [layout, lines])

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
              {t('calculator.schedule.principalHeader')}
            </span>
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
                  const baseline = TOP + layout.innerH
                  // Each year is one group of side-by-side stacked bars (one per
                  // mix): קרן at the base, ריבית stacked on top, both in the
                  // mix's own color (interest a lighter shade).
                  const groupW = Math.min(layout.slot * 0.9, bars.length * 22)
                  const barW = groupW / bars.length
                  const groupLeft = layout.x(year) - groupW / 2
                  const gap = Math.max(0.6, barW * 0.14)
                  return bars.map((bar, barIndex) => {
                    const segment = bar.segments[yearIndex]
                    if (!segment) return null
                    const principalTop = geometry.y(segment.principal)
                    const interestTop = geometry.y(segment.principal + segment.interest)
                    return (
                      <g key={`bar-${year}-${barIndex}`}>
                        <rect
                          x={svgRound(groupLeft + barIndex * barW + gap / 2)}
                          y={principalTop}
                          width={svgRound(Math.max(0.8, barW - gap))}
                          height={svgRound(Math.max(0, baseline - principalTop))}
                          className="compare-trend-bar"
                          style={{ fill: bar.token }}
                        />
                        <rect
                          x={svgRound(groupLeft + barIndex * barW + gap / 2)}
                          y={interestTop}
                          width={svgRound(Math.max(0.8, barW - gap))}
                          height={svgRound(Math.max(0, principalTop - interestTop))}
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

                    {/* Cumulative paid carries a dot per year, so it reads as a
                        different chart from the two smooth line metrics. */}
                    {metric === 'total' &&
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
            className="compare-trend-tooltip"
            role="status"
            style={{ left: `${((layout.x(activeYear) / width) * 100).toFixed(1)}%` }}
          >
            <strong>{t('calculator.charts.yearLabel', { year: activeYear })}</strong>
            {bars
              ? // Composition: quote the two stacked segments, not just the total.
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
                      {bar.label}: {t('calculator.schedule.principalHeader')}{' '}
                      {formatCurrency(segment.principal)} ·{' '}
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

      {/* Text equivalent of the chart (charts are never chart-only). */}
      <h4 className="sr-only">{title}</h4>
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
    </div>
  )
}

export function CompareTrendChart({
  series,
  testIdPrefix = 'compare-trend',
}: {
  series: TrendSeries[]
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
  const lineMetrics = hasIndexation
    ? LINE_METRICS
    : LINE_METRICS.filter((metric) => metric !== 'indexation')

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
  // one stacked column per mix, split into קרן (base) and ריבית (top), both as
  // the year's average monthly amount (the yearly total over 12) so the axis
  // stays "monthly payment".
  const barSeries: BarSeries[] = series.map((entry, index) => ({
    label: entry.label,
    token: SERIES_TOKENS[index % SERIES_TOKENS.length],
    tokenSoft: SERIES_SOFT_TOKENS[index % SERIES_SOFT_TOKENS.length],
    segments: entry.schedule.map((row) => ({
      year: row.year,
      principal: row.principal / 12,
      interest: row.interest / 12,
    })),
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
    </div>
  )
}
