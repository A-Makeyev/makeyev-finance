import { useTranslation } from 'react-i18next'
import { TRACK_TYPES, type AmortizationMethod, type TrackType } from '@/lib/amortization'
import { useCalculatorStore, type TrackState } from '@/stores/calculatorStore'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { cn } from '@/lib/cn'

/**
 * One mortgage track fieldset - semantic fieldset/legend structure preserved
 * from the legacy addTrack() DOM (calculator.js:244-257); all styling comes
 * from the verbatim calculators.css port.
 */
export function TrackForm({ track, index }: { track: TrackState; index: number }) {
  const { t } = useTranslation()
  const flagged = useCalculatorStore((s) => s.flaggedTrackIds.includes(track.id))
  const updateTrackAmount = useCalculatorStore((s) => s.updateTrackAmount)
  const commitTrackAmountBlur = useCalculatorStore((s) => s.commitTrackAmountBlur)
  const updateTrackYears = useCalculatorStore((s) => s.updateTrackYears)
  const commitTrackYearsBlur = useCalculatorStore((s) => s.commitTrackYearsBlur)
  const updateTrackRate = useCalculatorStore((s) => s.updateTrackRate)
  const commitTrackRateBlur = useCalculatorStore((s) => s.commitTrackRateBlur)
  const changeTrackType = useCalculatorStore((s) => s.changeTrackType)
  const changeTrackMethod = useCalculatorStore((s) => s.changeTrackMethod)
  const removeTrack = useCalculatorStore((s) => s.removeTrack)

  return (
    <fieldset
      data-testid={`track-${index + 1}`}
      className={cn('mortgage-track', flagged && 'variable-limit-flag')}
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

      <label className="input-group">
        {t('calculator.track.typeLabel')}
        <FlipSelect
          value={track.type}
          onChange={(value) => changeTrackType(track.id, value as TrackType)}
          className="track-type"
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
          suffix=""
          ariaLabel={t('calculator.track.amountLabel')}
          testId={`track-amount-${index + 1}`}
        />
      </label>

      <label className="input-group">
        {t('calculator.track.yearsLabel')}
        <div className="input-wrap">
          <input
            type="text"
            inputMode="numeric"
            value={track.yearsText}
            onInput={(event) => {
              const element = event.currentTarget
              element.value = updateTrackYears(track.id, element.value)
            }}
            onBlur={() => commitTrackYearsBlur(track.id)}
            required
            aria-label={`${t('calculator.track.yearsLabel')} ${index + 1}`}
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
            max={30}
            step={0.01}
            value={track.rateText}
            onInput={(event) => updateTrackRate(track.id, event.currentTarget.value)}
            onBlur={() => commitTrackRateBlur(track.id)}
            required
            aria-label={`${t('calculator.track.rateLabel')} ${index + 1}`}
            data-testid={`track-rate-${index + 1}`}
          />
          <span>%</span>
        </div>
      </label>

      <label className="input-group">
        {t('calculator.track.methodLabel')}
        <FlipSelect
          value={track.method}
          onChange={(value) => changeTrackMethod(track.id, value as AmortizationMethod)}
          className="track-method"
          testId={`track-method-${index + 1}`}
        >
          <option value="spitzer">{t('calculator.track.methodSpitzer')}</option>
          <option value="equalPrincipal">{t('calculator.track.methodEqualPrincipal')}</option>
        </FlipSelect>
      </label>
    </fieldset>
  )
}
