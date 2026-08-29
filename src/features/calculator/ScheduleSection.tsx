import { useTranslation } from 'react-i18next'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatCurrency } from '@/lib/format'

/** Amortization schedule — legacy .schedule-section markup and classes. */
export function ScheduleSection() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()
  const toggleScheduleExpanded = useCalculatorStore((s) => s.toggleScheduleExpanded)

  return (
    <section className="schedule-section">
      <div className="section-heading">
        <div>
          <h2>{t('calculator.schedule.heading')}</h2>
        </div>
        <p id="schedule-summary" data-testid="schedule-summary">
          {vm.summaryText}
        </p>
      </div>

      <div className="schedule-content">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('calculator.schedule.yearHeader')}</th>
                <th>{t('calculator.schedule.principalHeader')}</th>
                <th>{t('calculator.schedule.interestHeader')}</th>
                <th>{t('calculator.schedule.balanceHeader')}</th>
              </tr>
            </thead>
            <tbody id="schedule-body" data-testid="schedule-body">
              {vm.visibleScheduleRows.map((row) => (
                <tr key={row.year}>
                  <td data-testid={`schedule-year-${row.year}`}>{row.year}</td>
                  <td>{formatCurrency(row.principal)}</td>
                  <td>{formatCurrency(row.interest)}</td>
                  <td>{formatCurrency(row.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="schedule-aside">
          <p>{t('calculator.schedule.asideTitle')}</p>
          <strong id="annual-payment" data-testid="annual-payment">
            {vm.annualFirstYearPayment}
          </strong>
          <span>{t('calculator.schedule.asideCaption')}</span>
        </aside>
      </div>

      {vm.showExpandButton && (
        <button
          type="button"
          id="expand-schedule"
          data-testid="expand-schedule"
          className="expand-schedule-button"
          onClick={toggleScheduleExpanded}
        >
          {vm.expandLabel}
        </button>
      )}

      <p className="disclaimer">{t('calculator.disclaimer')}</p>

      <p className="legal-note">
        {t('calculator.legalNote')}
        <br />
        {t('calculator.legalNoteRisk')}
      </p>
    </section>
  )
}
