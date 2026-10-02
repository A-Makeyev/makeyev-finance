import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { arcPath, donutSegments, midAngle } from '@/lib/charts'
import { TRACK_TYPE_COLORS } from './trackColors'
import type { TrackType } from '@/lib/amortization'

/** One donut slice - a configured track, sized by its amount. */
export interface TrackShare {
  trackId: string
  type: TrackType
  amount: number
}

const BASE_SIZE = 320
/** Geometry ratios of the original 320px donut, so any `size` scales it. */
const R_OUTER_RATIO = 150 / BASE_SIZE
const R_INNER_RATIO = 92 / BASE_SIZE
/** Angular gap between slices, in radians. */
const GAP = 0.035

/**
 * The track-mix donut: one slice per configured track, sized by amount,
 * colored by track TYPE (a track switching to פריים recolors to פריים
 * everywhere). Hovering a slice scales it out slightly and shows a tooltip
 * with that track's name, amount and share - mirroring the amortization
 * chart's hover. The center shows the total סכום המשכנתא; the legend below
 * lists each slice's amount and share.
 *
 * `size` scales the ring while keeping the original proportions (the saved-mix
 * card renders the SAME chart at a smaller size rather than a second
 * implementation). `showLegend` lets that card drop the legend, since it
 * already lists the tracks as text beside the ring.
 */
export function TrackMixDonut({
  shares,
  size = BASE_SIZE,
  showLegend = true,
  className,
}: {
  shares: TrackShare[]
  size?: number
  showLegend?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const total = shares.reduce((sum, share) => sum + Math.max(0, share.amount), 0)
  const segments = donutSegments(shares.map((share) => share.amount))
  const activeShare = active !== null ? shares[active] : null

  const center = size / 2
  const rOuter = size * R_OUTER_RATIO
  const rInner = size * R_INNER_RATIO

  // Position the callout just OUTSIDE the hovered slice, on the side it faces.
  // Anchor the tooltip's facing edge to the slice's outer-edge point so it
  // always sits beside the circle (not overlapping/centered on it), with a
  // clear margin. data-side names the arrow edge = the side facing the circle.
  const activeSegment = active !== null ? segments[active] : null
  const activeAngle = activeSegment ? midAngle(activeSegment.startAngle, activeSegment.endAngle) : null
  const MARGIN = 16
  let tipSide: 'left' | 'right' | 'top' | 'bottom' = 'top'
  let tipLeft = 50
  let tipTop = 50
  if (activeAngle !== null) {
    const cos = Math.cos(activeAngle)
    const sin = Math.sin(activeAngle)
    const px = center + rOuter * cos // slice outer-edge x (viewBox units)
    const py = center + rOuter * sin // slice outer-edge y (viewBox units)
    if (Math.abs(cos) >= Math.abs(sin)) {
      // Slice is on the left or right of the circle.
      if (cos >= 0) {
        tipSide = 'left' // arrow on tooltip's left edge, pointing toward circle
        tipLeft = ((px + MARGIN) / size) * 100
        tipTop = (py / size) * 100
      } else {
        tipSide = 'right'
        tipLeft = ((px - MARGIN) / size) * 100
        tipTop = (py / size) * 100
      }
    } else {
      // Slice is near the bottom or top of the circle.
      if (sin >= 0) {
        tipSide = 'top' // arrow on tooltip's top edge, pointing up toward circle
        tipTop = ((py + MARGIN) / size) * 100
        tipLeft = (px / size) * 100
      } else {
        tipSide = 'bottom'
        tipTop = ((py - MARGIN) / size) * 100
        tipLeft = (px / size) * 100
      }
    }
  }

  return (
    <div className={`mix-donut${className ? ` ${className}` : ''}`} data-testid="track-mix-donut">
      <div className="mix-donut-plot">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={t('calculator.charts.mixAria')}
          direction="ltr"
          data-testid="track-mix-donut-plot"
        >
          {total === 0 && (
            <circle cx={center} cy={center} r={(rOuter + rInner) / 2} className="donut-empty" />
          )}
          {segments.map((segment, index) => {
            const share = shares[index]
            const insetStart = segment.startAngle + (segment.fraction > 0 ? GAP / 2 : 0)
            const insetEnd = segment.endAngle - (segment.fraction > 0 ? GAP / 2 : 0)
            if (insetEnd <= insetStart) return null
            const mid = midAngle(insetStart, insetEnd)
            const labelRadius = (rOuter + rInner) / 2
            const percent = Math.round(segment.fraction * 100)
            const isActive = active === index
            // The slice and its % label share one animated group, so the
            // number scales out (from the donut center) with the slice.
            return (
              <g
                key={share.trackId}
                className={`mix-slice${isActive ? ' mix-slice-active' : ''}`}
                style={{ transformOrigin: `${center}px ${center}px` }}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                <path
                  d={arcPath(center, center, rOuter, rInner, insetStart, insetEnd)}
                  fill={TRACK_TYPE_COLORS[share.type]}
                />
                {percent >= 8 && (
                  <text
                    x={center + labelRadius * Math.cos(mid)}
                    y={center + labelRadius * Math.sin(mid)}
                    className="donut-slice-label"
                  >
                    {percent}%
                  </text>
                )}
              </g>
            )
          })}
          <text x={center} y={center - 6} className="donut-center-label">
            {t('calculator.charts.mixTotalLabel')}
          </text>
          <text x={center} y={center + 14} className="donut-center-value">
            {formatCurrency(total)}
          </text>
        </svg>

        {activeShare && activeAngle !== null && (
          <div
            className="chart-tooltip mix-slice-tooltip"
            role="status"
            data-side={tipSide}
            style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}
          >
            <strong>{t(`calculator.trackTypes.${activeShare.type}`)}</strong>
            <span>
              {/* Same zero-guard as the legend below: with no slices there is
                  nothing to hover, but a 0 total must never print "NaN%". */}
              {formatCurrency(activeShare.amount)} ·{' '}
              {total > 0 ? Math.round((Math.max(0, activeShare.amount) / total) * 100) : 0}%
            </span>
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="mix-legend">
          {shares.map((share) => {
            const percent = total > 0 ? Math.round((Math.max(0, share.amount) / total) * 100) : 0
            return (
              <li key={share.trackId} className="mix-legend-item">
                <i className="chart-swatch" style={{ background: TRACK_TYPE_COLORS[share.type] }} />
                <div className="mix-legend-text">
                  <span className="mix-legend-name">{t(`calculator.trackTypes.${share.type}`)}</span>
                  <span className="mix-legend-amount">
                    {formatCurrency(share.amount)} · {percent}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
