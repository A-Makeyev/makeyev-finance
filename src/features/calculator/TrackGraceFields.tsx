'use client'

import { useTranslation } from 'react-i18next'
import { FlipSelect } from '@/components/ui/FlipSelect'
import { HelpTooltip } from '@/components/ui/HelpTooltip'
import { GRACE_MODES, type GraceMode } from '@/lib/amortization'

interface TrackGraceFieldsProps {
  graceMonths: number
  graceMode: GraceMode
  termYearsText: string
  onChangeMonths: (months: number) => void
  onChangeMode: (mode: GraceMode) => void
  idPrefix: string
  testIdPrefix: string
}

/**
 * The per-track grace terms are always visible: a grace period changes the
 * payment and the income check, so it should not hide behind a disclosure the
 * reader may never open. Both fields join the shared responsive track grid
 * on the calculator and comparison pages.
 */
export function TrackGraceFields({
  graceMonths,
  graceMode,
  termYearsText,
  onChangeMonths,
  onChangeMode,
  idPrefix,
  testIdPrefix,
}: TrackGraceFieldsProps) {
  const { t } = useTranslation()
  const termMonths = Math.max(0, Math.round((Number(termYearsText) || 0) * 12))
  const maxMonths = termMonths > 0 ? termMonths : 1
  const modeKey = (mode: GraceMode) =>
    `graceMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`

  return (
    <div className="track-grace">
      <div className="track-grace-body">
        <label className="input-group track-grace-months" htmlFor={`${idPrefix}-grace-months`}>
          <span className="label-help-row">
            <span className="label-help-text">{t('calculator.track.graceMonthsLabel')}</span>
            <HelpTooltip
              label={t('calculator.help.graceAria')}
              content={t('calculator.help.grace')}
              testId={`${testIdPrefix}-help-grace`}
            />
          </span>
          <div className="input-wrap">
            <input
              id={`${idPrefix}-grace-months`}
              type="number"
              inputMode="numeric"
              min={0}
              max={maxMonths}
              step={1}
              value={graceMonths}
              onInput={(event) => {
                const value = Number(event.currentTarget.value)
                onChangeMonths(Number.isFinite(value) ? value : 0)
              }}
              aria-label={t('calculator.track.graceMonthsLabel')}
              name={`${idPrefix}-grace-months`}
              data-testid={`${testIdPrefix}-grace-months`}
            />
            <span>{t('calculator.track.graceMonthsSuffix')}</span>
          </div>
        </label>

        <label className="input-group track-grace-mode" htmlFor={`${idPrefix}-grace-mode`}>
          <span className="label-help-row">
            <span className="label-help-text">{t('calculator.track.graceModeLabel')}</span>
          </span>
          <FlipSelect
            value={graceMode}
            onChange={(value) => onChangeMode(value as GraceMode)}
            selectId={`${idPrefix}-grace-mode`}
            testId={`${testIdPrefix}-grace-mode`}
          >
            {GRACE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`calculator.track.${modeKey(mode)}`)}
              </option>
            ))}
          </FlipSelect>
        </label>
      </div>
    </div>
  )
}
