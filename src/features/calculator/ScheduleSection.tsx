import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatCurrency, formatRatePercent, formatRatio, parseAmountText } from '@/lib/format'
import { AmortizationChart } from './AmortizationChart'
import { PerTrackChart } from './PerTrackChart'
import { TrackMixDonut, type TrackShare } from './TrackMixDonut'
import { TotalCostDonut } from './TotalCostDonut'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { useMediaQuery } from '@/hooks/useScrolled'

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

  // "year · month" - e.g. "1 · 12" or "2 · 1": the year of the loan and the
  // month within it.
  const monthLabel = (year: number, month: number): string => `${year} · ${month}`
  // With no loan entered there are no rows to render - hide the header-only
  // table and show the empty note instead (same as the per-track view).
  const hasTotalRows =
    granularity === 'monthly' ? vm.visibleMonthlyRows.length > 0 : vm.visibleScheduleRows.length > 0

  // Chart rows come from the exact same arrays the table renders - one
  // source of truth; switching the tabs re-feeds both together. The balance
  // series needs a per-period absolute value: the yearly table's closing
  // balance is per row; the monthly rows carry it too. Payment = principal
  // + interest by definition.
  const chartRows =
    granularity === 'monthly'
      ? vm.visibleMonthlyRows.map((row) => ({
          period: (row.year - 1) * 12 + row.month,
          principal: row.principal,
          indexation: row.indexation,
          interest: row.interest,
          balance: row.closing,
          payment: row.paid,
        }))
      : vm.visibleScheduleRows.map((row) => ({
          period: row.year,
          principal: row.principal,
          indexation: row.indexation,
          interest: row.interest,
          balance: row.closing,
          payment: row.paid,
        }))
  const periodLabel = (period: number) =>
    granularity === 'monthly'
      ? t('calculator.charts.monthLabel', { month: period })
      : t('calculator.charts.yearLabel', { year: period })

  // Live track shares for the mix donut - parsed straight from the store's
  // track state (same amounts the cards show), one slice per track.
  const tracks = useCalculatorStore((s) => s.tracks)
  const mixShares: TrackShare[] = tracks.map((track) => ({
    trackId: track.id,
    type: track.type,
    amount: Math.max(0, parseAmountText(track.amountText)),
  }))

  // Matches the CSS breakpoint that stacks the chart band and gives the
  // tables the full panel width. On a narrow panel the cost donut moves out
  // of the asides column and into the band beside the mix donut, so the two
  // rings sit together above the tables instead of the cost split sitting
  // alone beneath them.
  const narrowLayout = useMediaQuery('(max-width: 1000px)')

  // Total repaid = nominal principal + indexation + interest, so the nominal
  // principal is totalPaid minus the other two (exact, not a rounding of the
  // loan: the principal column telescopes to nominal + indexation over the
  // term).
  const costDonut = (
    <TotalCostDonut
      principal={
        vm.snapshot.totals.totalPaid -
        vm.snapshot.totals.totalInterest -
        vm.snapshot.totals.totalIndexation
      }
      indexation={vm.snapshot.totals.totalIndexation}
      totalInterest={vm.snapshot.totals.totalInterest}
    />
  )
  // Side by side with the cost donut, the mix ring switches to the cost
  // donut's 170-unit canvas so one set of font sizes renders identically in
  // both. The media query starts false and flips after mount, so the server
  // and the first client render agree (no hydration mismatch).
  const mixDonut = mixShares.some((share) => share.amount > 0) ? (
    <TrackMixDonut
      shares={mixShares}
      size={narrowLayout ? 170 : undefined}
      className="schedule-mix-donut"
    />
  ) : null
  // The band only exists while there is a chart to show. Without one there is
  // nothing to pair the cost donut with, so it stays in the asides.
  const hasChartBand =
    view === 'total'
      ? hasTotalRows && chartRows.length > 0
      : vm.visibleScheduleTracks.length > 0
  const donutInBand = narrowLayout && hasChartBand

  // The cost legend mirrors the mix legend's width so both chip columns sit on
  // one vertical line. The mix legend is sized by its own text (max-content),
  // so measure it and hand the same width to the cost legend. A plain
  // measurement on mount went stale when the Google webfont swapped in: the
  // mix legend shrank but the cost legend kept the fallback-width box, and the
  // two square columns drifted apart by a few pixels. ResizeObserver re-syncs
  // whenever the legend's box changes, and running the effect on every render
  // also catches the band appearing or a track label changing.
  const sectionRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const sync = () => {
      const legend = section.querySelector<HTMLElement>('.schedule-chart-band .mix-legend')
      if (!legend) {
        section.style.removeProperty('--schedule-legend-width')
        return
      }
      section.style.setProperty('--schedule-legend-width', `${legend.getBoundingClientRect().width}px`)
    }
    sync()
    const legend = section.querySelector<HTMLElement>('.schedule-chart-band .mix-legend')
    if (!legend) return
    const observer = new ResizeObserver(sync)
    observer.observe(legend)
    return () => observer.disconnect()
  })

  return (
    <section className="schedule-section" ref={sectionRef}>
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

      {/* Chart band: the mix donut sits on one side with the view's chart on
          the other, so both are full-size and read as one panel. Shared by
          both views, so the donut stays put when switching tabs. */}
      {view === 'total' && hasTotalRows && chartRows.length > 0 && (
        <div className="schedule-chart-band">
          <div className="schedule-donut-pair">
            {donutInBand && costDonut}
            {mixDonut}
          </div>
          <AmortizationChart rows={chartRows} periodLabel={periodLabel} monthly={granularity === 'monthly'} />
        </div>
      )}

      {view === 'separate' && vm.visibleScheduleTracks.length > 0 && (
        <div className="schedule-chart-band">
          <div className="schedule-donut-pair">
            {donutInBand && costDonut}
            {mixDonut}
          </div>
          {/* Same granularity as the per-track tables below it: one point per
              month when the monthly tab is on, matching the total view. */}
          <PerTrackChart tracks={vm.visibleScheduleTracks} monthly={granularity === 'monthly'} />
        </div>
      )}

      <div className="schedule-content">
        {view === 'total' ? (
          hasTotalRows ? (
            /* The per-track view puts a track heading above each table. The
               combined view has no heading of its own, but reserves the same
               slot invisibly so switching views leaves the table below at the
               exact same height instead of jumping. */
            <div className="schedule-total-table">
              <h3
                className="schedule-track-heading schedule-total-heading"
                aria-hidden="true"
              >
                &nbsp;
              </h3>
              {/* The scrollbar is hidden, so the scroller is a focusable region:
                  Tab reaches it and the keyboard scrolls it. */}
              <div
                className="table-wrap"
                role="region"
                aria-label={t('calculator.schedule.heading')}
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>
                        {granularity === 'monthly'
                          ? t('calculator.schedule.monthHeader')
                          : t('calculator.schedule.yearHeader')}
                      </th>
                      {granularity === 'monthly' && (
                        <th>{t('calculator.schedule.monthPaymentHeader')}</th>
                      )}
                      <th>{t('calculator.schedule.principalHeader')}</th>
                      {vm.hasIndexation && <th>{t('calculator.schedule.indexationHeader')}</th>}
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
                            <td>{formatCurrency(row.paid)}</td>
                            <td>{formatCurrency(row.principal)}</td>
                            {vm.hasIndexation && <td>{formatCurrency(row.indexation)}</td>}
                            <td>{formatCurrency(row.interest)}</td>
                            <td>{formatCurrency(row.closing)}</td>
                          </tr>
                        ))
                      : vm.visibleScheduleRows.map((row) => (
                          <tr key={row.year}>
                            <td data-testid={`schedule-year-${row.year}`}>{row.year}</td>
                            <td>{formatCurrency(row.principal)}</td>
                            {vm.hasIndexation && <td>{formatCurrency(row.indexation)}</td>}
                            <td>{formatCurrency(row.interest)}</td>
                            <td>{formatCurrency(row.paid)}</td>
                            <td>{formatCurrency(row.closing)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
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
                  {/* No rows, no ratio: formatRatio would print a misleading
                      "0" (reads as payback-for-free) for an empty track. */}
                  {track.rows[0] && (
                    <span className="schedule-track-heading-ratio">
                      {' '}
                      · {t('calculator.schedule.paybackRatioLabel')}{' '}
                      {formatRatio(track.rows[0].paybackRatio)}
                    </span>
                  )}
                </h3>
                <div
                  className="table-wrap"
                  role="region"
                  aria-label={t('calculator.schedule.trackTableAria', {
                    track: t(`calculator.trackTypes.${track.type}`),
                  })}
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {granularity === 'monthly'
                            ? t('calculator.schedule.monthHeader')
                            : t('calculator.schedule.yearHeader')}
                        </th>
                        {granularity === 'monthly' && <th>{t('calculator.schedule.monthPaymentHeader')}</th>}
                        <th>{t('calculator.schedule.principalHeader')}</th>
                        {vm.hasIndexation && <th>{t('calculator.schedule.indexationHeader')}</th>}
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
                              <td>{formatCurrency(row.paid)}</td>
                              <td>{formatCurrency(row.principal)}</td>
                              {vm.hasIndexation && <td>{formatCurrency(row.indexation)}</td>}
                              <td>{formatCurrency(row.interest)}</td>
                              <td>{formatCurrency(row.closing)}</td>
                            </tr>
                          ))
                        : track.rows.map((row) => (
                            <tr key={row.year}>
                              <td data-testid={`schedule-year-${row.year}`}>{row.year}</td>
                              <td>{formatCurrency(row.principal)}</td>
                              {vm.hasIndexation && <td>{formatCurrency(row.indexation)}</td>}
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
          {!donutInBand && costDonut}
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
              {entry.marketMarginPercent !== null && (
                <span data-testid={`track-market-margin-${index + 1}`}>
                  {t('calculator.results.marketMarginLine', {
                    percent: formatRatePercent(entry.marketMarginPercent),
                  })}
                </span>
              )}
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