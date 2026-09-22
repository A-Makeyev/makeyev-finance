import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ScrollCue } from '@/components/layout/ScrollCue'
import {
  MAX_OTHER_EXPENSES,
  MAX_TRACKS,
  MAX_YEARS,
  TRACK_TYPES,
  type AmortizationMethod,
  type PropertyPurpose,
} from '@/lib/amortization'
import { formatCurrency, formatRatePercent, formatRatio } from '@/lib/format'
import { PRESET_IDS } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { TermSlider } from '@/components/ui/TermSlider'
import { useMediaQuery } from '@/hooks/useScrolled'
import { useComparisonStore } from '@/stores/comparisonStore'
import type { ScenarioResult } from './computeScenario'

/**
 * Side-by-side mortgage scenario comparison (/compare).
 *
 * Layout (confirmed with the user):
 * - Desktop: one table, scenarios as columns, metrics as rows, best value
 *   per row highlighted - the tradeoffs read straight off the table.
 * - Mobile (~360px): the same data re-renders as one stacked card per
 *   scenario with a scenario switcher (tabs), not a horizontally scrolled
 *   table that breaks down at narrow widths.
 *
 * Every number comes from the comparison store, which calls the same pure
 * amortization.ts functions as the main calculator - no re-implemented math.
 */

/** One metric row definition: label + value extraction + lower-is-better flag. */
interface MetricDef {
  key: string
  label: (years: number) => string
  value: (result: ScenarioResult) => string
  /** Numeric basis for "best in row" highlighting (null = never highlight). */
  best: (result: ScenarioResult) => number | null
  /** True when a HIGHER value is better (none today except payback-adjacent rows). */
  higherIsBetter?: boolean
  /** Only meaningful when at least two scenarios have a computable value. */
  isCurrency?: boolean
}

