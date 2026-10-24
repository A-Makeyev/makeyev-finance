'use client'

import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@/lib/format'

/**
 * Yearly payments table for one mix: one row per year with the average monthly
 * payment and how it splits into principal and interest, plus the remaining
 * balance. The scroll container hides its scrollbar (the content is scrollable
 * but the thumb never shows).
 */

export interface ScheduleTableRow {
  year: number
  paid: number
  principal: number
  interest: number
  closing: number
}

export function ScheduleTable({
  rows,
  testIdPrefix,
  label,
}: {
  rows: ScheduleTableRow[]
  testIdPrefix: string
  /** The mix this table belongs to, so its scroll region has a unique name. */
  label?: string
}) {
  const { t } = useTranslation()
  if (rows.length === 0) return null

  return (
    <div className="payments-table-block" data-testid={testIdPrefix}>
      <h3 className="payments-table-title">{t('compare.scheduleTitle')}</h3>
      {/* The bar is hidden, so the scroller is a focusable region: Tab reaches
          it and the keyboard scrolls the rows. */}
      <div
        className="payments-table-scroll"
        role="region"
        aria-label={label ? `${label} · ${t('compare.scheduleTitle')}` : t('compare.scheduleTitle')}
        tabIndex={0}
        data-testid={`${testIdPrefix}-scroll`}
      >
        <table className="payments-table">
          <caption className="sr-only">{t('compare.scheduleTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('calculator.schedule.yearHeader')}</th>
              <th scope="col">{t('calculator.schedule.paymentHeader')}</th>
              <th scope="col">{t('calculator.schedule.principalHeader')}</th>
              <th scope="col">{t('calculator.schedule.interestHeader')}</th>
              <th scope="col">{t('calculator.schedule.balanceHeader')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <th scope="row">{row.year}</th>
                <td>{formatCurrency(row.paid / 12)}</td>
                <td>{formatCurrency(row.principal)}</td>
                <td>{formatCurrency(row.interest)}</td>
                <td>{formatCurrency(row.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
