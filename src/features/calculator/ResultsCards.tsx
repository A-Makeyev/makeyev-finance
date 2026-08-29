import { useTranslation } from 'react-i18next'
import { useCalculatorViewModel } from './useCalculatorViewModel'

/** Four result cards — legacy .results-layout/.results-card markup. */
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
    </section>
  )
}