export function ComparePage() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // Which scenario the mobile stacked view shows (index into scenarios).
  const [mobileIndex, setMobileIndex] = useState(0)

  const scenarios = useComparisonStore((s) => s.scenarios)
  const shared = useComparisonStore((s) => s.shared)
  const results = useComparisonStore((s) => s.results)
  // Select each action individually (stable references) - a single selector
  // returning a fresh object would re-render forever in Zustand v5.
  const actions = {
    setLabel: useComparisonStore((s) => s.setLabel),
    setPropertyValue: useComparisonStore((s) => s.setPropertyValue),
    setCapital: useComparisonStore((s) => s.setCapital),
    setIncome: useComparisonStore((s) => s.setIncome),
    setPurpose: useComparisonStore((s) => s.setPurpose),
    addSharedExpense: useComparisonStore((s) => s.addSharedExpense),
    updateSharedExpenseLabel: useComparisonStore((s) => s.updateSharedExpenseLabel),
    updateSharedExpenseMonthly: useComparisonStore((s) => s.updateSharedExpenseMonthly),
    updateSharedExpenseOneTime: useComparisonStore((s) => s.updateSharedExpenseOneTime),
    removeSharedExpense: useComparisonStore((s) => s.removeSharedExpense),
    addScenario: useComparisonStore((s) => s.addScenario),
    duplicateScenario: useComparisonStore((s) => s.duplicateScenario),
    removeScenario: useComparisonStore((s) => s.removeScenario),
    addTrack: useComparisonStore((s) => s.addTrack),
    removeTrack: useComparisonStore((s) => s.removeTrack),
    updateTrackAmount: useComparisonStore((s) => s.updateTrackAmount),
    commitTrackAmountBlur: useComparisonStore((s) => s.commitTrackAmountBlur),
    updateTrackYears: useComparisonStore((s) => s.updateTrackYears),
    commitTrackYearsBlur: useComparisonStore((s) => s.commitTrackYearsBlur),
    updateTrackRate: useComparisonStore((s) => s.updateTrackRate),
    commitTrackRateBlur: useComparisonStore((s) => s.commitTrackRateBlur),
    changeTrackType: useComparisonStore((s) => s.changeTrackType),
    changeTrackMethod: useComparisonStore((s) => s.changeTrackMethod),
    setScenarioTermYears: useComparisonStore((s) => s.setScenarioTermYears),
    setScenarioMortgageSum: useComparisonStore((s) => s.setScenarioMortgageSum),
    loadScenarioPreset: useComparisonStore((s) => s.loadScenarioPreset),
  }

  useEffect(() => {
    document.title = t('compare.metaTitle')
  }, [t])

  // Keep the mobile switcher inside bounds when scenarios are removed.
  const clampedMobileIndex = Math.min(mobileIndex, Math.max(0, scenarios.length - 1))

  /** Max term across scenarios, for the "total payments over N years" label. */
  const maxTerm = useMemo(
    () => Math.max(0, ...results.map((result) => result.maxTermYears)),
    [results],
  )

  /**
   * A blank scenario has no figures to report - it shows a dash rather than a
   * ₪0 that would read as a real (free) mortgage.
   */
  const dashIfEmpty = (result: ScenarioResult, text: string) => (result.isEmpty ? '-' : text)

  const metrics: MetricDef[] = [
    {
      key: 'firstPayment',
      label: () => t('compare.metricFirstPayment'),
      value: (result) => dashIfEmpty(result, formatCurrency(result.totals.firstPayment)),
      best: (result) => (result.error || result.isEmpty ? null : result.totals.firstPayment),
      isCurrency: true,
    },
    {
      key: 'rateUp',
      label: () => t('compare.metricRateUp'),
      value: (result) =>
        result.error || result.isEmpty ? '-' : formatCurrency(result.firstPaymentRateUp1),
      best: (result) => (result.error || result.isEmpty ? null : result.firstPaymentRateUp1),
      isCurrency: true,
    },
    {
      key: 'totalPayment',
      // With every scenario blank there is no term to name, so the row falls
      // back to the unqualified label.
      label: () =>
        maxTerm > 0
          ? t('compare.metricTotalPayment', { years: maxTerm })
          : t('compare.metricTotalPaymentGeneric'),
      value: (result) => dashIfEmpty(result, formatCurrency(result.totals.totalPaid)),
      best: (result) => (result.error || result.isEmpty ? null : result.totals.totalPaid),
      isCurrency: true,
    },
    {
      key: 'totalInterest',
      label: () => t('compare.metricTotalInterest'),
      value: (result) => dashIfEmpty(result, formatCurrency(result.totals.totalInterest)),
      best: (result) => (result.error || result.isEmpty ? null : result.totals.totalInterest),
      isCurrency: true,
    },
    {
      key: 'weightedRate',
      label: () => t('compare.metricWeightedRate'),
      value: (result) =>
        dashIfEmpty(result, `${formatRatePercent(result.weightedAvgInterestRate)}%`),
      best: (result) => (result.error || result.isEmpty ? null : result.weightedAvgInterestRate),
    },
    {
      key: 'overpay',
      label: () => t('compare.metricOverpay'),
      value: (result) => dashIfEmpty(result, `${formatRatePercent(result.overpayPercent)}%`),
      best: (result) => (result.error || result.isEmpty ? null : result.overpayPercent),
    },
    {
      key: 'payback',
      label: () => t('compare.metricPayback'),
      value: (result) => dashIfEmpty(result, formatRatio(result.avgPaybackRatio)),
      best: (result) => (result.error || result.isEmpty ? null : result.avgPaybackRatio),
    },
    {
      key: 'term',
      label: () => t('compare.metricTerm'),
      value: (result) =>
        result.isEmpty ? '-' : t('compare.metricTermValue', { years: result.maxTermYears }),
      best: () => null,
    },
    {
      key: 'mix',
      label: () => t('compare.metricMix'),
      value: (result) =>
        result.summaryTypes.length
          ? result.summaryTypes.map((type) => t(`calculator.trackTypes.${type}`)).join(' · ')
          : '-',
      best: () => null,
    },
    {
      key: 'loan',
      label: () => t('compare.metricLoan'),
      value: (result) => dashIfEmpty(result, formatCurrency(result.loanAmount)),
      best: () => null,
    },
    {
      key: 'upfront',
      label: () => t('compare.metricUpfront'),
      value: (result) =>
        !result.isEmpty && result.upfrontTotal !== null ? formatCurrency(result.upfrontTotal) : '-',
      best: () => null,
    },
  ]

  /** Per-row best indexes: every scenario tying for the optimum is highlighted. */
  const bestIndexes = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const metric of metrics) {
      const values = results.map((result) => metric.best(result))
      const valid = values.filter((value): value is number => value !== null)
      if (valid.length < 2) continue
      const optimum = Math.min(...valid)
      if (!Number.isFinite(optimum)) continue
      const winners = new Set<number>()
      values.forEach((value, index) => {
        if (value !== null && Math.abs(value - optimum) < 1e-9) winners.add(index)
      })
      if (winners.size >= 1 && winners.size < results.length) map.set(metric.key, winners)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, t])

  /** Regulatory status summary for one scenario, as short pass/fail lines. */
  const statusLines = (result: ScenarioResult): Array<{ ok: boolean | null; text: string }> => {
    if (result.error === 'positive') {
      return [{ ok: false, text: t('compare.statusErrorPositive') }]
    }
    if (result.error === 'variableCap') {
      return [{ ok: false, text: t('compare.statusErrorVariableCap') }]
    }
    if (result.isEmpty) return [{ ok: null, text: t('compare.statusEmpty') }]
    const lines: Array<{ ok: boolean | null; text: string }> = []
    if (result.ltv) {
      lines.push({
        ok: false,
        text: t('compare.statusLtvOver', {
          percent: result.ltv.percent.toFixed(1),
          limit: result.ltv.limit,
        }),
      })
    } else {
      lines.push({ ok: true, text: t('compare.statusLtvOk') })
    }
    if (result.dti) {
      lines.push({
        ok: false,
        text: t('compare.statusDtiOver', { minIncome: formatCurrency(result.dti.minIncome) }),
      })
    } else if (result.totals.firstPayment > 0) {
      lines.push({ ok: true, text: t('compare.statusDtiOk') })
    }
    if (result.pti) {
      lines.push({
        ok: false,
        text: t('compare.statusPtiOver', { threshold: result.pti.thresholdPercent }),
      })
    } else if (result.totals.firstPayment > 0) {
      lines.push({ ok: true, text: t('compare.statusPtiOk') })
    }
    return lines
  }

  /** The scenario editor block (tracks + term + label), shared by both layouts. */
  const renderScenarioEditor = (scenarioIndex: number) => {
    const scenario = scenarios[scenarioIndex]
    if (!scenario) return null
    return (
      <div
        className="compare-scenario-editor"
        data-testid={`compare-scenario-editor-${scenarioIndex + 1}`}
      >
        <div className="compare-scenario-head">
          <input
            type="text"
            className="compare-scenario-name"
            value={scenario.label}
            placeholder={t('compare.scenarioUntitle', { index: scenarioIndex + 1 })}
            aria-label={t('compare.scenarioLabelAria')}
            data-testid={`compare-scenario-name-${scenarioIndex + 1}`}
            onChange={(event) => actions.setLabel(scenario.id, event.target.value)}
          />
          {scenarios.length < MAX_TRACKS && (
            <button
              type="button"
              className="compare-icon-button"
              aria-label={t('compare.scenarioDuplicate')}
              data-testid={`compare-duplicate-${scenarioIndex + 1}`}
              onClick={() => actions.duplicateScenario(scenario.id)}
            >
              ⧉
            </button>
          )}
          {scenarios.length > 2 && (
            <button
              type="button"
              className="compare-icon-button"
              aria-label={t('compare.scenarioRemove')}
              data-testid={`compare-scenario-remove-${scenarioIndex + 1}`}
              onClick={() => actions.removeScenario(scenario.id)}
            >
              ×
            </button>
          )}
        </div>{' '}
        {/* סכום המשכנתא: the loan-defining input, calculator parity. With a
            property value set it mirrors property - capital and locks (the
            loan derives from the property); without one it defines the loan
            and fills/scales the tracks as it is typed. */}
        <label className="compare-sum-row">
          {t('calculator.startingAmountLabel')}
          <MoneyInput
            value={scenario.mortgageSumText}
            onChange={(raw, caret) => actions.setScenarioMortgageSum(scenario.id, raw, caret)}
            suffix="₪"
            ariaLabel={t('calculator.startingAmountLabel')}
            testId={`compare-mortgage-sum-${scenarioIndex + 1}`}
          />
        </label>
        {/* Preset mixes (תמהיל 1-4), calculator parity: clicking one replaces
            the scenario's tracks with the preset's allocation at the current
            loan (or the tracks' total). The active preset stays highlighted.
            A blank scenario keeps the mix shape at zero amounts; typing a sum
            allocates it. */}
        <div
          className="compare-preset-list"
          role="group"
          aria-label={t('calculator.presetHeading')}
        >
          {PRESET_IDS.map((presetId) => (
            <button
              key={presetId}
              type="button"
              className={
                scenario.activePreset === presetId
                  ? 'compare-preset-button active'
                  : 'compare-preset-button'
              }
              aria-pressed={scenario.activePreset === presetId}
              data-testid={`compare-preset-${scenarioIndex + 1}-${presetId}`}
              onClick={() => actions.loadScenarioPreset(scenario.id, presetId)}
            >
              {t(`calculator.preset${presetId.charAt(0).toUpperCase()}${presetId.slice(1)}`)}
            </button>
          ))}
        </div>
        <label className="compare-term-row">
          {t('compare.scenarioTermLabel')}
          <TermSlider
            min={1}
            max={MAX_YEARS}
            value={scenario.termYears}
            onValueChange={(value) => actions.setScenarioTermYears(scenario.id, value)}
            labelLow="1"
            labelHigh={String(MAX_YEARS)}
            ariaLabel={t('compare.scenarioTermLabel')}
            testId={`compare-term-${scenarioIndex + 1}`}
          />
          <span>
            {scenario.termYears} {t('compare.scenarioTermSuffix')}
          </span>
        </label>
        {scenario.tracks.map((track, trackIndex) => (
          <fieldset
            key={track.id}
            className="mortgage-track compare-track"
            data-testid={`compare-track-${scenarioIndex + 1}-${trackIndex + 1}`}
          >
            <legend>{t('compare.trackLegend', { index: trackIndex + 1 })}</legend>
            {scenario.tracks.length > 1 && (
              <button
                type="button"
                className="remove-track"
                aria-label={t('compare.trackRemoveAria')}
                data-testid={`compare-track-remove-${scenarioIndex + 1}-${trackIndex + 1}`}
                onClick={() => actions.removeTrack(scenario.id, track.id)}
              >
                ×
              </button>
            )}

            <label className="input-group">
              {t('compare.trackTypeLabel')}
              <FlipSelect
                value={track.type}
                onChange={(value) => actions.changeTrackType(scenario.id, track.id, value as never)}
                testId={`compare-track-type-${scenarioIndex + 1}-${trackIndex + 1}`}
              >
                {TRACK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`calculator.trackTypes.${type}`)}
                  </option>
                ))}
              </FlipSelect>
            </label>

            <label className="input-group">
              {t('compare.trackAmountLabel')}
              <MoneyInput
                value={track.amountText}
                onChange={(raw, caret) =>
                  actions.updateTrackAmount(scenario.id, track.id, raw, caret)
                }
                onBlur={() => actions.commitTrackAmountBlur(scenario.id, track.id)}
                suffix="₪"
                ariaLabel={t('compare.trackAmountLabel')}
                testId={`compare-track-amount-${scenarioIndex + 1}-${trackIndex + 1}`}
              />
            </label>

            <label className="input-group">
              {t('compare.trackYearsLabel')}
              <div className="input-wrap">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_YEARS}
                  step={1}
                  value={track.yearsText}
                  onInput={(event) =>
                    actions.updateTrackYears(scenario.id, track.id, event.currentTarget.value)
                  }
                  onBlur={() => actions.commitTrackYearsBlur(scenario.id, track.id)}
                  required
                  aria-label={t('compare.trackYearsLabel')}
                  data-testid={`compare-track-years-${scenarioIndex + 1}-${trackIndex + 1}`}
                />
                <span>{t('compare.trackYearsSuffix')}</span>
              </div>
            </label>

            <label className="input-group">
              {t('compare.trackRateLabel')}
              <div className="input-wrap">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={track.rateText}
                  onInput={(event) =>
                    actions.updateTrackRate(scenario.id, track.id, event.currentTarget.value)
                  }
                  onBlur={() => actions.commitTrackRateBlur(scenario.id, track.id)}
                  required
                  aria-label={t('compare.trackRateLabel')}
                  data-testid={`compare-track-rate-${scenarioIndex + 1}-${trackIndex + 1}`}
                />
                <span>%</span>
              </div>
            </label>

            <label className="input-group">
              {t('compare.trackMethodLabel')}
              <FlipSelect
                value={track.method}
                onChange={(value) =>
                  actions.changeTrackMethod(scenario.id, track.id, value as AmortizationMethod)
                }
                testId={`compare-track-method-${scenarioIndex + 1}-${trackIndex + 1}`}
              >
                <option value="spitzer">{t('calculator.track.methodSpitzer')}</option>
                <option value="equalPrincipal">{t('calculator.track.methodEqualPrincipal')}</option>
              </FlipSelect>
            </label>
          </fieldset>
        ))}
        {scenario.tracks.length < MAX_TRACKS && (
          <button
            type="button"
            className="add-track-button"
            data-testid={`compare-track-add-${scenarioIndex + 1}`}
            onClick={() => actions.addTrack(scenario.id)}
          >
            {t('compare.trackAdd')}
          </button>
        )}
      </div>
    )
  }

  /** Pass/fail chip for one status line. */
  const StatusChip = ({ ok, text }: { ok: boolean | null; text: string }) => (
    <span className={`compare-status ${ok === true ? 'ok' : ok === false ? 'bad' : 'muted'}`}>
      {ok === true ? '✔️' : ok === false ? '❌' : 'ℹ️'} {text}
    </span>
  )

  return (
    <>
      {/* compare-sub-header: page-scoped hero modifier (same convention as
          contact-sub-header) - the English title is the longest on the site
          and needs to wrap instead of overhanging narrow viewports. */}
      <section className="sub-header compare-sub-header">
        <div className="text-box main-heading">
          <h1 className="gradient-text-no-hover">{t('compare.heading')}</h1>
        </div>
        <ScrollCue />
      </section>

      <main className="compare-shell" data-testid="compare-shell">
        {/* Shared inputs: property and buyer, entered once for all scenarios.
            The way back to the calculator the comparison was seeded from sits
            on the heading row, at the opposite side; the arrow is mirrored by
            the stylesheet under RTL, so "back" points the way it reads. */}
        <section
          className="compare-shared"
          data-testid="compare-shared"
          aria-label={t('compare.sharedInputsHeading')}
        >
          <div className="compare-shared-head">
            <h2>{t('compare.sharedInputsHeading')}</h2>
            <Link className="compare-back" to="/calculators" data-testid="compare-back">
              {/* The arrow is mirrored by the stylesheet under RTL, so "back"
                  points the way the layout reads (e2e measures its geometry). */}
              {t('compare.backToCalculator')}
              <span className="compare-back-icon" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <div className="compare-shared-grid">
            <label className="input-group">
              {t('compare.purposeLabel')}
              <FlipSelect
                value={shared.purpose}
                onChange={(value) => actions.setPurpose(value as PropertyPurpose)}
                testId="compare-purpose"
              >
                <option value="first">{t('calculator.purposeFirst')}</option>
                <option value="upgrade">{t('calculator.purposeUpgrade')}</option>
                <option value="investment">{t('calculator.purposeInvestment')}</option>
              </FlipSelect>
            </label>
            <label className="input-group">
              {t('compare.propertyValueLabel')}
              <MoneyInput
                value={shared.propertyValueText}
                onChange={(raw, caret) => actions.setPropertyValue(raw, caret)}
                suffix="₪"
                ariaLabel={t('compare.propertyValueLabel')}
                testId="compare-property-value"
              />
            </label>
            <label className="input-group">
              {t('compare.capitalLabel')}
              <MoneyInput
                value={shared.capitalText}
                onChange={(raw, caret) => actions.setCapital(raw, caret)}
                suffix="₪"
                ariaLabel={t('compare.capitalLabel')}
                testId="compare-capital"
              />
            </label>
            <label className="input-group">
              {t('compare.incomeLabel')}
              <MoneyInput
                value={shared.incomeText}
                onChange={(raw, caret) => actions.setIncome(raw, caret)}
                suffix="₪"
                ariaLabel={t('compare.incomeLabel')}
                testId="compare-income"
              />
            </label>
          </div>

          {/* Other expenses (calculator parity): the monthly amounts fold
              into every scenario's payment-to-income check and the one-time
              amounts join the upfront cash total. They describe the buyer,
              not the scenario, so they sit with the shared inputs; the rows
              reuse the calculator's .expense-row rhythm and vocabulary. */}
          <div className="compare-expenses" data-testid="compare-expenses">
            {shared.otherExpenses.map((expense) => (
              <div key={expense.id} className="expense-row">
                <button
                  type="button"
                  className="expense-remove-button"
                  onClick={() => actions.removeSharedExpense(expense.id)}
                  aria-label={t('calculator.expenseRemove')}
                  data-testid={`compare-expense-remove-${expense.id}`}
                >
                  ×
                </button>
                <label className="input-group expense-label-group">
                  {t('calculator.expenseLabel')}
                  <div className="input-wrap expense-label-wrap">
                    <input
                      type="text"
                      value={expense.label}
                      onChange={(event) =>
                        actions.updateSharedExpenseLabel(expense.id, event.target.value)
                      }
                      aria-label={t('calculator.expenseLabelAria')}
                      data-testid={`compare-expense-label-${expense.id}`}
                    />
                  </div>
                </label>
                <label className="input-group expense-amount-group">
                  {t('calculator.expenseAmountLabel')}
                  <MoneyInput
                    value={expense.monthlyText}
                    onChange={(raw, caret) =>
                      actions.updateSharedExpenseMonthly(expense.id, raw, caret)
                    }
                    suffix="₪"
                    ariaLabel={t('calculator.expenseAmountLabel')}
                    testId={`compare-expense-amount-${expense.id}`}
                  />
                </label>
                <label className="input-group expense-onetime-group">
                  {t('calculator.expenseOneTimeAmountLabel')}
                  <MoneyInput
                    value={expense.oneTimeText}
                    onChange={(raw, caret) =>
                      actions.updateSharedExpenseOneTime(expense.id, raw, caret)
                    }
                    suffix="₪"
                    ariaLabel={t('calculator.expenseOneTimeAmountLabel')}
                    testId={`compare-expense-onetime-${expense.id}`}
                  />
                </label>
              </div>
            ))}
            {/* The add control trails the rows (or stands alone when empty),
                start-aligned exactly like the calculator's block. */}
            {shared.otherExpenses.length === 0 ? (
              <div className="expense-row expense-add-row">
                <button
                  type="button"
                  className="expense-add-button"
                  onClick={() => actions.addSharedExpense()}
                  data-testid="compare-add-expense"
                >
                  {t('calculator.otherExpensesAdd')} +
                </button>
              </div>
            ) : (
              shared.otherExpenses.length < MAX_OTHER_EXPENSES && (
                <div className="expense-row expense-add-under-last">
                  <button
                    type="button"
                    className="expense-add-button"
                    onClick={() => actions.addSharedExpense()}
                    data-testid="compare-add-expense"
                  >
                    {t('calculator.otherExpensesAdd')} +
                  </button>
                </div>
              )
            )}
          </div>
        </section>

        {/* Scenario editors: table columns on desktop, the active scenario's
            editor under the switcher on mobile. */}
        <section className="compare-editors" data-testid="compare-editors">
          {isDesktop ? (
            <div className="compare-editors-grid">
              {scenarios.map((scenario, index) => (
                <div key={scenario.id} className="compare-editor-cell">
                  {renderScenarioEditor(index)}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div
                className="compare-switcher"
                role="tablist"
                aria-label={t('compare.scenarioSwitcherAria')}
                data-testid="compare-switcher"
              >
                {scenarios.map((scenario, index) => (
                  <button
                    key={scenario.id}
                    type="button"
                    role="tab"
                    aria-selected={index === clampedMobileIndex}
                    className={index === clampedMobileIndex ? 'active' : undefined}
                    data-testid={`compare-switch-tab-${index + 1}`}
                    onClick={() => setMobileIndex(index)}
                  >
                    {scenario.label.trim() || t('compare.scenarioUntitle', { index: index + 1 })}
                  </button>
                ))}
              </div>
              {renderScenarioEditor(clampedMobileIndex)}
            </>
          )}
          {scenarios.length < MAX_TRACKS && (
            <button
              type="button"
              className="compare-add-scenario"
              data-testid="compare-add-scenario"
              onClick={() => {
                actions.addScenario()
                setMobileIndex(scenarios.length)
              }}
            >
              {t('compare.scenarioAdd')}
            </button>
          )}
        </section>

        {/* Desktop: comparison table. Scenarios as columns, metrics as rows. */}
        {isDesktop && (
          <section className="compare-table-wrap" data-testid="compare-table">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col" className="metric-col" />
                  {scenarios.map((scenario, index) => (
                    <th scope="col" key={scenario.id}>
                      {scenario.label.trim() || t('compare.scenarioUntitle', { index: index + 1 })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.key} data-testid={`compare-row-${metric.key}`}>
                    <th scope="row">{metric.label(maxTerm)}</th>
                    {results.map((result, index) => (
                      <td
                        key={scenarios[index]?.id ?? index}
                        className={bestIndexes.get(metric.key)?.has(index) ? 'best' : undefined}
                      >
                        {metric.value(result)}
                        {bestIndexes.get(metric.key)?.has(index) && (
                          <span className="compare-best-badge">{t('compare.bestBadge')}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr data-testid="compare-row-status">
                  <th scope="row">{t('compare.statusHeading')}</th>
                  {results.map((result, index) => (
                    <td key={scenarios[index]?.id ?? index}>
                      <div className="compare-status-list">
                        {statusLines(result).map((line, lineIndex) => (
                          <StatusChip key={lineIndex} ok={line.ok} text={line.text} />
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Mobile: one stacked card per scenario, switched by tabs. */}
        {!isDesktop && (
          <section className="compare-card" data-testid="compare-card">
            {(() => {
              const result = results[clampedMobileIndex]
              const scenario = scenarios[clampedMobileIndex]
              if (!result || !scenario) return null
              return (
                <>
                  <h2>
                    {scenario.label.trim() ||
                      t('compare.scenarioUntitle', { index: clampedMobileIndex + 1 })}
                  </h2>
                  <dl className="compare-card-metrics">
                    {metrics.map((metric) => (
                      <div
                        key={metric.key}
                        className={
                          bestIndexes.get(metric.key)?.has(clampedMobileIndex) ? 'best' : undefined
                        }
                      >
                        <dt>{metric.label(maxTerm)}</dt>
                        <dd>
                          {metric.value(result)}
                          {bestIndexes.get(metric.key)?.has(clampedMobileIndex) && (
                            <span className="compare-best-badge">{t('compare.bestBadge')}</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="compare-status-list">
                    {statusLines(result).map((line, lineIndex) => (
                      <StatusChip key={lineIndex} ok={line.ok} text={line.text} />
                    ))}
                  </div>
                </>
              )
            })()}
          </section>
        )}

        <p className="compare-disclaimer">{t('compare.disclaimer')}</p>
      </main>
    </>
  )
}
