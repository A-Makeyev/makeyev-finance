import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'
import { formatCurrency, formatRatio } from '@/lib/format'

/**
 * Results grid, ordered left-to-right in three logical rows of five:
 * 1. The monthly payment story - today's payment (first, highest/current,
 *    average) and its sensitivity to variable-rate moves (±1 point).
 * 2. The full-term cost - total repayments, interest, cost-of-credit %,
 *    payback ratio and the average rate behind them.
 * 3. Planning details - effective rate, annuity interest mechanics,
 *    5-year horizon figures and the normalized per-₪100k payment.
 * Inside every card the big number comes first, with its label and caption
 * below it - a single-line value top-aligns across all cards naturally.
 */
export function ResultsCards() {
  const { t } = useTranslation()
  const vm = useCalculatorViewModel()

  return (
    <section aria-live="polite" data-testid="results-layout" className="results-layout">
      {/* Row 1 - the monthly payment and its rate sensitivity. */}
      <div className="results-card primary-result">
        <strong data-testid="monthly-payment">{vm.monthlyPayment}</strong>
        <p>{t('calculator.results.firstPaymentCard')}</p>
        <span data-testid="payment-note">{vm.paymentNote}</span>
      </div>

      <div className="results-card">
        <strong data-testid="highest-payment">{vm.highestPayment}</strong>
        <p data-testid="highest-payment-label">{vm.highestLabelText}</p>
        <span>{t('calculator.results.highestCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="avg-monthly-payment">{vm.avgMonthlyPayment}</strong>
        <p>{t('calculator.results.avgPaymentCard')}</p>
        <span>{t('calculator.results.avgPaymentCaption')}</span>
      </div>

      {/* Rate-shock cards: with variable exposure show the stressed payment
          and delta; a fixed-only mix keeps its payment, so say so instead. */}
      <div className="results-card">
        <strong data-testid="payment-rate-up">{vm.paymentRateUp1}</strong>
        <p>{t('calculator.results.rateUpCard')}</p>
        <span data-testid="payment-rate-up-note">
          {vm.hasVariableTrack
            ? t('calculator.results.rateUpCaption', { delta: vm.paymentRateUp1Delta })
            : t('calculator.results.rateUpCaptionFixed')}
        </span>
      </div>

      <div className="results-card">
        <strong data-testid="payment-rate-down">{vm.paymentRateDown1}</strong>
        <p>{t('calculator.results.rateDownCard')}</p>
        <span data-testid="payment-rate-down-note">
          {vm.hasVariableTrack
            ? t('calculator.results.rateDownCaption', { delta: vm.paymentRateDown1Delta })
            : t('calculator.results.rateDownCaptionFixed')}
        </span>
      </div>

      {/* Row 2 - the full-term cost of the loan. */}
      <div className="results-card">
        <strong data-testid="total-payment">{vm.totalPayment}</strong>
        <p className="total-payment-label" data-testid="total-payment-label">
          <span className="total-payment-text">{vm.totalPaymentLabelParts}</span>
        </p>
        <span>{t('calculator.results.totalPaymentCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="total-interest">{vm.totalInterest}</strong>
        <p>{t('calculator.results.totalInterestCard')}</p>
        <span>{t('calculator.results.interestCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="overpay-percent">
          {vm.overpayPercent}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.overpayCard')}</p>
        <span>{t('calculator.results.overpayCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="avg-payback">{vm.avgPayback}</strong>
        <p>{t('calculator.results.avgPaybackCard')}</p>
        <span>{t('calculator.results.avgPaybackCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="avg-rate">
          {vm.avgRate}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.avgRateCard')}</p>
        <span>{t('calculator.results.avgRateCaption', { weighted: vm.weightedAvgRate })}</span>
      </div>

      {/* Row 3 - planning details and the 5-year horizon. */}
      <div className="results-card">
        <strong data-testid="eff-rate">
          {vm.effectiveRate}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.effRateCard')}</p>
        <span>{t('calculator.results.effRateCaption', { nominal: vm.avgRate })}</span>
      </div>

      <div className="results-card">
        <strong data-testid="interest-share">
          {vm.firstPaymentInterestShare}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.interestShareCard')}</p>
        <span>{t('calculator.results.interestShareCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="first5y-interest-share">
          {vm.first5yInterestShare}
          <span className="rate-unit">%</span>
        </strong>
        <p>{t('calculator.results.fiveYInterestCard')}</p>
        <span>{t('calculator.results.fiveYInterestCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="balance-after-5y">{vm.balanceAfter5y}</strong>
        <p>{t('calculator.results.balance5yCard')}</p>
        <span>{t('calculator.results.balance5yCaption')}</span>
      </div>

      <div className="results-card">
        <strong data-testid="payment-per-100k">{vm.paymentPer100k}</strong>
        <p>{t('calculator.results.per100kCard')}</p>
        <span>{t('calculator.results.per100kCaption')}</span>
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
