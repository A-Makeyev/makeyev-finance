'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@/router'
import { ScrollCue } from '@/components/layout/ScrollCue'
import {
  LAWYER_MINIMUM_FEE,
  MAX_TRACKS,
  MAX_YEARS,
  TRACK_TYPES,
  VAT_RATE,
  isVariableType,
  type AmortizationMethod,
  type PropertyPurpose,
  type TrackType,
} from '@/lib/amortization'
import {
  formatCurrency,
  formatGroupedNumber,
  formatRatePercent,
  formatRatio,
  parseAmountText,
} from '@/lib/format'
import { PRESET_IDS } from '@/lib/amortization'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { TermSlider } from '@/components/ui/TermSlider'
import { useMediaQuery } from '@/hooks/useScrolled'
import { useComparisonStore } from '@/stores/comparisonStore'
import { TrackMixDonut } from '@/features/calculator/TrackMixDonut'
import { sharedInputSuggestions, type ScenarioResult } from './computeScenario'
import { CompareTrendChart, type TrendSeries } from './CompareTrendChart'
import { ScheduleTable } from './ScheduleTable'

/**
 * Side-by-side mortgage scenario comparison (/compare).
 *
 * Layout (confirmed with the user):
 * - Every scenario is one result card, in the SAME columns as its editor, so
 *   the results read directly under the mix that produced them. Each card
 *   carries its metrics (best-per-metric highlighted), compliance status and
 *   yearly payments table.
 * - Below the cards sit three comparison charts (remaining debt, total paid,
 *   cumulative interest), each plotting every mix as its own line/area so the
 *   differences read at a glance, plus a full-width stacked קרן/ריבית
 *   composition chart (the monthly-payment line duplicated its story).
 * - Mobile (~360px): the same cards, switched by a scenario switcher (tabs)
 *   rather than a long stack.
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

/** The lawyer floor, VAT-inclusive, shown in the floor note (calculator parity). */
const LAWYER_FLOOR_WITH_VAT = formatGroupedNumber(Math.round(LAWYER_MINIMUM_FEE * (1 + VAT_RATE)))

