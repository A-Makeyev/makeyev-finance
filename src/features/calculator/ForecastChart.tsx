import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { formatAxisShekel, niceRange, niceTicks, svgRound, xAxisTicks } from '@/lib/charts'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import { useTooltipPresence } from '@/hooks/useTooltipPresence'

/** One plotted point: a 1-based loan year and its value. */
export interface ForecastSeriesPoint {
  year: number
  value: number
}

/** One line in a forecast chart. */
export interface ForecastSeries {
  id: string
  label: string
  color: string
  points: ForecastSeriesPoint[]
  /**
   * Draw as a step (horizontal until the next year, then vertical). Payment
   * paths use this so a rate reset reads as a jump, not a slope.
   */
  step?: boolean
  /**
   * Dash the line. The comparison page draws one group of paths per mix in the
   * mix's own color, so the scenario is told apart by the stroke, not by a
   * color that would have to be invented per mix and path.
   */
  dash?: 'dashed' | 'dotted'
}

interface ForecastChartProps {
  series: ForecastSeries[]
  ariaLabel: string
  /** Rotated y-axis caption (e.g. monthly payment / cumulative amount). */
  axisTitle: string
  /**
   * X of that rotated caption in viewBox units. The default keeps it out by the
   * chart's edge; a narrower chart can pull it in toward the tick labels.
   */
  axisTitleX?: number
  /** Years to mark with a vertical dashed line (rate-reset years). */
  markers?: number[]
  /**
   * A year the reader has picked elsewhere (the prepayment date slider): drawn
   * as a solid accent guide with a dot per series, so the chosen year is
   * visible without hovering.
   */
  selectedYear?: number
  /**
   * Called with the year under the cursor when the plot is clicked. Charts
   * whose x axis is a choice (the prepayment date) turn a click into that
   * choice; without it a click only serves the hover tooltip.
   */
  onSelectYear?: (year: number) => void
  /**
   * Anchor the value axis at 0 (cost paths) or zoom to the data range
   * (payment paths). A payment path on a zero axis compresses a 1pp reset
   * into a few pixels, which hides the very step the chart exists to show;
   * the zoomed axis keeps the real shekel labels, so the range stays explicit.
   */
  zeroBased?: boolean
  /**
   * Axis-label formatter. A zoomed payment axis needs a decimal ("₪7.8K");
   * the default whole-K formatter rounds every label to the same "₪8K".
   */
  formatTick?: (value: number) => string
  testId: string
}

