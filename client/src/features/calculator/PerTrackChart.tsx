import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { formatAxisShekel, niceTicks, xAxisTicks } from '@/lib/charts'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import { TRACK_TYPE_COLORS } from './trackColors'
import type { TrackSchedule } from '@/stores/calculatorStore'

const WIDTH = 900
const HEIGHT = 560
const MARGIN = { top: 44, right: 88, bottom: 92, left: 88 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

/** Hover state: the snapped period index plus which track's line is nearest. */
interface HoverState {
  /** Row index the cursor is over (0-based; the label shows index + 1). */
  index: number
  /** Line vertically nearest the cursor - emphasized and first in the tooltip. */
  nearestTrack: number
}

/** One plotted point: a period number and the balance left after it. */
interface BalancePoint {
  /** Year in the yearly view, running month count in the monthly one. */
  period: number
  balance: number
}

/**
 * The balance series the chart draws for one track. The tables under the chart
 * already switch granularity, so the chart does too: the monthly view plots
 * every month (the running month count on the x axis) instead of one point per
 * year. Both come from the same computed rows the table renders, so the two
 * views can never disagree.
 */
function balanceSeries(track: TrackSchedule, monthly: boolean): BalancePoint[] {
  return monthly
    ? track.monthlyRows.map((row) => ({
        period: (row.year - 1) * 12 + row.month,
        balance: row.closing,
      }))
    : track.rows.map((row) => ({ period: row.year, balance: row.balance }))
}

/**
 * Per-track comparison: one balance line per track so the different paydown
 * speeds are visible side by side. Lines keep their TYPE color (same palette
 * as the mix donut) and the x axis runs chronologically left to right.
 * Hovering snaps to the nearest period and shows a tooltip with every track's
 * balance there (nearest track first); dots mark the hovered period on each
 * line and the nearest line gets emphasized, disambiguating overlaps.
 */
export function PerTrackChart({
  tracks,
  monthly = false,
}: {
  tracks: TrackSchedule[]
  /** Plots one point per month instead of per year, like the schedule tab. */
  monthly?: boolean
}) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<HoverState | null>(null)
  // Tooltip element + plot container, for the edge-clamp hook.
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  // Re-clamp whenever the tooltip re-anchors or the hovered track changes
  // (the hovered track reorders rows, which can change the tooltip width).
  useTooltipClamp(tooltipRef, plotRef, hover ? `${hover.index}:${hover.nearestTrack}` : null)

  const geometry = useMemo(() => {
    const nonEmpty = tracks
      .map((track) => ({ track, series: balanceSeries(track, monthly) }))
      .filter((entry) => entry.series.length > 0)
    if (nonEmpty.length === 0) return null
    const rowCount = Math.max(...nonEmpty.map((entry) => entry.series.length))
    const maxBalance = Math.max(...nonEmpty.map((entry) => entry.series[0]?.balance ?? 0))
    if (maxBalance <= 0) return null
    const step = INNER_W / Math.max(1, rowCount - 1)
    const x = (index: number) => MARGIN.left + index * step
    const y = (value: number) => MARGIN.top + INNER_H * (1 - value / maxBalance)
    return { nonEmpty, rowCount, maxBalance, step, x, y }
  }, [tracks, monthly])

  if (!geometry) return null
  const { nonEmpty, rowCount, maxBalance, step, x, y } = geometry
  const ticks = niceTicks(maxBalance)
  const xTicks = xAxisTicks(rowCount, monthly)

  /** Points of the hovered period, one per track (tracks ending early skip). */
  const activePoints =
    hover !== null
      ? nonEmpty
          .map((entry, trackIndex) => ({
            track: entry.track,
            trackIndex,
            point: entry.series[hover.index],
          }))
          .filter((entry) => entry.point !== undefined)
      : []

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    // Map cursor to SVG user units (the SVG stretches to the container
    // width). Out-of-range x clamps into the plot; the y only matters for
    // picking the nearest line.
    const svgX = ((event.clientX - bounds.left) / bounds.width) * WIDTH
    const svgY = ((event.clientY - bounds.top) / bounds.height) * HEIGHT
    const index = Math.round((svgX - MARGIN.left) / Math.max(step, 1e-9))
    const clamped = Math.max(0, Math.min(rowCount - 1, index))
    // Nearest line at that year: smallest |cursor y - line y|. Tracks that
    // ended (no row) can't be nearest.
    let nearestTrack = 0
    let best = Number.POSITIVE_INFINITY
    nonEmpty.forEach((entry, trackIndex) => {
      const point = entry.series[clamped]
      if (!point) return
      const distance = Math.abs(svgY - y(Math.max(0, point.balance)))
      if (distance < best) {
        best = distance
        nearestTrack = trackIndex
      }
    })
    setHover({ index: clamped, nearestTrack })
  }

  // Reorder for the tooltip: nearest track first, the rest in track order.
  const orderedPoints =
    hover !== null
      ? [...activePoints].sort((a, b) => {
          const aActive = a.trackIndex === hover.nearestTrack ? 0 : 1
          const bActive = b.trackIndex === hover.nearestTrack ? 0 : 1
          return aActive - bActive
        })
      : []

  return (
    <div className="per-track-chart" data-testid="per-track-chart">
      {/* Legend row sits above the plot, wrapping track names left-to-right. */}
      <div className="chart-legend" aria-hidden="true">
        {nonEmpty.map((entry, index) => (
          <span key={`${index}-${entry.track.type}`} className="chart-legend-item">
            <i
              className="chart-swatch"
              style={{ background: TRACK_TYPE_COLORS[entry.track.type] }}
            />
            <span className="chart-legend-name">
              {t(`calculator.trackTypes.${entry.track.type}`)}
            </span>
          </span>
        ))}
      </div>
      <div className="per-track-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          direction="ltr"
          role="img"
          aria-label={t('calculator.charts.perTrackAria')}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleMove}
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
                {formatAxisShekel(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <g key={`x-${tick.index}`}>
              <line
                x1={x(tick.index)}
                x2={x(tick.index)}
                y1={MARGIN.top + INNER_H}
                y2={MARGIN.top + INNER_H + (tick.label === null ? 4 : 7)}
                className={tick.label === null ? 'chart-minor-tick' : 'chart-major-tick'}
              />
              {tick.label !== null && (
                <text x={x(tick.index)} y={HEIGHT - 36} className="chart-tick">
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {nonEmpty.map((entry, trackIndex) => (
            <path
              key={`${trackIndex}-${entry.track.type}`}
              d={entry.series
                .map(
                  (point, index) =>
                    `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(Math.max(0, point.balance))}`,
                )
                .join(' ')}
              stroke={TRACK_TYPE_COLORS[entry.track.type]}
              className={`chart-line-track${hover?.nearestTrack === trackIndex ? ' is-active' : ''}`}
            />
          ))}

          {/* Hover markers on every surviving line at the hovered period. */}
          {activePoints.map(({ track, trackIndex, point }) => (
            <circle
              key={`dot-${trackIndex}-${track.type}`}
              cx={x(hover!.index)}
              cy={y(Math.max(0, point.balance))}
              r={4.5}
              fill={TRACK_TYPE_COLORS[track.type]}
              className="chart-dot-track"
            />
          ))}

          {/* Axis titles: balance rotated vertically at the left edge, period
              title at the bottom ("year" in both modes, since that is what the
              labeled ticks are - the monthly view labels year boundaries and
              names the exact month in its tooltip). The SVG is LTR, so
              positions are logical. */}
          <text
            x={10}
            y={MARGIN.top + INNER_H / 2}
            className="chart-axis-title chart-axis-title-rot"
            transform={`rotate(-90 10 ${MARGIN.top + INNER_H / 2})`}
          >
            {t('calculator.charts.axisBalance')}
          </text>
          {/* Small-screen stand-in for the rotated title: a short horizontal
              caption above the axis numbers, shown on screens ≤800px (CSS). */}
          <text x={44} y={12} className="chart-axis-title chart-axis-title-above">
            {t('calculator.charts.axisBalance')}
          </text>
          <text x={MARGIN.left + INNER_W / 2} y={HEIGHT - 8} className="chart-axis-title">
            {t('calculator.charts.axisYear')}
          </text>
        </svg>

        {/* Hover tooltip: the hovered period plus every track's balance there,
            nearest track first - mirrors the amortization chart's tooltip. */}
        {hover !== null && orderedPoints.length > 0 && (
          <div
            ref={tooltipRef}
            className="chart-tooltip"
            role="status"
            style={{
              // Physical `left`, not insetInlineStart: the SVG is LTR while
              // the page may be RTL, so the logical property would mirror it.
              // The clamp hook adjusts the transform near the plot edges so
              // the whole tooltip stays on screen.
              left: `${(x(hover.index) / WIDTH) * 100}%`,
            }}
          >
            <strong>
              {monthly
                ? t('calculator.charts.monthLabel', { month: hover.index + 1 })
                : t('calculator.charts.yearLabel', { year: hover.index + 1 })}
            </strong>
            {orderedPoints.map(({ track, point }) => (
              <span key={`tt-${track.type}`} className="chart-tooltip-row">
                <i
                  className="chart-tooltip-swatch"
                  style={{ background: TRACK_TYPE_COLORS[track.type] }}
                />
                {t(`calculator.trackTypes.${track.type}`)}: {formatCurrency(point.balance)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
