import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatCurrency, formatRatio } from '@/lib/format'

type ScheduleView = 'total' | 'separate'
type ScheduleGranularity = 'monthly' | 'yearly'

/**
 * Amortization schedule - legacy .schedule-section markup and classes. Shows
 * either the combined "total" table (all tracks together) or one table per
 * track with a payback-ratio column, toggled via a segmented control. A
 * second segmented control switches the tables between yearly and monthly
 * rows; the aside column summarizes the first, middle and last annual
 * payments of the term.
 */
export function ScheduleSection() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()
  const [view, setView] = useState<ScheduleView>('total')
  const [granularity, setGranularity] = useState<ScheduleGranularity>('yearly')

  const viewButtons: Array<{ id: ScheduleView; label: string }> = [
    { id: 'total', label: t('calculator.schedule.viewTotal') },
    { id: 'separate', label: t('calculator.schedule.viewSeparate') },
  ]

  const granularityButtons: Array<{ id: ScheduleGranularity; label: string }> = [
    { id: 'yearly', label: t('calculator.schedule.granularityYearly') },
    { id: 'monthly', label: t('calculator.schedule.granularityMonthly') },
  ]

  // "year · month (total month)" - e.g. "1 · 12 (12)" or "2 · 1 (13)": the
  // parentheses hold the running month count of the loan (1-12 in year 1,
  // 13-24 in year 2, ... up to years*12).
  const monthLabel = (year: number, month: number): string => `${year} · ${month}`
  const totalMonth = (year: number, month: number): number => (year - 1) * 12 + month
  // With no loan entered there are no rows to render - hide the header-only
  // table and show the empty note instead (same as the per-track view).
  const hasTotalRows =
    granularity === 'monthly' ? vm.visibleMonthlyRows.length > 0 : vm.visibleScheduleRows.length > 0

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

      <div
        className="schedule-view-toggle"
        role="group"
        aria-label={t('calculator.schedule.viewToggleAria')}
      >
        {viewButtons.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-testid={`schedule-view-${id}`}
            aria-pressed={view === id}
            className={`schedule-view-button${view === id ? ' active' : ''}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="schedule-granularity-toggle"
        role="group"
        aria-label={t('calculator.schedule.granularityToggleAria')}
      >
        {granularityButtons.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-testid={`schedule-granularity-${id}`}
            aria-pressed={granularity === id}
            className={`schedule-view-button${granularity === id ? ' active' : ''}`}
            onClick={() => setGranularity(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="schedule-content">
        {view === 'total' ? (
          hasTotalRows ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      {granularity === 'monthly'
                        ? t('calculator.schedule.monthHeader')
                        : t('calculator.schedule.yearHeader')}
                    </th>
                    {granularity === 'monthly' && (
                      <th>{t('calculator.schedule.monthTotalHeader')}</th>
                    )}
                    <th>{t('calculator.schedule.principalHeader')}</th>
                    <th>{t('calculator.schedule.interestHeader')}</th>
                    {granularity === 'yearly' && (
                      <th>{t('calculator.schedule.annualPaymentHeader')}</th>
                    )}
                    <th>{t('calculator.schedule.balanceHeader')}</th>
                  </tr>
                </thead>
                <tbody id="schedule-body" data-testid="schedule-body">
                  {granularity === 'monthly'
                    ? vm.visibleMonthlyRows.map((row) => (
                        <tr key={`${row.year}-${row.month}`}>
                          <td data-testid={`schedule-year-${row.year}-month-${row.month}`}>
                            {monthLabel(row.year, row.month)}
                          </td>
                          <td>{totalMonth(row.year, row.month)}</td>
                          <td>{formatCurrency(row.principal)}</td>
                          <td>{formatCurrency(row.interest)}</td>
                          <td>{formatCurrency(row.closing)}</td>
                        </tr>
                      ))
                    : vm.visibleScheduleRows.map((row) => (
                        <tr key={row.year}>
                          <td data-testid={`schedule-year-${row.year}`}>{row.year}</td>
                          <td>{formatCurrency(row.principal)}</td>
                          <td>{formatCurrency(row.interest)}</td>
                          <td>{formatCurrency(row.paid)}</td>
                          <td>{formatCurrency(row.closing)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="schedule-empty">{t('calculator.emptyNote')}</p>
          )
        ) : (
          <div className="schedule-tracks">
            {vm.visibleScheduleTracks.length === 0 && (
              <p className="schedule-empty">{t('calculator.emptyNote')}</p>
            )}
            {vm.visibleScheduleTracks.map((track, index) => (
              <section className="schedule-track" key={`${index}-${track.type}`}>
                <h3 className="schedule-track-heading">
                  {t(`calculator.trackTypes.${track.type}`)} · {formatCurrency(track.amount)}
                  <span className="schedule-track-heading-ratio">
                    {' '}
                    · {t('calculator.schedule.paybackRatioLabel')}{' '}
                    {formatRatio(track.rows[0]?.paybackRatio)}
                  </span>
                </h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {granularity === 'monthly'
                            ? t('calculator.schedule.monthHeader')
                            : t('calculator.schedule.yearHeader')}
                        </th>
                        {granularity === 'monthly' && <th>{t('calculator.schedule.monthTotalHeader')}</th>}
                        <th>{t('calculator.schedule.principalHeader')}</th>
                        <th>{t('calculator.schedule.interestHeader')}</th>
                        {granularity === 'yearly' && (
                          <th>{t('calculator.schedule.annualPaymentHeader')}</th>
                        )}
                        <th>{t('calculator.schedule.balanceHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {granularity === 'monthly'
                        ? track.monthlyRows.map((row) => (
                            <tr key={`${row.year}-${row.month}`}>
                              <td data-testid={`schedule-year-${row.year}-month-${row.month}`}>
                                {monthLabel(row.year, row.month)}
                              </td>
                              <td>{totalMonth(row.year, row.month)}</td>
                              <td>{formatCurrency(row.principal)}</td>
                              <td>{formatCurrency(row.interest)}</td>
                              <td>{formatCurrency(row.closing)}</td>
                            </tr>
                          ))
                        : track.rows.map((row) => (
                            <tr key={row.year}>
                              <td data-testid={`schedule-year-${row.year}`}>{row.year}</td>
                              <td>{formatCurrency(row.principal)}</td>
                              <td>{formatCurrency(row.interest)}</td>
                              <td>{formatCurrency(row.paid)}</td>
                              <td>{formatCurrency(row.balance)}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="schedule-asides">
          <p className="schedule-asides-title">{t('calculator.results.paybackPerTrackTitle')}</p>
          {vm.trackPaybacks.length === 0 && (
            <aside className="schedule-aside">
              <span>{t('calculator.emptyNote')}</span>
            </aside>
          )}
          {vm.trackPaybacks.map((entry, index) => (
            <aside className="schedule-aside schedule-aside-payback" key={`${index}-${entry.type}`}>
              <strong>{t(`calculator.trackTypes.${entry.type}`)}</strong>
              <span>
                {formatCurrency(entry.amount)} · {formatRatio(entry.paybackRatio)}
              </span>
            </aside>
          ))}
        </div>
      </div>

      <p className="legal-note">
        <a
          href={t('calculator.legalNoteLinkUrl')}
          target="_blank"
          rel="noreferrer"
          data-testid="legal-note-link"
        >
          {t('calculator.legalNoteLink')}
        </a>
        <br />
        {t('calculator.disclaimer')}
        <br />
        {t('calculator.legalNotePart1')}
        <br />
        {t('calculator.legalNoteRisk')}
      </p>
    </section>
  )
}