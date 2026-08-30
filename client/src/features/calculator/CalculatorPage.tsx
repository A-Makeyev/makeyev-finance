import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { fetchPrimeRatePercent } from '@/services/boi'
import { useCalculatorStore } from '@/stores/calculatorStore'
import { MAX_TRACKS, MAX_YEARS, type PropertyPurpose } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { TermSlider } from '@/components/ui/TermSlider'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { AppModal } from '@/components/ui/AppModal'
import { PresetSelector } from './PresetSelector'
import { TrackForm } from './TrackForm'
import { ResultsCards } from './ResultsCards'
import { ScheduleSection } from './ScheduleSection'
import { useCalculatorViewModel, type NoteLine } from './useCalculatorViewModel'

/**
 * Mortgage calculator page — full port of calculators.html + calculator.js;
 * markup/classes mirror the legacy DOM (calculator-shell / calculator-panel /
 * starting-point / limits-row …) so the verbatim CSS applies unchanged.
 */
export function CalculatorPage() {
  const { t, i18n } = useTranslation()
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Reset stays available whenever any data is present (including the default
  // ₪1,000,000 prefill); it is only disabled when everything is truly cleared
  // to blank — empty sum, no track amounts and no cash/property inputs.
  const canReset = useCalculatorStore((s) => {
    const sumBlank = s.startingAmountText.trim() === ''
    const inputsBlank =
      s.propertyValueText === '' && s.capitalText === '' && s.incomeText === ''
    const hasTrackAmount = s.tracks.some((track) => track.amountText.trim() !== '')
    return !(sumBlank && inputsBlank && !hasTrackAmount)
  })

  const confirmReset = () => {
    // Reset first, then close — closing triggers a re-render that must not
    // beat the state change.
    store.reset()
    setResetConfirmOpen(false)
  }

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

  /**
   * Renders status-tagged summary lines as blocks, adding a larger gap when
   * the status group changes (positive → negative → info) so good, bad and
   * general-info messages read as groups (feedback request).
   */
  const renderNoteLines = (lines: NoteLine[]): ReactNode =>
    lines.map((line, index) => (
      <span
        key={index}
        className={`note-line ${line.status}${
          index > 0 && line.status !== lines[index - 1].status ? ' group-start' : ''
        }`}
      >
        {line.node}
      </span>
    ))

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
              disabled={!canReset}
              onClick={() => setResetConfirmOpen(true)}
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

            {/* Summary notes: the equity/closing-cost breakdown and the
                regulatory warnings on one list, grouped good → bad → info */}
            <div
              id="summary-notes"
              hidden={vm.summaryNotes.length === 0}
              data-testid="summary-notes"
              role="alert"
              className={`summary-notes${vm.allGood ? ' all-good' : ''}`}
            >
              {renderNoteLines(vm.summaryNotes)}
            </div>

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
              <strong>⚠️</strong> {' '}
              {t('calculator.regulatoryNote')}
            </p>
          </form>
        </section>

        <div ref={resultsRef}>
          <ResultsCards />
        </div>

        <ScheduleSection />
      </main>

      <AppModal
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        testId="reset-confirm"
        dir={i18n.dir()}
        contentClassName="max-w-[420px] !border-0 !shadow-[0_12px_32px_rgba(15,15,15,0.30)]"
      >
        <div className="p-6 pb-6">
          <div className="mb-5">
            <h3 className="text-[20px] font-bold leading-tight text-soft-black">
              {t('calculator.resetConfirmTitle')}
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[#333]">
              {t('calculator.resetConfirmBody')} {t('calculator.resetConfirmUndoLine')}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              data-testid="reset-confirm-no"
              className="rounded-[5px] border border-[var(--calc-line)] px-5 py-2 text-[15px] font-medium text-[var(--calc-muted)] transition-colors hover:text-[var(--calc-teal-dark)]"
              onClick={() => setResetConfirmOpen(false)}
            >
              {t('calculator.resetCancel')}
            </button>
            <button
              type="button"
              data-testid="reset-confirm-yes"
              className="rounded-[5px] bg-[var(--calc-teal)] px-5 py-2 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--calc-teal-dark)]"
              onClick={confirmReset}
            >
              {t('calculator.resetConfirm')}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  )
}
