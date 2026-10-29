import { useTranslation } from 'react-i18next'
import {
  MAX_RATE_PERCENT,
  MAX_YEARS,
  TRACK_TYPES,
  type AmortizationMethod,
  type TrackType,
} from '@/lib/amortization'
import { useCalculatorStore, type TrackState } from '@/stores/calculatorStore'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { cn } from '@/lib/cn'

/**
 * One mortgage track fieldset - semantic fieldset/legend structure preserved
 * from the legacy addTrack() DOM (calculator.js:244-257); all styling comes
 * from the verbatim calculators.css port.
 */
export function TrackForm({ track, index }: { track: TrackState; index: number }) {
  const { t } = useTranslation()
  const flagged = useCalculatorStore((s) => s.flaggedTrackIds.includes(track.id))
  const rebalanced = useCalculatorStore((s) => s.rebalancedTrackIds.includes(track.id))
  const updateTrackAmount = useCalculatorStore((s) => s.updateTrackAmount)
  const commitTrackAmountBlur = useCalculatorStore((s) => s.commitTrackAmountBlur)
  const updateTrackYears = useCalculatorStore((s) => s.updateTrackYears)
  const commitTrackYearsBlur = useCalculatorStore((s) => s.commitTrackYearsBlur)
  const updateTrackRate = useCalculatorStore((s) => s.updateTrackRate)
  const commitTrackRateBlur = useCalculatorStore((s) => s.commitTrackRateBlur)
  const updateTrackMargin = useCalculatorStore((s) => s.updateTrackMargin)
  const primeRate = useCalculatorStore((s) => s.primeRate)
  const changeTrackType = useCalculatorStore((s) => s.changeTrackType)
  const changeTrackMethod = useCalculatorStore((s) => s.changeTrackMethod)
  const removeTrack = useCalculatorStore((s) => s.removeTrack)

  /**
   * A prime track's margin is its rate minus the prime rate, so the live Bank
   * of Israel rate can suggest it. Other tracks' margins are a spread over a
   * bank-set reference rate the app does not hold, so they get no suggestion.
   */
  const primeMarginSuggestion = (() => {
    if (track.type !== 'prime' || primeRate === null) return ''
    const enteredRate = Number.parseFloat(track.rateText)
    if (!Number.isFinite(enteredRate)) return ''
    const margin = enteredRate - primeRate
    if (!Number.isFinite(margin) || margin <= 0) return ''
    return margin.toFixed(2)
  })()

  return (
    <fieldset
      data-testid={`track-${index + 1}`}
      className={cn('mortgage-track', flagged && 'variable-limit-flag', rebalanced && 'track-rebalanced')}
    >
      <legend className={flagged ? 'variable-limit-flag' : undefined}>
        {t('calculator.track.legend', { index: index + 1 })}
      </legend>

      <button
        type="button"
        className="remove-track"
        aria-label={t('calculator.track.removeAria')}
        data-testid={`remove-track-${index + 1}`}
        onClick={() => removeTrack(track.id)}
      >
        ×
      </button>

      <label className="input-group" htmlFor={`track-type-${track.id}`}>
        {/* htmlFor must name the select, not rely on nesting: the first
            labelable descendant is the tooltip's "?" button, so the implicit
            association hijacks hover and clicks from the label onto that
            button (phantom border recolor near the icon). Text + icon stay in
            one atomic row: in the narrow fieldset columns the label text may
            wrap, but the "?" never strands on its own line. */}
        <span className="label-help-row">
          <span className="label-help-text">{t('calculator.track.typeLabel')}</span>
          {/* Per-type body: the tip describes the track type selected in this
              track's own select, so it switches as the select changes. */}
          <HelpTooltip
            label={t('calculator.help.trackTypeAria')}
            content={t(`calculator.help.trackTypes.${track.type}`)}
            linkTo="/articles/mortgage-track-types"
            linkLabel={t('calculator.help.readMore')}
            testId={`help-track-type-${index + 1}`}
          />
        </span>
        <FlipSelect
          value={track.type}
          onChange={(value) => changeTrackType(track.id, value as TrackType)}
          className="track-type"
          selectId={`track-type-${track.id}`}
          testId={`track-type-${index + 1}`}
        >
          {TRACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`calculator.trackTypes.${type}`)}
            </option>
          ))}
        </FlipSelect>
      </label>

      <label className="input-group">
        {t('calculator.track.amountLabel')}
        <MoneyInput
          value={track.amountText}
          onChange={(raw, caret) => updateTrackAmount(track.id, raw, caret)}
          onBlur={() => commitTrackAmountBlur(track.id)}
          suffix="₪"
          ariaLabel={t('calculator.track.amountLabel')}
          testId={`track-amount-${index + 1}`}
        />
      </label>

      <label className="input-group">
        {t('calculator.track.yearsLabel')}
        <div className="input-wrap">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_YEARS}
            step={1}
            value={track.yearsText}
            onInput={(event) => updateTrackYears(track.id, event.currentTarget.value)}
            onBlur={() => commitTrackYearsBlur(track.id)}
            required
            aria-label={`${t('calculator.track.yearsLabel')} ${index + 1}`}
            name={`track-years-${index + 1}`}
            data-testid={`track-years-${index + 1}`}
          />
          <span>{t('calculator.track.yearsSuffix')}</span>
        </div>
      </label>

      <label className="input-group">
        {t('calculator.track.rateLabel')}
        <div className="input-wrap">
          <input
            type="number"
            min={0}
            max={MAX_RATE_PERCENT}
            step={0.01}
            value={track.rateText}
            onInput={(event) => updateTrackRate(track.id, event.currentTarget.value)}
            onBlur={() => commitTrackRateBlur(track.id)}
            required
            aria-label={`${t('calculator.track.rateLabel')} ${index + 1}`}
            name={`track-rate-${index + 1}`}
            data-testid={`track-rate-${index + 1}`}
          />
          <span>%</span>
        </div>
      </label>

      <label className="input-group" htmlFor={`track-margin-${track.id}`}>
        {/* Explicit htmlFor, like the type and method selects: the tooltip's
            "?" button must not become the label's implicit control. */}
        <span className="label-help-row">
          <span className="label-help-text">{t('calculator.track.marginLabel')}</span>
          <HelpTooltip
            label={t('calculator.help.marginAria')}
            content={t('calculator.help.margin')}
            testId={`help-margin-${index + 1}`}
          />
        </span>
        <div className="input-wrap">
          <input
            id={`track-margin-${track.id}`}
            type="number"
            min={0}
            max={MAX_RATE_PERCENT}
            step={0.01}
            value={track.marginText ?? ''}
            onInput={(event) => updateTrackMargin(track.id, event.currentTarget.value)}
            // Suggested, not entered: on a prime track the margin is the
            // tracked rate minus the live prime rate. Kept as a placeholder so
            // a suggestion never turns into saved state the reader did not set.
            placeholder={primeMarginSuggestion || undefined}
            aria-label={`${t('calculator.track.marginLabel')} ${index + 1}`}
            name={`track-margin-${index + 1}`}
            data-testid={`track-margin-${index + 1}`}
          />
          <span>%</span>
        </div>
      </label>

      <label className="input-group" htmlFor={`track-method-${track.id}`}>
        {/* Same htmlFor binding as the type select above: the tooltip button
            must not become the label's control. */}
        <span className="label-help-row">
          <span className="label-help-text">{t('calculator.track.methodLabel')}</span>
          <HelpTooltip
            label={t('calculator.help.methodAria')}
            content={t('calculator.help.method')}
            linkTo="/articles/mortgage-decisions"
            linkLabel={t('calculator.help.readMore')}
            testId={`help-method-${index + 1}`}
          />
        </span>
        <FlipSelect
          value={track.method}
          onChange={(value) => changeTrackMethod(track.id, value as AmortizationMethod)}
          className="track-method"
          selectId={`track-method-${track.id}`}
          testId={`track-method-${index + 1}`}
        >
          <option value="spitzer">{t('calculator.track.methodSpitzer')}</option>
          <option value="equalPrincipal">{t('calculator.track.methodEqualPrincipal')}</option>
        </FlipSelect>
      </label>
    </fieldset>
  )
}
