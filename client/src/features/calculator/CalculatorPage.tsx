import { Fragment, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { fetchPrimeRatePercent } from '@/services/boi'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { MAX_TRACKS, MAX_YEARS, type PropertyPurpose } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { TermSlider } from '@/components/ui/TermSlider'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { PresetSelector } from './PresetSelector'
import { TrackForm } from './TrackForm'
import { ResultsCards } from './ResultsCards'
import { ScheduleSection } from './ScheduleSection'
import { useCalculatorViewModel } from './useCalculatorViewModel'

/**
 * Mortgage calculator page — full port of calculators.html + calculator.js;
 * markup/classes mirror the legacy DOM (calculator-shell / calculator-panel /
 * starting-point / limits-row …) so the verbatim CSS applies unchanged.
 */
export function CalculatorPage() {
  const { t } = useTranslation()
  const resultsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.title = t('meta.calculatorsTitle')
  }, [t])

  const store = {
    startingAmountText: useCalculatorStore((s) => s.startingAmountText),
    startingNoNeed: useCalculatorStore((s) => s.startingNoNeed),
    termYears: useCalculatorStore((s) => s.termYears),
    propertyValueText: useCalculatorStore((s) => s.propertyValueText),
    capitalText: useCalculatorStore((s) => s.capitalText),
    incomeText: useCalculatorStore((s) => s.incomeText),
    tracks: useCalculatorStore((s) => s.tracks),
    error: useCalculatorStore((s) => s.error),
    purpose: useCalculatorStore((s) => s.purpose),
    setStartingAmount: useCalculatorStore((s) => s.setStartingAmount),
    setTermYears: useCalculatorStore((s) => s.setTermYears),
    setPropertyValue: useCalculatorStore((s) => s.setPropertyValue),
    setCapital: useCalculatorStore((s) => s.setCapital),
    setIncome: useCalculatorStore((s) => s.setIncome),
    setPropertyBlur: useCalculatorStore((s) => s.setPropertyBlur),
    setCapitalBlur: useCalculatorStore((s) => s.setCapitalBlur),
    setIncomeBlur: useCalculatorStore((s) => s.setIncomeBlur),
    setPurpose: useCalculatorStore((s) => s.setPurpose),
    addTrack: useCalculatorStore((s) => s.addTrack),
    reset: useCalculatorStore((s) => s.reset),
    autofixMix: useCalculatorStore((s) => s.autofixMix),
    submit: useCalculatorStore((s) => s.submit),
    applyPrimeRate: useCalculatorStore((s) => s.applyPrimeRate),
  }

  const vm = useCalculatorViewModel()

  // Live Bank of Israel prime rate — silent failure preserved (legacy .catch(() => {})).
  const primeQuery = useQuery({
    queryKey: ['boi', 'prime'],
    queryFn: ({ signal }) => fetchPrimeRatePercent(signal),
    retry: false,
    staleTime: 15 * 60 * 1000,
  })
  useEffect(() => {
    if (primeQuery.data) store.applyPrimeRate(primeQuery.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeQuery.data])

  const loanInputDisabled = Number(store.propertyValueText.replace(/[,\s]/g, '')) > 0

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    store.submit()
    if (!useCalculatorStore.getState().error) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <>
      <section className="sub-header">
        <div className="text-box main-heading">
          <h1 className="gradient-text-no-hover">{t('nav.calculators')}</h1>
        </div>
      </section>

      <main className="calculator-shell">
        <section className="calculator-panel" aria-label={t('nav.calculators')}>
          <div className="panel-heading">
            <div>
              <h2>{t('calculator.panelHeading')}</h2>
            </div>
            <button
              id="reset-calculator"
              data-testid="reset-calculator"
              className="reset-button"
              type="button"
              onClick={() => store.reset()}
            >
              {t('calculator.reset')}
            </button>
          </div>

          <form id="mortgage-form" noValidate onSubmit={handleSubmit}>
            <div className="starting-point">
              <label className="starting-amount">
                {t('calculator.startingAmountLabel')}
                <MoneyInput
                  value={store.startingNoNeed ? t('calculator.noNeed') : store.startingAmountText}
                  onChange={(raw, caret) => store.setStartingAmount(raw, caret)}
                  disabled={loanInputDisabled}
                  suffix="₪"
                  ariaLabel={t('calculator.startingAmountLabel')}
                  testId="starting-amount"
                />
              </label>

              <label className="term-slider">
                {t('calculator.termLabel')}
                <TermSlider
                  min={1}
                  max={MAX_YEARS}
                  value={store.termYears}
                  onValueChange={(value) => store.setTermYears(value)}
                  labelLow="1"
                  labelHigh={String(MAX_YEARS)}
                  ariaLabel={t('calculator.termLabel')}
                  testId="term-years"
                />
              </label>

              <button className="calculate-button starting-calculate-button" type="submit" data-testid="show-payments">
                <span>{t('calculator.showPayments')}</span>
              </button>
            </div>

            <div className="limits-row">
              <label className="input-group">
                {t('calculator.purposeLabel')}
                <FlipSelect
                  value={store.purpose}
                  onChange={(value) => store.setPurpose(value as PropertyPurpose)}
                  testId="property-purpose"
                >
                  <option value="first">{t('calculator.purposeFirst')}</option>
                  <option value="upgrade">{t('calculator.purposeUpgrade')}</option>
                  <option value="investment">{t('calculator.purposeInvestment')}</option>
                </FlipSelect>
              </label>

              <label className="input-group">
                {t('calculator.propertyValueLabel')}
                <MoneyInput
                  value={store.propertyValueText}
                  onChange={(raw, caret) => store.setPropertyValue(raw, caret)}
                  onBlur={() => store.setPropertyBlur()}
                  suffix="₪"
                  ariaLabel={t('calculator.propertyValueLabel')}
                  testId="property-value"
                />
              </label>

              <label className="input-group">
                {t('calculator.capitalLabel')}
                <MoneyInput
                  value={store.capitalText}
                  onChange={(raw, caret) => store.setCapital(raw, caret)}
                  onBlur={() => store.setCapitalBlur()}
                  suffix="₪"
                  placeholder={vm.capitalPlaceholder}
                  ariaLabel={t('calculator.capitalLabel')}
                  testId="initial-capital"
                />
              </label>

              <label className="input-group">
                {t('calculator.incomeLabel')}
                <MoneyInput
                  value={store.incomeText}
                  onChange={(raw, caret) => store.setIncome(raw, caret)}
                  onBlur={() => store.setIncomeBlur()}
                  suffix="₪"
                  placeholder={vm.incomePlaceholder}
                  ariaLabel={t('calculator.incomeLabel')}
                  testId="monthly-income"
                />
              </label>
            </div>

            {/* Equity note */}
            <p
              id="equity-note"
              hidden={vm.equityNoteLines.length === 0}
              data-testid="equity-note"
              className={`${
                vm.equityState === 'bad'
                  ? 'info-note equity-bad'
                  : vm.equityState === 'good'
                    ? 'info-note equity-good'
                    : 'info-note'
              } whitespace-pre-line`}
            >
              {vm.equityNoteLines.map((line, index) => (
                <Fragment key={index}>
                  {line}
                  {index < vm.equityNoteLines.length - 1 ? '\n' : null}
                </Fragment>
              ))}
            </p>

            {/* Limits warnings */}
            <p
              id="limits-warning"
              hidden={vm.warningMessages.length === 0}
              data-testid="limits-warning"
              role="alert"
              className="limits-warning"
            >
              {vm.warningMessages.join('\n')}
            </p>

            <PresetSelector />

            <div id="tracks-list" data-testid="tracks-list">
              {store.tracks.map((track, index) => (
                <TrackForm key={track.id} track={track} index={index} />
              ))}
            </div>

            {store.tracks.length < MAX_TRACKS && (
              <button
                type="button"
                id="add-track"
                data-testid="add-track"
                className="add-track-button"
                onClick={() => store.addTrack({ years: store.termYears })}
              >
                {t('calculator.addTrack')}
              </button>
            )}

            <p
              id="form-error"
              role="alert"
              hidden={!store.error}
              data-testid="form-error"
              className="form-error"
            >
              {vm.errorMessageIsHtml ? (
                <>
                  {t('calculator.errors.variableCapLine1')}
                  <br />
                  {t('calculator.errors.variableCapLine2').trimStart()}
                </>
              ) : (
                vm.errorMessage
              )}
            </p>

            {store.error?.kind === 'variableCap' && (
              <button
                type="button"
                id="autofix-mix"
                data-testid="autofix-mix"
                className="autofix-button"
                onClick={() => store.autofixMix()}
              >
                {t('calculator.autofix')}
              </button>
            )}

            <p className="regulatory-note">
              <strong>💡</strong> {' '}
              {t('calculator.regulatoryNote')}
            </p>
          </form>
        </section>

        <div ref={resultsRef}>
          <ResultsCards />
        </div>

        <ScheduleSection />
      </main>
    </>
  )
}