export function ComparePage() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // Which scenario the mobile stacked view shows (index into scenarios).
  const [mobileIndex, setMobileIndex] = useState(0)

  const scenarios = useComparisonStore((s) => s.scenarios)
  const shared = useComparisonStore((s) => s.shared)
  const results = useComparisonStore((s) => s.results)
  const fee = useComparisonStore((s) => s.fee)
  // The single fixed expense row (monthly + one-time): the page keeps exactly
  // one, so index 0 is always present (default inputs and reset both seed it).
  const expense = shared.otherExpenses[0]
  // Select each action individually (stable references) - a single selector
  // returning a fresh object would re-render forever in Zustand v5.
  const actions = {
    setLabel: useComparisonStore((s) => s.setLabel),
    setPropertyValue: useComparisonStore((s) => s.setPropertyValue),
    setCapital: useComparisonStore((s) => s.setCapital),
    setIncome: useComparisonStore((s) => s.setIncome),
    commitPropertyValueBlur: useComparisonStore((s) => s.commitPropertyValueBlur),
    commitCapitalBlur: useComparisonStore((s) => s.commitCapitalBlur),
    commitIncomeBlur: useComparisonStore((s) => s.commitIncomeBlur),
    setPurpose: useComparisonStore((s) => s.setPurpose),
    updateRealtorPercent: useComparisonStore((s) => s.updateRealtorPercent),
    updateLawyerPercent: useComparisonStore((s) => s.updateLawyerPercent),
    updateRealtorAmount: useComparisonStore((s) => s.updateRealtorAmount),
    updateLawyerAmount: useComparisonStore((s) => s.updateLawyerAmount),
    updateAppraiserFee: useComparisonStore((s) => s.updateAppraiserFee),
    updateRenovationAmount: useComparisonStore((s) => s.updateRenovationAmount),
    updateSharedExpenseMonthly: useComparisonStore((s) => s.updateSharedExpenseMonthly),
    updateSharedExpenseOneTime: useComparisonStore((s) => s.updateSharedExpenseOneTime),
    addScenario: useComparisonStore((s) => s.addScenario),
    duplicateScenario: useComparisonStore((s) => s.duplicateScenario),
    removeScenario: useComparisonStore((s) => s.removeScenario),
    addTrack: useComparisonStore((s) => s.addTrack),
    removeTrack: useComparisonStore((s) => s.removeTrack),
    updateTrackAmount: useComparisonStore((s) => s.updateTrackAmount),
    commitTrackAmountBlur: useComparisonStore((s) => s.commitTrackAmountBlur),
    updateTrackRate: useComparisonStore((s) => s.updateTrackRate),
    commitTrackRateBlur: useComparisonStore((s) => s.commitTrackRateBlur),
    changeTrackType: useComparisonStore((s) => s.changeTrackType),
    changeTrackMethod: useComparisonStore((s) => s.changeTrackMethod),
    setScenarioTermYears: useComparisonStore((s) => s.setScenarioTermYears),
    setMortgageSum: useComparisonStore((s) => s.setMortgageSum),
    fixScenario: useComparisonStore((s) => s.fixScenario),
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

  /** Shared monthly expense total - the liability basis of the income hint. */
  const otherMonthly = useMemo(
    () =>
      shared.otherExpenses.reduce((sum, expense) => sum + parseAmountText(expense.monthlyText), 0),
    [shared.otherExpenses],
  )

  /** Shared one-time expense total - drawn from savings like renovations. */
  const oneTimeExpenses = useMemo(
    () =>
      shared.otherExpenses.reduce((sum, expense) => sum + parseAmountText(expense.oneTimeText), 0),
    [shared.otherExpenses],
  )

  /**
   * Hints for the blank shared buyer inputs (calculator parity: the calculator
   * shows the same advice as placeholders). The values come from the scenarios
   * actually being compared - the binding (largest) priced one - so the hinted
   * property value finances every column, its required equity follows תכלית
   * הרכישה, and the hinted income is the one whose ceiling allowance carries
   * that column's payment. A typed field loses its hint.
   */
  const suggestions = useMemo(
    () =>
      sharedInputSuggestions(results, {
        propertyValueText: shared.propertyValueText,
        capitalText: shared.capitalText,
        incomeText: shared.incomeText,
        purpose: shared.purpose,
        renovations: parseAmountText(shared.renovationAmountText),
        oneTimeExpenses,
        otherMonthly,
        ptiThresholdPercent: shared.ptiThresholdPercent,
      }),
    [results, shared, oneTimeExpenses, otherMonthly],
  )

  /** Hint text for a blank field: grouped digits, no currency symbol (the
      MoneyInput renders its own suffix). */
  const hintText = (value: number | null) =>
    value !== null ? formatGroupedNumber(value) : undefined

  /**
   * A blank scenario has no figures to report - it shows a dash rather than a
   * ₪0 that would read as a real (free) mortgage.
   */
  const dashIfEmpty = (result: ScenarioResult, text: string) => (result.isEmpty ? '-' : text)

  const metrics: MetricDef[] = [
    {
      key: 'avgPayment',
      label: () => t('compare.metricAvgPayment'),
      value: (result) => dashIfEmpty(result, formatCurrency(result.avgMonthlyPayment)),
      best: (result) => (result.error || result.isEmpty ? null : result.avgMonthlyPayment),
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
      key: 'recommendedIncome',
      label: () => t('compare.metricRecommendedIncome'),
      value: (result) =>
        !result.isEmpty && result.recommendedIncome !== null
          ? formatCurrency(result.recommendedIncome)
          : '-',
      best: (result) =>
        result.error || result.isEmpty || result.recommendedIncome === null
          ? null
          : result.recommendedIncome,
      isCurrency: true,
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

  /**
   * The combined chart's series: one line per PRICED mix (empty and
   * error-gated scenarios have no schedule to draw). The label is the mix's
   * own name, matching its result card.
   */
  const trendSeries = useMemo<TrendSeries[]>(
    () =>
      results.flatMap((result, index) => {
        if (result.isEmpty || result.error) return []
        const label =
          scenarios[index]?.label.trim() || t('compare.scenarioUntitle', { index: index + 1 })
        return [{ label, schedule: result.schedule }]
      }),
    [results, scenarios, t],
  )

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
    // The Bank of Israel 2/3 variable cap is caused by the variable tracks'
    // share, so flag THOSE rows red (like the calculator's flagged tracks)
    // instead of tinting the whole result card.
    const variableCap = results[scenarioIndex]?.error === 'variableCap'
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
            name={`compare-scenario-name-${scenarioIndex + 1}`}
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
        {/* תקופה: the scenario's single term control. It drives every track in
            the scenario (there is no per-track term here - the calculator's
            four per-track fields plus a scenario slider read as two תקופה
            inputs in one column). It sits above the mixes because it defines
            the term every mix below is priced at. */}
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
        {/* Preset mixes (תמהיל 1-4), calculator parity: clicking one replaces
            the scenario's tracks with the preset's allocation at the shared
            loan (or at the tracks' own total when no loan is derivable yet).
            The active preset stays highlighted. Picking a mix on a blank
            scenario therefore prices it right away - the loan was already
            entered once, above. */}
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
        {scenario.tracks.map((track, trackIndex) => (
          <fieldset
            key={track.id}
            className={
              variableCap && isVariableType(track.type)
                ? 'mortgage-track compare-track variable-limit-flag'
                : 'mortgage-track compare-track'
            }
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
                  name={`compare-track-rate-${scenarioIndex + 1}-${trackIndex + 1}`}
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

  /**
   * One scenario's results as a card - the desktop grid and the mobile
   * single-card view render the exact same markup (only the test id differs:
   * the mobile view keeps `compare-card`, desktop cards carry
   * `compare-result-card-<n>`). Metric rows carry `compare-metric-<key>-<n>`
   * and keep the `best` highlight, so the comparison stays as clear as the
   * old table without the sideways-scrolling table.
   */
  const renderResultCard = (index: number, testId: string) => {
    const result = results[index]
    const scenario = scenarios[index]
    if (!result || !scenario) return null
    const label = scenario.label.trim() || t('compare.scenarioUntitle', { index: index + 1 })
    const hasFigures = !result.isEmpty && !result.error
    return (
      <article
        key={scenario.id}
        className="compare-result-card"
        data-testid={testId}
      >
        <h2>{label}</h2>
        <dl className="compare-card-metrics">
          {metrics.map((metric) => {
            const isBest = bestIndexes.get(metric.key)?.has(index) ?? false
            return (
              <div
                key={metric.key}
                data-testid={`compare-metric-${metric.key}-${index + 1}`}
                className={
                  [isBest ? 'best' : '', metric.key === 'mix' ? 'compare-metric-mix' : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
              >
                <dt>{metric.label(maxTerm)}</dt>
                <dd title={metric.key === 'mix' ? metric.value(result) : undefined}>
                  {metric.value(result)}
                  {isBest && <span className="compare-best-badge">{t('compare.bestBadge')}</span>}
                </dd>
              </div>
            )
          })}
        </dl>
        <div className="compare-status-list">
          {statusLines(result).map((line, lineIndex) => (
            <StatusChip key={lineIndex} ok={line.ok} text={line.text} />
          ))}
        </div>
        {/* One-click repair, only when the scenario is in an error state: the
            ⅔ variable cap is trimmed (calculator parity) and invalid terms or
            amounts are normalised against the shared loan. */}
        {result.error && (
          <button
            type="button"
            className="autofix-button compare-autofix"
            data-testid={`compare-autofix-${index + 1}`}
            onClick={() => actions.fixScenario(scenario.id)}
          >
            {t('calculator.autofix')}
          </button>
        )}
        {hasFigures && (
          <>
            {/* Composition donut, directly above the payments table: the ring
                answers "what does this mix consist of" and the legend under
                it is the table/text equivalent of the chart (never chart-only). */}
            <div
              className="compare-mix-block"
              data-testid={`compare-mix-donut-${index + 1}`}
            >
              <h3 className="compare-mix-title">{t('compare.mixDonutTitle')}</h3>
              <TrackMixDonut
                shares={result.mixShares.map((share, shareIndex) => ({
                  trackId: `${share.type}-${shareIndex}`,
                  type: share.type as TrackType,
                  amount: share.amount,
                }))}
                size={240}
                className="compare-mix-donut-chart"
              />
            </div>
            <ScheduleTable rows={result.schedule} testIdPrefix={`compare-schedule-${index + 1}`} />
          </>
        )}
      </article>
    )
  }

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
        {/* Shared inputs: purpose, the ONE loan, property and buyer, entered
            once and priced into every scenario (the columns vary the mix, not
            the amount borrowed). The way back to the calculator the comparison
            was seeded from sits on the heading row, at the opposite side; the
            arrow is mirrored by the stylesheet under RTL, so "back" points the
            way it reads. */}
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
            {/* סכום המשכנתא: the ONE loan every scenario is priced at, entered
                with the rest of the buyer profile. It used to sit in each
                scenario, which let the columns compare different amounts and
                made the per-row "best" highlighting meaningless; the page now
                varies the mix, not the loan. */}
            <label className="input-group">
              {t('calculator.startingAmountLabel')}
              <MoneyInput
                value={shared.mortgageSumText}
                onChange={(raw, caret) => actions.setMortgageSum(raw, caret)}
                suffix="₪"
                ariaLabel={t('calculator.startingAmountLabel')}
                testId="compare-mortgage-sum"
              />
            </label>
            {/* The property value drives the two hints below it: typing it
                fills in the equity the bank requires for it and the income
                whose ceiling allowance carries the priced scenarios (calculator
                parity - the same advice shows as grey placeholders there). */}
            <label className="input-group">
              {t('compare.propertyValueLabel')}
              <MoneyInput
                value={shared.propertyValueText}
                onChange={(raw, caret) => actions.setPropertyValue(raw, caret)}
                onBlur={() => actions.commitPropertyValueBlur()}
                suffix="₪"
                placeholder={hintText(suggestions.propertyValue)}
                ariaLabel={t('compare.propertyValueLabel')}
                testId="compare-property-value"
              />
            </label>
            <label className="input-group">
              {t('compare.capitalLabel')}
              <MoneyInput
                value={shared.capitalText}
                onChange={(raw, caret) => actions.setCapital(raw, caret)}
                onBlur={() => actions.commitCapitalBlur()}
                suffix="₪"
                placeholder={hintText(suggestions.capital)}
                ariaLabel={t('compare.capitalLabel')}
                testId="compare-capital"
              />
            </label>
            <label className="input-group">
              {t('compare.incomeLabel')}
              <MoneyInput
                value={shared.incomeText}
                onChange={(raw, caret) => actions.setIncome(raw, caret)}
                onBlur={() => actions.commitIncomeBlur()}
                suffix="₪"
                placeholder={hintText(suggestions.income)}
                ariaLabel={t('compare.incomeLabel')}
                testId="compare-income"
              />
            </label>
            {/* Other expenses (calculator parity): one fixed pair, no
                add/remove. The monthly amount folds into every scenario's
                payment-to-income check; the one-time amount joins the upfront
                cash total (and eats the equity, like renovations). It describes
                the buyer, not the scenario, so it sits with the shared inputs. */}
            {expense && (
              <>
                <label className="input-group">
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
                <label className="input-group">
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
              </>
            )}
          </div>

          {/* Transaction costs (calculator parity): one-time costs that join
              every scenario's upfront total. Realtor/lawyer pair a percent with
              an editable ₪ mirror (percent canonical, blank falls back to the
              market norm); the appraiser fee and the renovation budget are flat
              ₪ amounts. Renovations also reduce the capital the shared loan
              derives from, exactly like the calculator. They describe the
              buyer, not the scenario, so they sit here. */}
          <div className="compare-fees" data-testid="compare-fees">
            <label className="input-group fee-group">
              {t('calculator.realtorPercentLabel')}
              <span className={`fee-inputs${fee.amountsVisible ? '' : ' percent-only'}`}>
                <span className="input-wrap percent-wrap">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={shared.realtorPercentText}
                    onChange={(event) => actions.updateRealtorPercent(event.target.value)}
                    placeholder={fee.realtorPercentHint ?? undefined}
                    aria-label={t('calculator.realtorPercentLabel')}
                    name="compare-realtor-percent"
                    data-testid="compare-realtor-percent"
                  />
                  <span aria-hidden="true">%</span>
                </span>
                {fee.amountsVisible && (
                  <MoneyInput
                    className="fee-amount-wrap"
                    value={shared.realtorAmountText}
                    onChange={(raw, caret) => actions.updateRealtorAmount(raw, caret)}
                    suffix="₪"
                    placeholder={fee.realtorAmountHint ?? undefined}
                    ariaLabel={t('calculator.realtorAmountLabel')}
                    testId="compare-realtor-amount"
                  />
                )}
              </span>
            </label>
            <label className="input-group fee-group">
              {t('calculator.lawyerPercentLabel')}
              <span className={`fee-inputs${fee.amountsVisible ? '' : ' percent-only'}`}>
                <span className="input-wrap percent-wrap">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={shared.lawyerPercentText}
                    onChange={(event) => actions.updateLawyerPercent(event.target.value)}
                    placeholder={fee.lawyerPercentHint ?? undefined}
                    aria-label={t('calculator.lawyerPercentLabel')}
                    name="compare-lawyer-percent"
                    data-testid="compare-lawyer-percent"
                  />
                  <span aria-hidden="true">%</span>
                </span>
                {fee.amountsVisible && (
                  <MoneyInput
                    className="fee-amount-wrap"
                    value={shared.lawyerAmountText}
                    onChange={(raw, caret) => actions.updateLawyerAmount(raw, caret)}
                    suffix="₪"
                    placeholder={fee.lawyerAmountHint ?? undefined}
                    ariaLabel={t('calculator.lawyerAmountLabel')}
                    testId="compare-lawyer-amount"
                  />
                )}
              </span>
              {fee.lawyerFloorApplied && (
                <small className="fee-floor-note" data-testid="compare-lawyer-floor-note">
                  {t('calculator.lawyerFloorNote', { amount: LAWYER_FLOOR_WITH_VAT })}
                </small>
              )}
            </label>
            <label className="input-group">
              {t('calculator.appraiserFeeLabel')}
              <MoneyInput
                value={shared.appraiserFeeText}
                onChange={(raw, caret) => actions.updateAppraiserFee(raw, caret)}
                suffix="₪"
                ariaLabel={t('calculator.appraiserFeeLabel')}
                testId="compare-appraiser-fee"
              />
            </label>
            <label className="input-group">
              {t('calculator.renovationsLabel')}
              <MoneyInput
                value={shared.renovationAmountText}
                onChange={(raw, caret) => actions.updateRenovationAmount(raw, caret)}
                suffix="₪"
                ariaLabel={t('calculator.renovationsLabel')}
                testId="compare-renovations"
              />
            </label>
            {fee.amountsVisible && (
              <span className="fee-vat-note fee-vat-note-row">{t('calculator.feeVatIncluded')}</span>
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

        {/* Results: one card per scenario, in the same grid as the editors, so
            the comparison reads across matching cards instead of a table. */}
        {isDesktop ? (
          <section className="compare-results" data-testid="compare-results">
            <div className="compare-results-grid">
              {scenarios.map((_, index) =>
                renderResultCard(index, `compare-result-card-${index + 1}`),
              )}
            </div>
          </section>
        ) : (
          /* Mobile: the active scenario's result card, switched by the tabs
             above (same card markup as desktop). */
          <section className="compare-results compare-results-mobile">
            <div className="compare-results-grid">
              {renderResultCard(clampedMobileIndex, 'compare-card')}
            </div>
          </section>
        )}

        {/* Comparison charts: one per metric, two per row, each drawing every
            priced mix so they can be read against each other (payment as the
            calculator's stacked columns). Lives below the cards, full width. */}
        <section
          className="compare-trends"
          data-testid="compare-trends"
          aria-label={t('compare.chartsHeading')}
        >
          <h2>{t('compare.chartsHeading')}</h2>
          <CompareTrendChart series={trendSeries} />
        </section>

        <p className="compare-disclaimer">{t('compare.disclaimer')}</p>
      </main>
    </>
  )
}