// Same 900x520 family as the other schedule charts, so the panel's charts line
// up. The plot keeps a zero baseline: payment and cost paths both start at 0.
const WIDTH = 900
const HEIGHT = 520
// The left margin holds the shekel ticks plus the rotated side title; the
// forecast panel asks for larger ticks, so it needs more room than the
// schedule charts.
const MARGIN = { top: 40, right: 88, bottom: 84, left: 120 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

/** Stroke patterns for the optional per-series dash (undefined = solid). */
const DASH_ARRAYS = { solid: undefined, dashed: '9 6', dotted: '2 6' } as const

/**
 * Multi-line forecast plot. Lines are drawn in reverse legend order, so the
 * first (reference) series sits on top of the scenario lines. Hover snaps to
 * a year and shows every series there; the chart is `role="img"` and the
 * panel always renders the same figures as an expandable table.
 */
export function ForecastChart({
  series,
  ariaLabel,
  axisTitle,
  axisTitleX = 10,
  markers = [],
  selectedYear,
  onSelectYear,
  zeroBased = true,
  formatTick = formatAxisShekel,
  testId,
}: ForecastChartProps) {
  const { t } = useTranslation()
  const [activeYear, setActiveYear] = useState<number | null>(null)
  // Whether the pointer is on the plot right now. `activeYear` deliberately
  // outlives it, so the callout still has a year to show while it fades out.
  const [hovering, setHovering] = useState(false)
  const showTooltip = useTooltipPresence(hovering && activeYear !== null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  useTooltipClamp(tooltipRef, plotRef, activeYear)

  const geometry = useMemo(() => {
    const nonEmpty = series.filter((entry) => entry.points.length > 0)
    if (nonEmpty.length === 0) return null
    const maxYear = Math.max(...nonEmpty.flatMap((entry) => entry.points.map((point) => point.year)))
    const values = nonEmpty.flatMap((entry) => entry.points.map((point) => Math.max(0, point.value)))
    const maxValue = Math.max(...values)
    if (!Number.isFinite(maxValue)) return null

    let axisMin = 0
    // An all-zero chart (every fee is zero at the current rates) still draws a
    // flat baseline. Returning null here used to remove the chart entirely,
    // which reads as a bug: the zero line is the answer, not a missing plot.
    let axisMax = maxValue > 0 ? maxValue : 1
    let ticks = niceTicks(axisMax)
    if (!zeroBased) {
      const minValue = Math.min(...values)
      const padding = Math.max((maxValue - minValue) * 0.08, maxValue * 0.01, 1)
      const range = niceRange(Math.max(0, minValue - padding), maxValue + padding)
      axisMin = range.axisMin
      axisMax = range.axisMax
      ticks = range.ticks
    }

    const step = maxYear > 1 ? INNER_W / (maxYear - 1) : INNER_W
    const x = (year: number) =>
      svgRound(maxYear > 1 ? MARGIN.left + (year - 1) * step : MARGIN.left + INNER_W / 2)
    const y = (value: number) =>
      svgRound(
        MARGIN.top +
          INNER_H * (1 - (Math.max(axisMin, Math.min(axisMax, value)) - axisMin) / (axisMax - axisMin)),
      )
    return { nonEmpty, maxYear, axisMin, axisMax, step, ticks, x, y }
  }, [series, zeroBased])

  if (!geometry) return null
  const { nonEmpty, maxYear, step, ticks, x, y } = geometry
  const xTicks = xAxisTicks(maxYear, false)
  const markerYears = Array.from(new Set(markers)).filter(
    (year) => year >= 1 && year <= maxYear,
  )
  // The year picked outside the chart, when it falls inside the plot. Series
  // that do not reach it simply get no dot.
  const pickedYear =
    selectedYear !== undefined && selectedYear >= 1 && selectedYear <= maxYear
      ? Math.round(selectedYear)
      : null
  const pickedPoints =
    pickedYear === null
      ? []
      : nonEmpty.flatMap((entry) => {
          const point = entry.points.find((candidate) => candidate.year === pickedYear)
          return point ? [{ entry, point }] : []
        })

  const pathFor = (entry: ForecastSeries): string =>
    entry.points
      .map((point, index) => {
        const px = x(point.year)
        const py = y(point.value)
        if (index === 0) return `M ${px} ${py}`
        if (entry.step) {
          return `L ${px} ${y(entry.points[index - 1].value)} L ${px} ${py}`
        }
        return `L ${px} ${py}`
      })
      .join(' ')

  /** The loan year under the pointer, clamped into the plot. */
  const yearAt = (event: React.MouseEvent<SVGSVGElement>): number => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH
    const year = Math.round((svgX - MARGIN.left) / Math.max(step, 1e-9)) + 1
    return Math.max(1, Math.min(maxYear, year))
  }

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    setActiveYear(yearAt(event))
    setHovering(true)
  }

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const year = yearAt(event)
    setActiveYear(year)
    setHovering(true)
    onSelectYear?.(year)
  }

  const activeRows =
    activeYear !== null
      ? nonEmpty
          .map((entry) => ({
            entry,
            point: entry.points.find((point) => point.year === activeYear),
          }))
          .filter((row): row is { entry: ForecastSeries; point: ForecastSeriesPoint } =>
            row.point !== undefined,
          )
      : []

  // The tooltip hangs just above the highest series at the hovered year, so it
  // points at the graph instead of trailing the pointer.
  const activeYs = activeRows.map(({ point }) => y(point.value))
  const anchorY = activeYs.length > 0 ? Math.min(...activeYs) : MARGIN.top

  return (
    <div className="forecast-chart" data-testid={testId}>
      <div className="chart-legend" aria-hidden="true">
        {nonEmpty.map((entry) => (
          <span key={entry.id} className="chart-legend-item">
            {entry.dash ? (
              // A dashed path gets a swatch in the same stroke, so the legend
              // matches the line instead of implying a color per entry.
              <svg className="chart-swatch chart-swatch-line" width="18" height="12">
                <line
                  x1="0"
                  y1="6"
                  x2="18"
                  y2="6"
                  stroke={entry.color}
                  strokeWidth="2.5"
                  strokeDasharray={DASH_ARRAYS[entry.dash]}
                />
              </svg>
            ) : (
              <i className="chart-swatch" style={{ background: entry.color }} />
            )}
            <span className="chart-legend-name">{entry.label}</span>
          </span>
        ))}
      </div>
      <div className="forecast-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          direction="ltr"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={handleMove}
          onMouseLeave={() => setHovering(false)}
          onClick={handleClick}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="chart-grid"
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.32em"
                className="chart-tick chart-tick-end"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {markerYears.map((year) => (
            <line
              key={`marker-${year}`}
              x1={x(year)}
              x2={x(year)}
              y1={MARGIN.top}
              y2={MARGIN.top + INNER_H}
              className="forecast-reset-line"
              aria-hidden="true"
            />
          ))}

          {pickedYear !== null && (
            <line
              x1={x(pickedYear)}
              x2={x(pickedYear)}
              y1={MARGIN.top}
              y2={MARGIN.top + INNER_H}
              className="forecast-selected-line"
              aria-hidden="true"
            />
          )}

          {xTicks.map((tick) => (
            <g key={`x-${tick.index}`}>
              <line
                x1={x(tick.index + 1)}
                x2={x(tick.index + 1)}
                y1={MARGIN.top + INNER_H}
                y2={MARGIN.top + INNER_H + (tick.label === null ? 4 : 7)}
                className={tick.label === null ? 'chart-minor-tick' : 'chart-major-tick'}
              />
              {tick.label !== null && (
                <text x={x(tick.index + 1)} y={HEIGHT - 34} className="chart-tick">
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {/* Reverse legend order keeps the reference series drawn last (on top). */}
          {[...nonEmpty].reverse().map((entry) => (
            <path
              key={entry.id}
              d={pathFor(entry)}
              stroke={entry.color}
              strokeDasharray={DASH_ARRAYS[entry.dash ?? 'solid']}
              className="chart-line-track"
            />
          ))}

          {pickedPoints.map(({ entry, point }) => (
            <circle
              key={`picked-${entry.id}`}
              cx={x(point.year)}
              cy={y(point.value)}
              r={4.5}
              fill={entry.color}
              className="forecast-selected-dot"
            />
          ))}

          {hovering &&
            activeYear !== null &&
            activeRows.map(({ entry, point }) => (
              <circle
                key={`dot-${entry.id}`}
                cx={x(activeYear)}
                cy={y(point.value)}
                r={5}
                fill={entry.color}
                className="forecast-hover-dot"
              />
            ))}

          <text
            x={axisTitleX}
            y={MARGIN.top + INNER_H / 2}
            className="chart-axis-title chart-axis-title-rot"
            transform={`rotate(-90 ${axisTitleX} ${MARGIN.top + INNER_H / 2})`}
          >
            {axisTitle}
          </text>
          <text x={44} y={12} className="chart-axis-title chart-axis-title-above">
            {axisTitle}
          </text>
          <text x={MARGIN.left + INNER_W / 2} y={HEIGHT - 6} className="chart-axis-title">
            {t('calculator.charts.axisYear')}
          </text>
        </svg>

        {showTooltip && activeYear !== null && activeRows.length > 0 && (
          <div
            ref={tooltipRef}
            className="chart-tooltip forecast-tooltip"
            data-open={hovering}
            role="status"
            style={{
              left: `${(x(activeYear) / WIDTH) * 100}%`,
              // `translate` composes with the clamp hook's `transform`.
              top: `${(anchorY / HEIGHT) * 100}%`,
              // Bottom edge just clear of the line, with a small gap.
              translate: '0 calc(-100% - 10px)',
            }}
          >
            <strong>{t('calculator.forecast.yearLabel', { year: activeYear })}</strong>
            {activeRows.map(({ entry, point }) => (
              <span key={`tt-${entry.id}`} className="chart-tooltip-row">
                <i className="chart-tooltip-swatch" style={{ background: entry.color }} />
                {entry.label}: {formatCurrency(point.value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
