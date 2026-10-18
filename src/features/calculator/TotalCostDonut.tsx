import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'
import { arcPath, donutSegments } from '@/lib/charts'

interface TotalCostDonutProps {
  /** Nominal loan amount (what was actually borrowed, indexation excluded). */
  principal: number
  /** CPI drift folded into the debt over the term (0 for a non-indexed mix). */
  indexation: number
  totalInterest: number
}

const SIZE = 170
const CENTER = SIZE / 2
const R_OUTER = 72
const R_INNER = 46
const GAP = 0.03

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
 * The "how much am I really paying the bank" companion: the split of total
 * repayments into קרן / הצמדה / ריבית over the full term, one small donut,
 * center showing the interest share, legend with the ₪ amounts - same numbers
 * the summary cards show. The indexation slice appears only when the mix has
 * an indexed track (indexation > 0).
 */
export function TotalCostDonut({ principal, indexation, totalInterest }: TotalCostDonutProps) {
  const { t } = useTranslation()
  const total = principal + indexation + totalInterest
  const segments = donutSegments([principal, indexation, totalInterest])
  const interestPercent = total > 0 ? Math.round((totalInterest / total) * 100) : 0

  return (
    <div className="cost-donut" data-testid="total-cost-donut">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t('calculator.charts.costAria')}
        direction="ltr"
      >
        {total === 0 && <circle cx={CENTER} cy={CENTER} r={(R_OUTER + R_INNER) / 2} className="donut-empty" />}
        {segments.map((segment, index) => {
          const insetStart = segment.startAngle + (segment.fraction > 0 ? GAP / 2 : 0)
          const insetEnd = segment.endAngle - (segment.fraction > 0 ? GAP / 2 : 0)
          if (insetEnd <= insetStart) return null
          return (
            <path
              key={index}
              d={arcPath(CENTER, CENTER, R_OUTER, R_INNER, insetStart, insetEnd)}
              fill={SLICE_COLORS[index]}
            />
          )
        })}
        <text x={CENTER} y={CENTER - 4} className="donut-center-label">
          {t('calculator.charts.costCenterLabel')}
        </text>
        <text x={CENTER} y={CENTER + 14} className="donut-center-value">
          {interestPercent}%
        </text>
      </svg>

      <ul className="cost-legend">
        <li className="cost-legend-item">
          <i className="chart-swatch" style={{ background: SLICE_COLORS[0] }} />
          <span>{t('calculator.schedule.principalHeader')}</span>
          <strong>{formatCurrency(principal)}</strong>
        </li>
        {indexation > 0 && (
          <li className="cost-legend-item">
            <i className="chart-swatch" style={{ background: SLICE_COLORS[1] }} />
            <span>{t('calculator.schedule.indexationHeader')}</span>
            <strong>{formatCurrency(indexation)}</strong>
          </li>
        )}
        <li className="cost-legend-item">
          <i className="chart-swatch" style={{ background: SLICE_COLORS[2] }} />
          <span>{t('calculator.schedule.interestHeader')}</span>
          <strong>{formatCurrency(totalInterest)}</strong>
        </li>
      </ul>
    </div>
  )
}
