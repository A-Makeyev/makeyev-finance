import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { arcPath, donutSegments, midAngle, svgRound } from '@/lib/charts'
import { useTooltipPresence } from '@/hooks/useTooltipPresence'

interface TotalCostDonutProps {
  /** Nominal loan amount (what was actually borrowed, indexation excluded). */
  principal: number
  /** CPI drift folded into the debt over the term (0 for a non-indexed mix). */
  indexation: number
  totalInterest: number
}

const SIZE = 170
const CENTER = SIZE / 2
/** Ring radii as fractions of the canvas, taken from TrackMixDonut's own base
 *  circle (150/320 outer, 92/320 inner). The pair renders the two donuts at
 *  the same width, so sharing the fractions is what makes the rings the same
 *  size side by side. */
const R_OUTER = (150 / 320) * SIZE
const R_INNER = (92 / 320) * SIZE
const GAP = 0.03
/** Distance between the hovered slice and its callout, in viewBox units. */
const TOOLTIP_MARGIN = 14

/**
 * Slice fills in draw order (principal, indexation, interest). The middle
 * slice is skipped on screen when its value is 0, so a non-indexed mix reads
 * exactly as before: principal vs interest.
 */
const SLICE_COLORS = [
  'var(--cost-donut-principal, #087f78)',
  'var(--cost-donut-indexation, #7b5cc4)',
  'var(--cost-donut-interest, #e0a63c)',
]

/**
 * Ink for the percentage printed inside each slice, one token per fill: the
 * three fills do not share a text color. White reads on the teal and purple
 * slices (4.9:1 and 5.0:1) but only 2.2:1 on the gold interest slice, which
 * takes near-black instead; dark mode brightens all three fills, so every
 * label flips to dark ink there. The ratios live next to the fills in
 * globals.css.
 */
const SLICE_LABEL_COLORS = [
  'var(--cost-donut-principal-ink, #ffffff)',
  'var(--cost-donut-indexation-ink, #ffffff)',
  'var(--cost-donut-interest-ink, #14201e)',
]

/**
 * The "how much am I really paying the bank" companion: the split of total
 * repayments into קרן / הצמדה / ריבית over the full term, one small donut,
 * center showing the interest share, legend with the ₪ amounts - same numbers
 * the summary cards show. The indexation slice appears only when the mix has
 * an indexed track (indexation > 0).
 *
 * Hovering a slice behaves like the track-mix donut: the slice pops out and a
 * callout with the amount and share appears just outside it, on the side the
 * slice faces. Like that donut, each slice also carries its own share inside
 * the ring (from 8% up, where the number still fits) in a text color picked
 * for that slice's fill, and the legend repeats the share.
 *
 * A donut is picture-only, so the same figures are written out for assistive
 * tech in a visually-hidden list that the SVG points at with
 * aria-describedby: every slice with its amount and share, plus the total.
 * Without it the sentence "cost donut" would be all a screen reader got.
 */
