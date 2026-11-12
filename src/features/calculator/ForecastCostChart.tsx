import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import {
  alignedDualTicks,
  formatAxisShekelDetailed,
  niceTicks,
  svgRound,
  xAxisTicks,
} from '@/lib/charts'
import type { ForecastAnnualCost } from '@/lib/forecast'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import { useTooltipPointer } from '@/hooks/useTooltipPointer'
import { useTooltipPresence } from '@/hooks/useTooltipPresence'

interface ForecastCostChartProps {
  /** One row per loan year, from `annualCostsFor`. */
  rows: ForecastAnnualCost[]
  /** Hides the indexation bar/legend row for a non-indexed mix. */
  hasIndexation: boolean
  ariaLabel: string
  testId: string
}

// Same 900×520 plot family as the reset chart beside it: the two forecast
// cards share one row, so equal viewBoxes keep chart tops and table tops on
// the same line. Bars need both side margins: the yearly cost scale on the
// left, the running-total scale on the right, each with its rotated title.
const WIDTH = 900
const HEIGHT = 520
const MARGIN = { top: 44, right: 124, bottom: 92, left: 120 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom

/**
 * Cumulative cost chart, in the schedule's visual language: one stacked bar
 * per year (interest + indexation accrued in that year) with the combined
 * running total drawn as a dashed line on a second axis.
 *
 * Two scales are deliberate. A single year's cost is small next to a total
 * that has been accumulating for a decade, so a shared axis would flatten the
 * bars into an invisible strip. The dual gridlines share their rows
 * (`alignedDualTicks`), the same technique as the amortization chart, so the
 * solid annual grid and the dashed running-total grid never cross.
 *
 * The chart is fed by the exact cumulative points the table renders; yearly
 * amounts are the difference between adjacent points, so the two views can
 * never disagree.
 */
export function ForecastCostChart({
  rows,
  hasIndexation,
  ariaLabel,
  testId,
}: ForecastCostChartProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  // Whether the pointer is on the plot right now. `active` deliberately
  // outlives it, so the callout still has a year to show while it fades out.
  const [hovering, setHovering] = useState(false)
  const showTooltip = useTooltipPresence(hovering && active !== null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  // The callout sits just above the cursor, not at a fixed height.
  const { pointerY, trackPointer } = useTooltipPointer()
  useTooltipClamp(
    tooltipRef,
    plotRef,
    active !== null ? `${active}:${Math.round(pointerY)}` : null,
  )

  const geometry = useMemo(() => {
    if (rows.length === 0) return null
    const maxAnnualData = Math.max(
      ...rows.map((row) => row.interest + (hasIndexation ? row.indexation : 0)),
    )
    const maxCumulativeData = Math.max(...rows.map((row) => row.cumulativeTotal))
    if (!Number.isFinite(maxAnnualData) || !Number.isFinite(maxCumulativeData)) return null
    // A 0% loan (or a 0% indexed one whose CPI is also 0) has nothing to
    // scale, but the chart still renders: a flat zero line is the answer, not
    // a missing plot. A unit scale keeps the geometry finite and puts every
    // bar and point on the baseline.
    const hasCost = maxAnnualData > 0 && maxCumulativeData > 0

    // Bars occupy evenly spaced slots inset by `pad` on both plot edges, so
    // the first and last bar keep clear of the frame.
    const pad = Math.min(INNER_W * 0.04, 16)
    const plotW = INNER_W - pad * 2
    const slot = plotW / rows.length
    const x = (index: number) => svgRound(MARGIN.left + pad + slot * (index + 0.5))

    const aligned = hasCost ? alignedDualTicks(maxAnnualData, maxCumulativeData) : null
    const annualTicks = aligned
      ? aligned.paymentTicks
      : hasCost
        ? niceTicks(maxAnnualData)
        : [0]
    const cumulativeTicks = aligned
      ? aligned.balanceTicks
      : hasCost
        ? niceTicks(maxCumulativeData)
        : [0]
    const scaleMaxAnnual = aligned
      ? aligned.scaleMaxPayment
      : hasCost
        ? maxAnnualData
        : 1
    const scaleMaxCumulative = aligned
      ? aligned.scaleMaxBalance
      : hasCost
        ? maxCumulativeData
        : 1

    const yAnnual = (value: number) =>
      svgRound(MARGIN.top + INNER_H * (1 - value / scaleMaxAnnual))
    // The running-total axis starts at the annual zero line, so the dashed
    // grid never introduces a second baseline.
    const zeroY = yAnnual(0)
    const yCumulative = (value: number) =>
      svgRound(zeroY - (value / scaleMaxCumulative) * (zeroY - MARGIN.top))

    return {
      annualTicks,
      cumulativeTicks,
      slot,
      pad,
      x,
      yAnnual,
      yCumulative,
      zeroY,
    }
  }, [rows, hasIndexation])

  if (!geometry) return null
  const { annualTicks, cumulativeTicks, slot, pad, x, yAnnual, yCumulative, zeroY } = geometry
  const barWidth = svgRound(Math.min(30, slot * 0.66))
  const xTicks = xAxisTicks(rows.length, false)
  const activeRow = active !== null ? rows[active] : null
  const activeYearLabel = activeRow ? t('calculator.forecast.yearLabel', { year: activeRow.year }) : ''

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relative = ((event.clientX - bounds.left) / bounds.width) * WIDTH - MARGIN.left
    const index = Math.floor((relative - pad) / Math.max(slot, 1e-9))
    setActive(Math.max(0, Math.min(rows.length - 1, index)))
    trackPointer(event, event.currentTarget)
    setHovering(true)
  }

  const cumulativePath = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${yCumulative(row.cumulativeTotal)}`)
    .join(' ')

  return (
    <div className="forecast-chart forecast-cost-chart" data-testid={testId}>
      <div className="chart-legend" aria-hidden="true">
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-interest" />
          <span className="chart-legend-name">
            {t('calculator.forecast.series.annualInterest')}
          </span>
        </span>
        {hasIndexation && (
          <span className="chart-legend-item">
            <i className="chart-swatch chart-swatch-indexation" />
            <span className="chart-legend-name">
              {t('calculator.forecast.series.annualIndexation')}
            </span>
          </span>
        )}
        <span className="chart-legend-item">
          {/* The running total is a line, so its swatch carries the same dash
              instead of a solid block. */}
          <svg className="chart-swatch chart-swatch-line" width="18" height="12" aria-hidden="true">
            <line
              x1="0"
              y1="6"
              x2="18"
              y2="6"
              stroke="var(--chart-balance, #111111)"
              strokeWidth="2.5"
              strokeDasharray="7 5"
            />
          </svg>
          <span className="chart-legend-name">
            {t('calculator.forecast.series.cumulativeTotal')}
          </span>
        </span>
      </div>

      <div className="forecast-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          direction="ltr"
          role="img"
          aria-label={ariaLabel}
          onMouseMove={handleMove}
          onMouseLeave={() => setHovering(false)}
          onClick={handleMove}
        >
          {/* Left axis: this year's cost. */}
          {annualTicks.map((tick) => (
            <g key={`annual-${tick}`}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yAnnual(tick)}
                y2={yAnnual(tick)}
                className="chart-grid"
              />
              <text
                x={MARGIN.left - 10}
                y={yAnnual(tick)}
                dy="0.32em"
                className="chart-tick chart-tick-end"
              >
                {formatAxisShekelDetailed(tick)}
              </text>
            </g>
          ))}

          {/* Right axis: the running total. Dashed and tinted with the line's
              color, so it reads as that line's scale and not the bars'. */}
          {cumulativeTicks.map((tick) => (
            <g key={`cumulative-${tick}`}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yCumulative(tick)}
                y2={yCumulative(tick)}
                className="chart-grid chart-grid-balance"
              />
              <text
                x={WIDTH - MARGIN.right + 10}
                y={yCumulative(tick)}
                dy="0.32em"
                className="chart-tick chart-tick-balance"
              >
                {formatAxisShekelDetailed(tick)}
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
                <text x={x(tick.index)} y={HEIGHT - 34} className="chart-tick">
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {/* One stacked bar per year: interest at the baseline, indexation
              on top of it. The total stack height is that year's cost. */}
          {rows.map((row, index) => {
            const interestTop = yAnnual(row.interest)
            const totalTop = yAnnual(row.interest + (hasIndexation ? row.indexation : 0))
            const isActive = hovering && active === index
            return (
              <g
                key={row.year}
                className={isActive ? 'chart-bar-group-active' : undefined}
                // Explicit user-unit origin so the scale pivots at the bar's
                // base (same technique as the amortization chart).
                style={{ transformOrigin: `${x(index)}px ${zeroY}px` }}
              >
                <rect
                  x={x(index) - barWidth / 2}
                  y={Math.min(zeroY, interestTop)}
                  width={barWidth}
                  height={Math.abs(zeroY - interestTop)}
                  className="chart-bar chart-bar-interest"
                />
                {hasIndexation && (
                  <rect
                    x={x(index) - barWidth / 2}
                    y={Math.min(interestTop, totalTop)}
                    width={barWidth}
                    height={Math.abs(interestTop - totalTop)}
                    className="chart-bar chart-bar-indexation"
                  />
                )}
              </g>
            )
          })}

          <path d={cumulativePath} className="chart-line" />

          {hovering && activeRow && (
            <circle
              cx={x(active!)}
              cy={yCumulative(activeRow.cumulativeTotal)}
              r={4}
              className="chart-dot"
            />
          )}

          <text
            x={16}
            y={MARGIN.top + INNER_H / 2}
            className="chart-axis-title chart-axis-title-rot"
            transform={`rotate(-90 16 ${MARGIN.top + INNER_H / 2})`}
          >
            {t('calculator.forecast.axisAnnual')}
          </text>
          <text
            x={WIDTH - 16}
            y={MARGIN.top + INNER_H / 2}
            className="chart-axis-title chart-axis-title-rot"
            transform={`rotate(90 ${WIDTH - 16} ${MARGIN.top + INNER_H / 2})`}
          >
            {t('calculator.forecast.axisCumulative')}
          </text>

          <text x={44} y={12} className="chart-axis-title chart-axis-title-above">
            {t('calculator.forecast.axisAnnual')}
          </text>
          <text x={WIDTH - 44} y={12} className="chart-axis-title chart-axis-title-above">
            {t('calculator.forecast.axisCumulative')}
          </text>
          <text x={MARGIN.left + INNER_W / 2} y={HEIGHT - 8} className="chart-axis-title">
            {t('calculator.charts.axisYear')}
          </text>
        </svg>

        {showTooltip && activeRow && (
          <div
            ref={tooltipRef}
            className="chart-tooltip forecast-tooltip"
            data-open={hovering}
            role="status"
            style={{
              left: `${svgRound((x(active!) / WIDTH) * 100)}%`,
              // Follow the cursor vertically; the clamp hook keeps the callout
              // inside the plot near an edge.
              top: `${svgRound(pointerY)}%`,
              translate: '0 calc(-100% - 10px)',
            }}
          >
            <strong>{activeYearLabel}</strong>
            <span className="chart-tooltip-row">
              <i
                className="chart-tooltip-swatch"
                style={{ background: 'var(--chart-interest, #d2762e)' }}
              />
              {t('calculator.forecast.series.annualInterest')}: {formatCurrency(activeRow.interest)}
            </span>
            {hasIndexation && (
              <span className="chart-tooltip-row">
                <i
                  className="chart-tooltip-swatch"
                  style={{ background: 'var(--cost-donut-indexation, #7b5cc4)' }}
                />
                {t('calculator.forecast.series.annualIndexation')}:{' '}
                {formatCurrency(activeRow.indexation)}
              </span>
            )}
            <span className="chart-tooltip-row">
              <i
                className="chart-tooltip-swatch"
                style={{ background: 'var(--chart-balance, #111111)' }}
              />
              {t('calculator.forecast.series.cumulativeTotal')}:{' '}
              {formatCurrency(activeRow.cumulativeTotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
