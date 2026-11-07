'use client'

import { useState } from 'react'
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
 * The uncommon per-track terms (grace) live behind a disclosure: only a
 * handful of real quotes carry one, and always-visible fields would crowd the
 * six-field track card at 360px. `<details>` is keyboard and touch operable
 * without a custom popover.
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
  const [open, setOpen] = useState(graceMonths > 0)
  const termMonths = Math.max(0, Math.round((Number(termYearsText) || 0) * 12))
  const maxMonths = termMonths > 0 ? termMonths : 1
  const modeKey = (mode: GraceMode) =>
    `graceMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`

  return (
    <details
      className="track-grace"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t('calculator.track.specialTerms')}</summary>
      <div className="track-grace-body">
        <label className="input-group" htmlFor={`${idPrefix}-grace-months`}>
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

        <label className="input-group" htmlFor={`${idPrefix}-grace-mode`}>
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
    </details>
  )
}
