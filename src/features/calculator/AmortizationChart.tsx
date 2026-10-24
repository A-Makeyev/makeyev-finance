import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import {
  alignedDualTicks,
  formatAxisShekel,
  niceRange,
  niceTicks,
  svgRound,
  xAxisTicks,
} from '@/lib/charts'
import { paymentComposition } from '@/lib/amortization'
import { useTooltipClamp } from '@/hooks/useTooltipClamp'
import { useTooltipPresence } from '@/hooks/useTooltipPresence'

/** One chart-ready period row - mapped from the schedule table's source. */
export interface ChartPeriodRow {
  /** Year number, or the running month count in the monthly view. */
  period: number
  principal: number
  /** CPI drift added to the balance in the period (0 for a non-indexed mix). */
  indexation: number
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
// draws strictly left-to-right (chronological) even on the RTL page. The
// viewBox matches the per-track chart's (900×560): both views share the
// schedule band's width, so equal viewBoxes give equal rendered heights and
// the table below stays put when the user switches between them.
//
// The right margin is wider than the left one because that side carries three
// things in a row: the plot edge, the balance ticks (the widest, "₪250K", is
// ~56px) and then the rotated יתרה axis title. At the left margin the title
// kept ~56px clear of the ticks; on the right it was left with ~6px, so the
// extra 20px here pulls the numbers back from the title (feedback request).
const WIDTH = 900
const HEIGHT = 560
const MARGIN = { top: 44, right: 108, bottom: 92, left: 88 }
const INNER_W = WIDTH - MARGIN.left - MARGIN.right
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom
/** Above this many periods, bars become a continuous area. */
const MAX_BARS = 40

/**
 * Amortization chart: stacked קרן נטו / הצמדה / ריבית bars (or a continuous
 * area for the monthly horizon) with the remaining יתרה overlaid on a second
 * axis. The split comes from the shared `paymentComposition` helper: `קרן` is
 * the principal payment net of the period's CPI drift, so the three segments
 * reconcile to the actual payment. A negative net principal (indexation grew
 * the debt faster than the principal was repaid) is drawn below the zero line
 * instead of being clamped. The two axes share one gridline count
 * (alignedDualTicks) when there is no negative segment, so the solid payments
 * grid and the dashed balance grid sit on the same rows. Fed from the exact
 * rows the schedule table renders - same source of truth.
 */
export function AmortizationChart({ rows, periodLabel, monthly = false }: AmortizationChartProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  // Whether the pointer is on the plot right now. `active` deliberately
  // outlives it, so the callout still has a period to show while it fades out.
  const [hovering, setHovering] = useState(false)
  const showTooltip = useTooltipPresence(hovering && active !== null)
  // Tooltip element + plot box, for the edge-clamp hook.
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const plotRef = useRef<HTMLDivElement | null>(null)
  // Re-clamp whenever the tooltip re-anchors to another period.
  useTooltipClamp(tooltipRef, plotRef, active)

  const geometry = useMemo(() => {
    if (rows.length === 0) return null
    const components = rows.map(paymentComposition)
    const maxPayment = Math.max(...rows.map((row) => row.payment))
    const maxBalance = Math.max(...rows.map((row) => row.balance))
    if (maxPayment <= 0) return null
    // A negative net principal has to keep its own space below zero: clamping
    // it would make the three segments stop adding up to the payment.
    const minNet = Math.min(0, ...components.map((component) => component.netPrincipal))
    const hasNegativeNet = minNet < 0
    // Bars occupy evenly spaced slots across a plot that is inset by `pad`
    // on both edges, so the first and last bar keep clear of the plot edges.
    // The inset is applied to the whole range - never to individual bars -
    // or the outer bars would get pushed into their neighbours.
    const pad = Math.min(INNER_W * 0.04, 16)
    const plotW = INNER_W - pad * 2
    const slot = plotW / rows.length
    // Every coordinate leaves this memo already rounded (see svgRound): the
    // schedule behind the rows can differ by a last bit between the server's
    // V8 and the browser's, which React would report as a hydration mismatch.
    // Rounding the pixels erases that without touching a single shekel.
    const x = (index: number) => svgRound(MARGIN.left + pad + slot * (index + 0.5))
    // Aligned dual-axis scales: both axes share one gridline count, so the
    // solid payments grid and the dashed balance grid coincide. Scale tops
    // are a round step at or above the data max (headroom); the fallback
    // (degenerate balance, e.g. all zero) keeps the old independent scales.
    // A negative net principal cannot use the zero-based alignment, so that
    // case takes a ranged payments axis and anchors the balance axis at the
    // same zero line.
    const aligned = hasNegativeNet ? null : alignedDualTicks(maxPayment, maxBalance)
    const range = hasNegativeNet ? niceRange(minNet, maxPayment) : null
    const scaleMinPayment = range ? range.axisMin : 0
    const scaleMaxPayment = range
      ? range.axisMax
      : aligned
        ? aligned.scaleMaxPayment
        : maxPayment
    const scaleMaxBalance = aligned
      ? aligned.scaleMaxBalance
      : Math.max(maxBalance, 1e-9)
    const yPayment = (value: number) =>
      svgRound(
        MARGIN.top +
          INNER_H *
          (1 - (value - scaleMinPayment) / (scaleMaxPayment - scaleMinPayment)),
      )
    const zeroY = yPayment(0)
    // The balance axis starts at the payments zero line in both modes, so the
    // dashed grid never crosses the solid one at a second baseline.
    const yBalance = (value: number) =>
      svgRound(zeroY - (value / scaleMaxBalance) * (zeroY - MARGIN.top))
    return {
      components,
      maxPayment,
      maxBalance,
      aligned,
      range,
      slot,
      pad,
      x,
      yPayment,
      yBalance,
      zeroY,
    }
  }, [rows])

  if (!geometry) return null
  const {
    components,
    maxPayment,
    maxBalance,
    aligned,
    range,
    slot,
    pad,
    x,
    yPayment,
    yBalance,
    zeroY,
  } = geometry
  const paymentTicks = range ? range.ticks : aligned ? aligned.paymentTicks : niceTicks(maxPayment)
  const balanceTicks = aligned ? aligned.balanceTicks : niceTicks(maxBalance)
  const useBars = rows.length <= MAX_BARS
  const barWidth = svgRound(Math.min(30, slot * 0.66))
  // The indexation segment is shown only when the mix actually carries it, so
  // a non-indexed schedule keeps its original two-segment picture.
  const hasIndexation = rows.some((row) => row.indexation > 0)
  const hasNegativeNet = range !== null

  const activeRow = active !== null ? rows[active] : null
  const activeComponent = active !== null ? components[active] : null
  // The tooltip hangs just above the balance line at the hovered period - the
  // line is the curve being read, and the payment bars behind it are a tall
  // block on every period, so anchoring to those would pin the callout near
  // the top of the chart. It deliberately does NOT follow the pointer: the
  // callout belongs to the graph, not to the cursor.
  const activeAnchorY = activeRow ? yBalance(activeRow.balance) : MARGIN.top
  const xTicks = xAxisTicks(rows.length, monthly)
  // The payments axis is a DIFFERENT scale per granularity: a yearly row
  // carries the 12 monthly payments of its year, a monthly row one payment.
  // Same numbers, 12x apart, so the labels must follow the mode - the monthly
  // axis showing ₪8K under the words "annual payment" would misstate every
  // figure on it by a factor of twelve.
  const paymentAxisLabel = monthly
    ? t('calculator.charts.axisMonthlyPayment')
    : t('calculator.charts.axisPayment')
  const paymentTooltipLabel = monthly
    ? t('calculator.charts.axisMonthlyPayment')
    : t('calculator.schedule.annualPaymentHeader')

  const handleMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relative = ((event.clientX - bounds.left) / bounds.width) * WIDTH - MARGIN.left
    const index = Math.floor((relative - pad) / Math.max(slot, 1e-9))
    setActive(Math.max(0, Math.min(rows.length - 1, index)))
    setHovering(true)
  }

