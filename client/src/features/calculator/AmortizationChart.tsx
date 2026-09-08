import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { alignedDualTicks, formatAxisShekel, niceTicks, xAxisTicks } from '@/lib/charts'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'

/** One chart-ready period row - mapped from the schedule table's source. */
export interface ChartPeriodRow {
  /** Year number, or the running month count in the monthly view. */
  period: number
  principal: number
  interest: number
  balance: number
  payment: number
}

interface AmortizationChartProps {
  rows: ChartPeriodRow[]
  /** Formats the tooltip period label (already localized, e.g. "שנה 3"). */
  periodLabel: (period: number) => string
  /** Monthly rows label year boundaries on the x axis instead of every row. */
  monthly?: boolean
}

// SVG geometry: generous margins so no label ever clips - the left/right
// margins hold the ₪ axis labels, the bottom holds the year row. The chart
// draws strictly left-to-right (chronological) even on the RTL page.
const WIDTH = 720
const HEIGHT = 330
const MARGIN = { top: 30, right: 70, bottom: 74, left: 76 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom
/** Above this many periods, bars become a continuous area. */
const MAX_BARS = 40

/**
 * Amortization chart: stacked קרן/ריבית bars (or a continuous area for the
 * monthly horizon) with the remaining יתרה overlaid on a second axis. The
 * two axes share one gridline count (alignedDualTicks) so the solid
 * payments grid and the dashed balance grid sit on the same rows. Fed from
 * the exact rows the schedule table renders - same source of truth.
 */
export function AmortizationChart({ rows, periodLabel, monthly = false }: AmortizationChartProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  // Tooltip element + chart container, for the edge-clamp hook.
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  // Re-clamp whenever the tooltip re-anchors to another period.
  useTooltipClamp(tooltipRef, plotRef, active)

  const geometry = useMemo(() => {
    if (rows.length === 0) return null
    const maxPayment = Math.max(...rows.map((row) => row.payment))
    const maxBalance = Math.max(...rows.map((row) => row.balance))
    if (maxPayment <= 0) return null
    // Bars occupy evenly spaced slots across a plot that is inset by `pad`
    // on both edges, so the first and last bar keep clear of the plot edges.
    // The inset is applied to the whole range - never to individual bars -
    // or the outer bars would get pushed into their neighbours.
    const pad = Math.min(INNER_W * 0.04, 16)
    const plotW = INNER_W - pad * 2
    const slot = plotW / rows.length
    const x = (index: number) => MARGIN.left + pad + slot * (index + 0.5)
    // Aligned dual-axis scales: both axes share one gridline count, so the
    // solid payments grid and the dashed balance grid coincide. Scale tops
    // are a round step at or above the data max (headroom); the fallback
    // (degenerate balance, e.g. all zero) keeps the old independent scales.
    const aligned = alignedDualTicks(maxPayment, maxBalance)
    const scaleMaxPayment = aligned ? aligned.scaleMaxPayment : maxPayment
    const scaleMaxBalance = aligned ? aligned.scaleMaxBalance : maxBalance
    const yPayment = (value: number) => MARGIN.top + INNER_H * (1 - value / scaleMaxPayment)
    const yBalance = (value: number) => MARGIN.top + INNER_H * (1 - value / scaleMaxBalance)
    return { maxPayment, maxBalance, aligned, slot, pad, x, yPayment, yBalance }
  }, [rows])

  if (!geometry) return null
  const { maxPayment, maxBalance, aligned, slot, pad, x, yPayment, yBalance } = geometry
  const paymentTicks = aligned ? aligned.paymentTicks : niceTicks(maxPayment)
  const balanceTicks = aligned ? aligned.balanceTicks : niceTicks(maxBalance)
  const useBars = rows.length <= MAX_BARS
  const barWidth = Math.min(30, slot * 0.66)

  const activeRow = active !== null ? rows[active] : null
  const xTicks = xAxisTicks(rows.length, monthly)

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relative = ((event.clientX - bounds.left) / bounds.width) * WIDTH - MARGIN.left
    const index = Math.floor((relative - pad) / Math.max(slot, 1e-9))
    setActive(Math.max(0, Math.min(rows.length - 1, index)))
  }

  return (
    <div className="amort-chart" data-testid="amortization-chart" ref={plotRef}>
      <div className="chart-legend" aria-hidden="true">
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-principal" />{' '}
          {t('calculator.schedule.principalHeader')}
        </span>
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-interest" />{' '}
          {t('calculator.schedule.interestHeader')}
        </span>
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-balance" />{' '}
          {t('calculator.schedule.balanceHeader')}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        direction="ltr"
        role="img"
        aria-label={t('calculator.charts.amortAria')}
        onMouseMove={handleMove}
        onMouseLeave={() => setActive(null)}
        onClick={handleMove}
      >
        {/* Horizontal grid + left (payments) axis. */}
        {paymentTicks.map((tick) => (
          <g key={`p-${tick}`}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yPayment(tick)}
              y2={yPayment(tick)}
              className="chart-grid"
            />
            <text
              x={MARGIN.left - 10}
              y={yPayment(tick)}
              dy="0.32em"
              className="chart-tick chart-tick-end"
            >
              {formatAxisShekel(tick)}
            </text>
          </g>
        ))}

        {/* Right (balance) axis - the overlay line's scale. Its ticks get
            their own faint dashed grid, tinted with the balance color, so a
            reader can tell which axis drives which series: solid grid =
            payments bars, dashed = the balance line. Both grids share the
            same rows (aligned dual-axis ticks). */}
        {balanceTicks.map((tick) => (
          <g key={`b-${tick}`}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={yBalance(tick)}
              y2={yBalance(tick)}
              className="chart-grid chart-grid-balance"
            />
            <text
              x={WIDTH - MARGIN.right + 10}
              y={yBalance(tick)}
              dy="0.32em"
              className="chart-tick chart-tick-balance"
            >
              {formatAxisShekel(tick)}
            </text>
          </g>
        ))}

        {/* X ticks: every year when it fits (minor ticks otherwise), always
            evenly spaced and chronological left to right. */}
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

        {useBars
          ? rows.map((row, index) => {
              const principalTop = yPayment(row.principal)
              const interestTop = yPayment(row.principal + row.interest)
              const isActive = active === index
              return (
                <g
                  key={row.period}
                  className={isActive ? 'chart-bar-group-active' : undefined}
                  // Explicit user-unit transform origin (bar center-x, baseline)
                  // so the scale pivots at the bar's base - the same technique
                  // the donut uses. Avoids transform-box: fill-box, which makes
                  // Chromium re-rasterize the whole SVG (flickering text).
                  style={{ transformOrigin: `${x(index)}px ${MARGIN.top + INNER_H}px` }}
                >
                  <rect
                    x={x(index) - barWidth / 2}
                    y={principalTop}
                    width={barWidth}
                    height={MARGIN.top + INNER_H - principalTop}
                    className="chart-bar chart-bar-principal"
                  />
                  <rect
                    x={x(index) - barWidth / 2}
                    y={interestTop}
                    width={barWidth}
                    height={Math.max(0, principalTop - interestTop)}
                    className="chart-bar chart-bar-interest"
                  />
                </g>
              )
            })
          : (() => {
              // Continuous area for long (monthly) horizons: stack edges only.
              const principalEdge = rows
                .map(
                  (row, index) =>
                    `${index === 0 ? 'M' : 'L'} ${x(index)} ${yPayment(row.principal)}`,
                )
                .join(' ')
              const interestEdge = rows
                .map(
                  (row, index) =>
                    `${index === 0 ? 'M' : 'L'} ${x(index)} ${yPayment(row.principal + row.interest)}`,
                )
                .join(' ')
              const baseline = MARGIN.top + INNER_H
              const balanceEdge = rows
                .map(
                  (row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${yBalance(row.balance)}`,
                )
                .join(' ')
              return (
                <>
                  <path
                    d={`${principalEdge} L ${x(rows.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`}
                    className="chart-area chart-area-principal"
                  />
                  <path
                    d={`${interestEdge} L ${x(rows.length - 1)} ${baseline} L ${x(0)} ${baseline} Z`}
                    className="chart-area chart-area-interest"
                  />
                  <path d={balanceEdge} className="chart-line" />
                </>
              )
            })()}

        {useBars && (
          <path
            d={rows
              .map(
                (row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${yBalance(row.balance)}`,
              )
              .join(' ')}
            className="chart-line"
          />
        )}

        {/* Hover/tap marker on the balance line. */}
        {activeRow && (
          <circle cx={x(active!)} cy={yBalance(activeRow.balance)} r={4} className="chart-dot" />
        )}

        {/* Axis titles: rotated vertically at the outer edges, left = annual
            payment, right = balance; the year title stays at the bottom. The
            chart SVG is LTR so these use logical positions, labels stay Hebrew. */}
        <text
          x={16}
          y={MARGIN.top + INNER_H / 2}
          className="chart-axis-title chart-axis-title-rot"
          transform={`rotate(-90 16 ${MARGIN.top + INNER_H / 2})`}
        >
          {t('calculator.charts.axisPayment')}
        </text>
        <text
          x={WIDTH - 16}
          y={MARGIN.top + INNER_H / 2}
          className="chart-axis-title chart-axis-title-rot"
          transform={`rotate(90 ${WIDTH - 16} ${MARGIN.top + INNER_H / 2})`}
        >
          {t('calculator.charts.axisBalance')}
        </text>

        {/* Small-screen stand-ins for the rotated titles: short horizontal
            captions above the axis numbers, shown on screens ≤800px (CSS). */}
        <text x={38} y={8} className="chart-axis-title chart-axis-title-above">
          {t('calculator.charts.axisPayment')}
        </text>
        <text x={685} y={8} className="chart-axis-title chart-axis-title-above">
          {t('calculator.charts.axisBalance')}
        </text>

        <text x={MARGIN.left + INNER_W / 2} y={HEIGHT - 6} className="chart-axis-title">
          {t('calculator.charts.axisYear')}
        </text>
      </svg>

      {activeRow && (
        <div
          ref={tooltipRef}
          className="chart-tooltip"
          role="status"
          style={{
            // Physical `left`, not insetInlineStart: the SVG is LTR while the
            // page is RTL, so the logical property would mirror the position.
            // The clamp hook adjusts the transform near the plot edges so
            // the whole tooltip stays on screen.
            left: `${(x(active!) / WIDTH) * 100}%`,
          }}
        >
          <strong>{periodLabel(activeRow.period)}</strong>
          <span>
            {t('calculator.schedule.principalHeader')}: {formatCurrency(activeRow.principal)}
          </span>
          <span>
            {t('calculator.schedule.interestHeader')}: {formatCurrency(activeRow.interest)}
          </span>
          <span>
            {t('calculator.schedule.balanceHeader')}: {formatCurrency(activeRow.balance)}
          </span>
          <span>
            {t('calculator.schedule.annualPaymentHeader')}: {formatCurrency(activeRow.payment)}
          </span>
        </div>
      )}
    </div>
  )
}