export function TotalCostDonut({ principal, indexation, totalInterest }: TotalCostDonutProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  // Whether a slice is under the pointer right now. `active` outlives it so
  // the callout keeps its slice while it fades out.
  const [hovering, setHovering] = useState(false)
  const summaryId = useId()
  const total = principal + indexation + totalInterest
  const interestPercent = total > 0 ? Math.round((totalInterest / total) * 100) : 0
  const percentOf = (value: number) =>
    total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0

  // One share per slice, reused by the in-slice label, the legend and the
  // screen-reader summary - so the three can never disagree by a rounding
  // step.
  const slices = [
    {
      key: 'principal' as const,
      label: t('calculator.schedule.principalHeader'),
      value: principal,
      percent: percentOf(principal),
      color: SLICE_COLORS[0],
      labelColor: SLICE_LABEL_COLORS[0],
    },
    ...(indexation > 0
      ? [
          {
            key: 'indexation' as const,
            label: t('calculator.schedule.indexationHeader'),
            value: indexation,
            percent: percentOf(indexation),
            color: SLICE_COLORS[1],
            labelColor: SLICE_LABEL_COLORS[1],
          },
        ]
      : []),
    {
      key: 'interest' as const,
      label: t('calculator.schedule.interestHeader'),
      value: totalInterest,
      percent: percentOf(totalInterest),
      color: SLICE_COLORS[2],
      labelColor: SLICE_LABEL_COLORS[2],
    },
  ]
  const segments = donutSegments(slices.map((slice) => slice.value))
  const activeSlice = active !== null ? slices[active] : null
  const activeSegment = active !== null ? segments[active] : null
  const activeAngle = activeSegment
    ? midAngle(activeSegment.startAngle, activeSegment.endAngle)
    : null
  const showTooltip = useTooltipPresence(hovering && active !== null)

  // Place the callout just OUTSIDE the hovered slice, on the side it faces.
  // data-side names the arrow edge = the side facing the circle, exactly like
  // the track-mix donut.
  let tipSide: 'left' | 'right' | 'top' | 'bottom' = 'top'
  let tipLeft = 50
  let tipTop = 50
  if (activeAngle !== null) {
    const cos = Math.cos(activeAngle)
    const sin = Math.sin(activeAngle)
    const px = CENTER + R_OUTER * cos // slice outer-edge x (viewBox units)
    const py = CENTER + R_OUTER * sin // slice outer-edge y (viewBox units)
    if (Math.abs(cos) >= Math.abs(sin)) {
      if (cos >= 0) {
        tipSide = 'left' // arrow on the tooltip's left edge, pointing toward the circle
        tipLeft = ((px + TOOLTIP_MARGIN) / SIZE) * 100
        tipTop = (py / SIZE) * 100
      } else {
        tipSide = 'right'
        tipLeft = ((px - TOOLTIP_MARGIN) / SIZE) * 100
        tipTop = (py / SIZE) * 100
      }
    } else if (sin >= 0) {
      tipSide = 'top' // arrow on the tooltip's top edge, pointing up toward the circle
      tipTop = ((py + TOOLTIP_MARGIN) / SIZE) * 100
      tipLeft = (px / SIZE) * 100
    } else {
      tipSide = 'bottom'
      tipTop = ((py - TOOLTIP_MARGIN) / SIZE) * 100
      tipLeft = (px / SIZE) * 100
    }
  }

  return (
    <div className="cost-donut" data-testid="total-cost-donut">
      <div className="cost-donut-plot">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={t('calculator.charts.costAria')}
          aria-describedby={summaryId}
          direction="ltr"
        >
          {total === 0 && (
            <circle cx={CENTER} cy={CENTER} r={(R_OUTER + R_INNER) / 2} className="donut-empty" />
          )}
          {segments.map((segment, index) => {
            const insetStart = segment.startAngle + (segment.fraction > 0 ? GAP / 2 : 0)
            const insetEnd = segment.endAngle - (segment.fraction > 0 ? GAP / 2 : 0)
            if (insetEnd <= insetStart) return null
            const slice = slices[index]
            const isActive = hovering && active === index
            const mid = midAngle(insetStart, insetEnd)
            const labelRadius = (R_OUTER + R_INNER) / 2
            const percent = slice.percent
            return (
              // The slice and its % label share one animated group, so the
              // number scales out from the donut center with the slice.
              <g
                key={slice.key}
                className={`mix-slice${isActive ? ' mix-slice-active' : ''}`}
                style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                onMouseEnter={() => {
                  setActive(index)
                  setHovering(true)
                }}
                onMouseLeave={() => setHovering(false)}
              >
                <path
                  d={arcPath(CENTER, CENTER, R_OUTER, R_INNER, insetStart, insetEnd)}
                  fill={slice.color}
                />
                {/* Same 8% floor as the mix donut: below that the number
                    would spill past the slice's edges. */}
                {percent >= 8 && (
                  <text
                    // Rounded like every other chart coordinate: Math.cos/sin
                    // are not required to be correctly rounded, so Node and
                    // the browser can differ in the last bit and React reports
                    // the serialized attribute as a hydration mismatch.
                    x={svgRound(CENTER + labelRadius * Math.cos(mid))}
                    y={svgRound(CENTER + labelRadius * Math.sin(mid))}
                    className="donut-slice-label"
                    style={{ fill: slice.labelColor }}
                  >
                    {percent}%
                  </text>
                )}
              </g>
            )
          })}
          {/* Same em-based spacing as the mix donut: the pair and the asides
              ring scale the same geometry differently, and em keeps the gap
              proportional to the labels' own rendered size. */}
          <text x={CENTER} y={CENTER} dy="-0.6em" className="donut-center-label">
            {t('calculator.charts.costCenterLabel')}
          </text>
          <text x={CENTER} y={CENTER} dy="0.75em" className="donut-center-value">
            {interestPercent}%
          </text>
        </svg>

        {showTooltip && activeSlice && activeSegment && activeAngle !== null && (
          <div
            className="chart-tooltip mix-slice-tooltip"
            data-open={hovering}
            role="status"
            data-side={tipSide}
            style={{ left: `${svgRound(tipLeft)}%`, top: `${svgRound(tipTop)}%` }}
          >
            <strong>{activeSlice.label}</strong>
            <span>
              {formatCurrency(activeSlice.value)} · {activeSlice.percent}%
            </span>
          </div>
        )}
      </div>

      <ul className="cost-legend">
        {slices.map((slice) => (
          <li key={slice.key} className="cost-legend-item">
            <i className="chart-swatch" style={{ background: slice.color }} />
            <div className="cost-legend-text">
              <span className="cost-legend-name">{slice.label}</span>
              <span className="cost-legend-amount">
                {formatCurrency(slice.value)} · {slice.percent}%
              </span>
            </div>
          </li>
        ))}
      </ul>

      <ul id={summaryId} className="visually-hidden" data-testid="total-cost-donut-summary">
        {slices.map((slice) => (
          <li key={slice.key}>
            {t('calculator.charts.costSliceLine', {
              label: slice.label,
              amount: formatCurrency(slice.value),
              percent: slice.percent,
            })}
          </li>
        ))}
        <li>{t('calculator.charts.costTotalLine', { amount: formatCurrency(total) })}</li>
      </ul>
    </div>
  )
}
