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
}: {
  rows: ScheduleTableRow[]
  testIdPrefix: string
}) {
  const { t } = useTranslation()
  if (rows.length === 0) return null

  return (
    <div className="payments-table-block" data-testid={testIdPrefix}>
      <h3 className="payments-table-title">{t('compare.scheduleTitle')}</h3>
      <div className="payments-table-scroll" data-testid={`${testIdPrefix}-scroll`}>
        <table className="payments-table">
          <caption className="sr-only">{t('compare.scheduleTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('calculator.schedule.yearHeader')}</th>
              <th scope="col">{t('calculator.charts.axisMonthlyPayment')}</th>
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
