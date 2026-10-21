import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, formatRatePercent } from '@/lib/format'
import {
  buildForecast,
  FORECAST_STEP_PERCENT,
  type ForecastScenarioId,
} from '@/lib/forecast'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatAxisShekelDetailed } from '@/lib/charts'
import { ForecastChart, type ForecastSeries } from './ForecastChart'

/** One color per scenario / cost line, reusing the chart palette tokens. */
const SCENARIO_COLORS: Record<ForecastScenarioId, string> = {
  base: 'var(--chart-balance, #111111)',
  up: 'var(--chart-interest, #d2762e)',
  down: 'var(--chart-principal, #0aa89f)',
}
const INTEREST_COLOR = 'var(--chart-interest, #d2762e)'
const INDEXATION_COLOR = 'var(--cost-donut-indexation, #7b5cc4)'

/**
 * Rate-reset and CPI forecast panel. Two forward assumptions are stated in
 * the panel itself, never hidden:
 * - a contractual five-year reset moves the rate by `FORECAST_STEP_PERCENT`
 *   points in each direction, cumulatively;
 * - the CPI runs flat at the same annual change the schedule already uses.
 *
 * The reset chart plots the combined payment at the start of each year under
 * the base, +1pp and -1pp paths; the cost chart plots the base path's
 * cumulative interest against cumulative indexation. Both charts have a
 * `<details>` table with the exact figures.
 *
 * A mix with neither a contractual reset nor an indexed track has nothing
 * forward-looking to add (its schedule is already fully deterministic), so
 * the panel stays out of the page rather than showing a flat duplicate.
 */