  return (
    <div className="amort-chart" data-testid="amortization-chart">
      <div className="chart-legend" aria-hidden="true">
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-principal" />{' '}
          {t('calculator.charts.netPrincipalLabel')}
        </span>
        {hasIndexation && (
          <span className="chart-legend-item">
            <i className="chart-swatch chart-swatch-indexation" />{' '}
            {t('calculator.schedule.indexationHeader')}
          </span>
        )}
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-interest" />{' '}
          {t('calculator.schedule.interestHeader')}
        </span>
        <span className="chart-legend-item">
          <i className="chart-swatch chart-swatch-balance" />{' '}
          {t('calculator.schedule.balanceHeader')}
        </span>
      </div>

      <div className="amort-plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          direction="ltr"
          role="img"
          aria-label={t('calculator.charts.amortAria')}
          onMouseMove={handleMove}
          onMouseLeave={() => setHovering(false)}
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
                <text x={x(tick.index)} y={HEIGHT - 36} className="chart-tick">
                  {tick.label}
                </text>
              )}
            </g>
          ))}

          {useBars
            ? rows.map((row, index) => {
                const component = components[index]
                // Each segment is a band between two stacked edges; drawing a
                // band (rather than a rect up from the baseline) keeps the
                // stack honest even when net principal is negative.
                const netTop = yPayment(component.netPrincipal)
                const principalTop = yPayment(component.netPrincipal + component.indexation)
                const paymentTop = yPayment(row.payment)
                const isActive = hovering && active === index
                return (
                  <g
                    key={row.period}
                    className={isActive ? 'chart-bar-group-active' : undefined}
                    // Explicit user-unit transform origin (bar center-x, baseline)
                    // so the scale pivots at the bar's base - the same technique
                    // the donut uses. Avoids transform-box: fill-box, which makes
                    // Chromium re-rasterize the whole SVG (flickering text).
                    style={{ transformOrigin: `${x(index)}px ${zeroY}px` }}
                  >
                    <rect
                      x={x(index) - barWidth / 2}
                      y={Math.min(zeroY, netTop)}
                      width={barWidth}
                      height={Math.abs(zeroY - netTop)}
                      className="chart-bar chart-bar-principal"
                    />
                    {hasIndexation && (
                      <rect
                        x={x(index) - barWidth / 2}
                        y={Math.min(netTop, principalTop)}
                        width={barWidth}
                        height={Math.abs(principalTop - netTop)}
                        className="chart-bar chart-bar-indexation"
                      />
                    )}
                    <rect
                      x={x(index) - barWidth / 2}
                      y={Math.min(principalTop, paymentTop)}
                      width={barWidth}
                      height={Math.abs(paymentTop - principalTop)}
                      className="chart-bar chart-bar-interest"
                    />
                  </g>
                )
              })
            : (() => {
                // Continuous area for long (monthly) horizons: draw each
                // component as the band between its two stacked edges, so the
                // segments never cover one another.
                const edge = (values: number[]) =>
                  values
                    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${value}`)
                    .join(' ')
                const band = (top: string, bottom: number[]) => {
                  const reverse = bottom
                    .map((value, offset) => {
                      const index = bottom.length - 1 - offset
                      return `L ${x(index)} ${value}`
                    })
                    .join(' ')
                  return `${top} ${reverse} Z`
                }
                const netEdge = components.map((component) => yPayment(component.netPrincipal))
                const principalEdge = components.map((component) =>
                  yPayment(component.netPrincipal + component.indexation),
                )
                const paymentEdge = rows.map((row) => yPayment(row.payment))
                const zeroEdge = rows.map(() => zeroY)
                const balanceEdge = rows
                  .map(
                    (row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${yBalance(row.balance)}`,
                  )
                  .join(' ')
                return (
                  <>
                    <path
                      d={band(edge(netEdge), zeroEdge)}
                      className="chart-area chart-area-principal"
                    />
                    {hasIndexation && (
                      <path
                        d={band(edge(principalEdge), netEdge)}
                        className="chart-area chart-area-indexation"
                      />
                    )}
                    <path
                      d={band(edge(paymentEdge), principalEdge)}
                      className="chart-area chart-area-interest"
                    />
                    <path d={balanceEdge} className="chart-line" />
                  </>
                )
              })()}

          {/* The zero line is only interior when a segment dips below it. It is
              drawn over the bars so the indexation band crossing zero cannot
              hide the baseline. */}
          {hasNegativeNet && (
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={zeroY}
              y2={zeroY}
              className="chart-zero-line"
            />
          )}

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
          {hovering && activeRow && (
            <circle cx={x(active!)} cy={yBalance(activeRow.balance)} r={4} className="chart-dot" />
          )}

          {/* Axis titles: rotated vertically at the outer edges, left = payment
              (annual or monthly, per the mode), right = balance; the bottom title
              stays "year" in BOTH modes, because that is what the labeled ticks
              are in both - the monthly tab plots months but labels year
              boundaries, and each hovered point names its own month. The chart
              SVG is LTR so these use logical positions, labels stay Hebrew. */}
          <text
            x={16}
            y={MARGIN.top + INNER_H / 2}
            className="chart-axis-title chart-axis-title-rot"
            transform={`rotate(-90 16 ${MARGIN.top + INNER_H / 2})`}
          >
            {paymentAxisLabel}
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
          <text x={38} y={12} className="chart-axis-title chart-axis-title-above">
            {paymentAxisLabel}
          </text>
          <text x={WIDTH - 44} y={12} className="chart-axis-title chart-axis-title-above">
            {t('calculator.charts.axisBalance')}
          </text>

          <text x={MARGIN.left + INNER_W / 2} y={HEIGHT - 8} className="chart-axis-title">
            {t('calculator.charts.axisYear')}
          </text>
        </svg>

        {showTooltip && activeRow && (
          <div
            ref={tooltipRef}
            className="chart-tooltip"
            data-open={hovering}
            role="status"
            style={{
              // Physical `left`, not insetInlineStart: the SVG is LTR while the
              // page is RTL, so the logical property would mirror the position.
              // The clamp hook adjusts the transform near the plot edges so
              // the whole tooltip stays on screen. `translate` (a separate
              // property from `transform`) lifts the callout above the hovered
              // point without fighting that clamp.
              left: `${svgRound((x(active!) / WIDTH) * 100)}%`,
              // Percent of the plot box, which is exactly the SVG: the tooltip
              // is positioned against `.amort-plot`, not the whole chart, so a
              // viewBox y in [0, HEIGHT] maps straight onto it.
              top: `${svgRound((activeAnchorY / HEIGHT) * 100)}%`,
              // Bottom edge just clear of the point, with a small gap.
              translate: '0 calc(-100% - 10px)',
            }}
          >
            <strong>{periodLabel(activeRow.period)}</strong>
            {activeComponent && (
              <span>
                {t('calculator.charts.netPrincipalLabel')}:{' '}
                {formatCurrency(activeComponent.netPrincipal)}
              </span>
            )}
            {hasIndexation && activeComponent && (
              <span>
                {t('calculator.schedule.indexationHeader')}:{' '}
                {formatCurrency(activeComponent.indexation)}
              </span>
            )}
            <span>
              {t('calculator.schedule.interestHeader')}: {formatCurrency(activeRow.interest)}
            </span>
            <span>
              {t('calculator.schedule.balanceHeader')}: {formatCurrency(activeRow.balance)}
            </span>
            <span>
              {paymentTooltipLabel}: {formatCurrency(activeRow.payment)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
