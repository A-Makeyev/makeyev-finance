import { useTranslation } from 'react-i18next'
import { PRESET_IDS, type PresetId } from '@/lib/amortization'
import { useCalculatorStore } from '@/stores/calculatorStore'

const PRESET_LABEL_KEYS: Record<PresetId, string> = {
  basket1: 'calculator.presetBasket1',
  basket2: 'calculator.presetBasket2',
  basket3: 'calculator.presetBasket3',
  basket4: 'calculator.presetBasket4',
}

/** Preset "basket" buttons — legacy .preset-button active highlight. */
export function PresetSelector() {
  const { t } = useTranslation()
  const activePreset = useCalculatorStore((s) => s.activePreset)
  const loadPreset = useCalculatorStore((s) => s.loadPreset)

  return (
    <>
      <div className="preset-heading">
        <span>{t('calculator.presetHeading')}</span>
      </div>
      <div className="preset-list" role="group" aria-label={t('calculator.presetHeading')}>
        {PRESET_IDS.map((presetId) => (
          <button
            key={presetId}
            type="button"
            data-preset={presetId}
            data-testid={`preset-${presetId}`}
            aria-pressed={activePreset === presetId}
            className={activePreset === presetId ? 'preset-button active' : 'preset-button'}
            onClick={() => loadPreset(presetId)}
          >
            {t(PRESET_LABEL_KEYS[presetId])}
          </button>
        ))}
      </div>
    </>
  )
}