export function ForecastSection() {
  const { t, i18n } = useTranslation()
  const vm = useCalculatorViewModel()
  const tracks = vm.snapshot.scheduleTracks
  const annualInflation = vm.snapshot.annualInflation

  const forecast = useMemo(
    () =>
      buildForecast(
        tracks.map((track) => ({
          principal: track.amount,
          years: track.years,
          annualRatePercent: track.annualRatePercent,
          type: track.type,
          method: track.method,
        })),
        annualInflation,
      ),
    [tracks, annualInflation],
  )

  if (!forecast.hasResetTracks && !forecast.hasIndexation) return null
  const base = forecast.scenarios[0]
  if (base.points.length === 0) return null

  const cpiText = formatRatePercent(annualInflation * 100)
  const step = FORECAST_STEP_PERCENT
  // Locale-aware conjunction ("6 and 11" / "6 ו-11"). A bare comma list
  // reverses visually in RTL, so the years would read out of order.
  const resetYearsText = new Intl.ListFormat(i18n.language, {
    style: 'long',
    type: 'conjunction',
  }).format(forecast.resetYears.map(String))

  const scenarioLabels: Record<ForecastScenarioId, string> = {
    base: t('calculator.forecast.scenarios.base'),
    up: t('calculator.forecast.scenarios.up', { step }),
    down: t('calculator.forecast.scenarios.down', { step }),
  }
  const scenarioSeries: ForecastSeries[] = forecast.scenarios.map((scenario) => ({
    id: scenario.id,
    label: scenarioLabels[scenario.id],
    color: SCENARIO_COLORS[scenario.id],
    step: true,
    points: scenario.points.map((point) => ({ year: point.year, value: point.payment })),
  }))

  const costSeries: ForecastSeries[] = [
    {
      id: 'interest',
      label: t('calculator.forecast.series.interest'),
      color: INTEREST_COLOR,
      points: base.points.map((point) => ({
        year: point.year,
        value: point.cumulativeInterest,
      })),
    },
  ]
  if (forecast.hasIndexation) {
    costSeries.push({
      id: 'indexation',
      label: t('calculator.forecast.series.indexation'),
      color: INDEXATION_COLOR,
      points: base.points.map((point) => ({
        year: point.year,
        value: point.cumulativeIndexation,
      })),
    })
  }

  return (
    <section className="schedule-section forecast-section" data-testid="forecast-section">
      <div className="section-heading">
        <div>
          <h2>{t('calculator.forecast.heading')}</h2>
        </div>
        <p className="forecast-lead">{t('calculator.forecast.lead', { step, cpi: cpiText })}</p>
      </div>

      <div className="forecast-grid">
        <article className="forecast-card">
          <h3>{t('calculator.forecast.resetHeading')}</h3>
          <p className="forecast-card-lead">{t('calculator.forecast.resetLead')}</p>

          {forecast.hasResetTracks ? (
            <>
              <ForecastChart
                series={scenarioSeries}
                ariaLabel={t('calculator.forecast.chartResetAria')}
                axisTitle={t('calculator.forecast.axisPayment')}
                markers={forecast.resetYears}
                zeroBased={false}
                formatTick={formatAxisShekelDetailed}
                testId="forecast-reset-chart"
              />
              <p className="forecast-caption" data-testid="forecast-reset-caption">
                {t('calculator.forecast.resetYears', { years: resetYearsText })}
              </p>
            </>
          ) : (
            <p className="forecast-empty" data-testid="forecast-no-reset">
              {t('calculator.forecast.noReset')}
            </p>
          )}

          {forecast.hasResetTracks && (
            <details className="forecast-table-details" data-testid="forecast-reset-table">
              <summary>{t('calculator.forecast.tableSummary')}</summary>
              <div className="table-wrap">
                <table
                  className="forecast-table"
                  aria-label={t('calculator.forecast.resetTableAria')}
                >
                  <thead>
                    <tr>
                      <th>{t('calculator.forecast.tableYear')}</th>
                      {forecast.scenarios.map((scenario) => (
                        <th key={scenario.id}>{scenarioLabels[scenario.id]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {base.points.map((point) => (
                      <tr
                        key={point.year}
                        className={
                          forecast.resetYears.includes(point.year) ? 'is-reset' : undefined
                        }
                      >
                        <th scope="row">{point.year}</th>
                        {forecast.scenarios.map((scenario) => (
                          <td key={scenario.id}>
                            {formatCurrency(
                              scenario.points.find((entry) => entry.year === point.year)?.payment ??
                                0,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </article>

        <article className="forecast-card">
          <h3>{t('calculator.forecast.costHeading')}</h3>
          <p className="forecast-card-lead">
            {t('calculator.forecast.costLead', { cpi: cpiText })}
          </p>

          <ForecastChart
            series={costSeries}
            ariaLabel={t('calculator.forecast.chartCostAria')}
            axisTitle={t('calculator.forecast.axisCumulative')}
            testId="forecast-cost-chart"
          />
          {!forecast.hasIndexation && (
            <p className="forecast-caption" data-testid="forecast-no-indexation">
              {t('calculator.forecast.noIndexation')}
            </p>
          )}

          <details className="forecast-table-details" data-testid="forecast-cost-table">
            <summary>{t('calculator.forecast.tableSummary')}</summary>
            <div className="table-wrap">
              <table
                className="forecast-table"
                aria-label={t('calculator.forecast.costTableAria')}
              >
                <thead>
                  <tr>
                    <th>{t('calculator.forecast.tableYear')}</th>
                    <th>{t('calculator.forecast.tableInterest')}</th>
                    {forecast.hasIndexation && (
                      <th>{t('calculator.forecast.tableIndexation')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {base.points.map((point) => (
                    <tr key={point.year}>
                      <th scope="row">{point.year}</th>
                      <td>{formatCurrency(point.cumulativeInterest)}</td>
                      {forecast.hasIndexation && (
                        <td>{formatCurrency(point.cumulativeIndexation)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </article>
      </div>

      <p className="prepayment-note-line forecast-disclaimer">
        {t('calculator.forecast.disclaimer')}
      </p>
    </section>
  )
}
