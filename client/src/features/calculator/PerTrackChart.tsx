import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAxisShekel, niceTicks, xAxisTicks } from '@/lib/charts'
import { TRACK_TYPE_COLORS } from './trackColors'
import type { TrackSchedule } from '@/stores/calculatorStore'

const WIDTH = 900
const HEIGHT = 560
const MARGIN = { top: 44, right: 88, bottom: 92, left: 88 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

/**
 * Per-track comparison: one balance line per track so the different paydown
 * speeds are visible side by side. Lines keep their TYPE color (same palette
 * as the mix donut) and the x axis runs chronologically left to right.
 */
export function PerTrackChart({ tracks }: { tracks: TrackSchedule[] }) {
  const { t } = useTranslation()

  const geometry = useMemo(() => {
    const nonEmpty = tracks.filter((track) => track.rows.length > 0)
    if (nonEmpty.length === 0) return null
    const rowCount = Math.max(...nonEmpty.map((track) => track.rows.length))
    const maxBalance = Math.max(...nonEmpty.map((track) => track.rows[0]?.balance ?? 0))
    if (maxBalance <= 0) return null
    const step = INNER_W / Math.max(1, rowCount - 1)
    const x = (index: number) => MARGIN.left + index * step
    const y = (value: number) => MARGIN.top + INNER_H * (1 - value / maxBalance)
    return { nonEmpty, rowCount, maxBalance, x, y }
  }, [tracks])

  if (!geometry) return null
  const { nonEmpty, rowCount, maxBalance, x, y } = geometry
  const ticks = niceTicks(maxBalance)
  const xTicks = xAxisTicks(rowCount, false)

  return (
    <div className="per-track-chart" data-testid="per-track-chart">
      {/* Legend row sits above the plot, wrapping track names left-to-right. */}
      <div className="chart-legend" aria-hidden="true">
        {nonEmpty.map((track, index) => (
          <span key={`${index}-${track.type}`} className="chart-legend-item">
            <i className="chart-swatch" style={{ background: TRACK_TYPE_COLORS[track.type] }} />
            <span className="chart-legend-name">{t(`calculator.trackTypes.${track.type}`)}</span>
          </span>
        ))}
      </div>
      <div className="per-track-plot">

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        direction="ltr"
        role="img"
        aria-label={t('calculator.charts.perTrackAria')}
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
            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" className="chart-tick chart-tick-end">
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

        {nonEmpty.map((track, trackIndex) => (
          <path
            key={`${trackIndex}-${track.type}`}
            d={track.rows
              .map(
                (row, index) =>
                  `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(Math.max(0, row.balance))}`,
              )
              .join(' ')}
            stroke={TRACK_TYPE_COLORS[track.type]}
            className="chart-line-track"
          />
        ))}

        {/* Axis titles: balance rotated vertically at the left edge, year
            title at the bottom. The SVG is LTR so positions are logical. */}
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
      </div>
    </div>
  )
}
