import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatCurrency, formatRatio } from '@/lib/format'

/**
 * Four money cards plus the staged Step-2 additions — an average-rate card,
 * an average-payback card and the per-track payback breakdown — all fed from
 * the store snapshot, using the legacy .results-layout/.results-card markup.
 */
export function ResultsCards() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()

  return (
    <section aria-live="polite" data-testid="results-layout" className="results-layout">
      <div className="results-card primary-result">
        <p>{t('calculator.results.firstPaymentCard')}</p>
        <strong data-testid="monthly-payment">{vm.monthlyPayment}</strong>
        <span data-testid="payment-note">{vm.paymentNote}</span>
      </div>

      <div className="results-card">
        <p data-testid="highest-payment-label">{vm.highestLabelText}</p>
        <strong data-testid="highest-payment">{vm.highestPayment}</strong>
        <span>{t('calculator.results.highestCaption')}</span>
      </div>

      <div className="results-card">
        <p>{t('calculator.results.totalInterestCard')}</p>
        <strong data-testid="total-interest">{vm.totalInterest}</strong>
        <span>{t('calculator.results.interestCaption')}</span>
      </div>

      <div className="results-card">
        <p className="total-payment-label" data-testid="total-payment-label">
          <span className="total-payment-text">{vm.totalPaymentLabelParts}</span>
        </p>
        <strong data-testid="total-payment">{vm.totalPayment}</strong>
        <span>{t('calculator.results.totalPaymentCaption')}</span>
      </div>

      <div className="results-card">
        <p>{t('calculator.results.avgPaybackCard')}</p>
        <strong data-testid="avg-payback">{vm.avgPayback}</strong>
        <span>{t('calculator.results.avgPaybackCaption')}</span>
      </div>

      <div className="results-card">
        <p>{t('calculator.results.avgRateCard')}</p>
        <strong data-testid="avg-rate">
          {vm.avgRate}
          <span className="rate-unit">%</span>
        </strong>
        <span>
          {t('calculator.results.avgRateCaption', { weighted: vm.weightedAvgRate })}
        </span>
      </div>

      <div className="results-card">
        <p>{t('calculator.results.effRateCard')}</p>
        <strong data-testid="eff-rate">
          {vm.effectiveRate}
          <span className="rate-unit">%</span>
        </strong>
        <span>{t('calculator.results.effRateCaption', { nominal: vm.avgRate })}</span>
      </div>

      <div className="results-card">
        <p>{t('calculator.results.totalLoanCard')}</p>
        <strong data-testid="total-loan">{vm.totalLoanAmount}</strong>
        <span>{t('calculator.results.totalLoanCaption')}</span>
      </div>

      {vm.trackPaybacks.length > 0 && (
        <div className="track-paybacks" data-testid="track-paybacks">
          <p className="track-paybacks-title">{t('calculator.results.paybackPerTrackTitle')}</p>
          {vm.trackPaybacks.map((entry, index) => (
            <span
              key={index}
              className="track-payback"
              data-testid={`track-payback-${index + 1}`}
            >
              <strong className="track-payback-label">
                {t(`calculator.trackTypes.${entry.type}`)}
              </strong>
              {formatCurrency(entry.amount)} · {formatRatio(entry.paybackRatio)}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}