import { beforeEach, describe, expect, it } from 'vitest'
import {
  isMixDirty,
  serializeScenario,
  useCalculatorStore,
  type SavedMixScenario,
  type SavedTrackInput,
} from '@/stores/calculatorStore'
import { MAX_TRACKS } from '@/lib/amortization'

/**
 * The store side of saved mixes: loading one back in, and the unsaved-changes
 * comparison that drives the "leave without saving" warning.
 */

const reset = () => useCalculatorStore.getState().reset()

beforeEach(reset)

const fixed = (amountText: string, yearsText: string, rateText: string): SavedTrackInput => ({
  type: 'fixed',
  amountText,
  yearsText,
  rateText,
  method: 'spitzer',
})

describe('unsaved-changes baseline', () => {
  it('starts clean and becomes dirty on an edit', () => {
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)

    useCalculatorStore.getState().setTermYears(20)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('clears once the mix is marked saved', () => {
    useCalculatorStore.getState().setTermYears(20)
    useCalculatorStore.getState().markMixSaved()
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('treats a reset as a clean state, not unsaved work', () => {
    useCalculatorStore.getState().setTermYears(20)
    useCalculatorStore.getState().reset()
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('flags a scenario-only change that leaves the tracks alone (income)', () => {
    // Income is stored with the mix, so editing it is work that leaving would
    // throw away. The baseline therefore covers the scenario, not just the
    // tracks (it used to ignore this, which left the save control claiming
    // "saved" after a change).
    useCalculatorStore.getState().setIncome('30,000', null)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('flags an appraiser-fee change (regression)', () => {
    // Reported bug: editing the appraiser fee left the control showing the
    // saved state, because only the tracks/term were compared.
    useCalculatorStore.getState().updateAppraiserFee('2,400', null)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('flags a renovation change', () => {
    useCalculatorStore.getState().updateRenovationAmount('80,000', null)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('flags a realtor fee amount change (whose percent side is persisted)', () => {
    // The ₪ field is derived from the fee basis (the property value), so it
    // only rewrites the persisted percent once a property value exists.
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    useCalculatorStore.getState().markMixSaved()
    useCalculatorStore.getState().updateRealtorAmount('30,000', null)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('flags adding an other-expense row', () => {
    useCalculatorStore.getState().addOtherExpense()
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('flags a scenario change that re-balances the mix (property value)', () => {
    // The property field drives the loan, which re-balances the tracks: the
    // mix itself really did change, so this is unsaved work, not a false alarm.
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })
})

describe('click-driven mix changes are not unsaved work', () => {
  it('stays clean after picking a different preset', () => {
    useCalculatorStore.getState().reset()
    useCalculatorStore.getState().loadPreset('basket1')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('stays clean after adding a track', () => {
    useCalculatorStore.getState().reset()
    // basket1 is a single track, so addTrack actually does something here.
    useCalculatorStore.getState().loadPreset('basket1')
    useCalculatorStore.getState().addTrack()
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('stays clean after removing a track', () => {
    useCalculatorStore.getState().reset()
    useCalculatorStore.getState().loadPreset('basket2')
    const id = useCalculatorStore.getState().tracks[0].id
    useCalculatorStore.getState().removeTrack(id)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('stays clean after switching a track type', () => {
    useCalculatorStore.getState().reset()
    const id = useCalculatorStore.getState().tracks[0].id
    useCalculatorStore.getState().changeTrackType(id, 'fixed')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('keeps a typed mix dirty when a preset is picked afterwards', () => {
    useCalculatorStore.getState().setTermYears(20)
    useCalculatorStore.getState().loadPreset('basket1')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })
})

describe('live market data is not unsaved work', () => {
  it('stays clean when the prime rate seeds an untouched track', () => {
    // Otherwise merely opening the calculator would make the mix look dirty
    // as soon as the live rate query resolved, and every navigation away
    // would raise the unsaved-changes warning.
    useCalculatorStore.getState().reset()
    useCalculatorStore.getState().applyPrimeRate(4.5)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('keeps a genuinely edited mix dirty when the rate arrives', () => {
    useCalculatorStore.getState().setTermYears(20)
    useCalculatorStore.getState().applyPrimeRate(4.5)
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })
})

describe('loadSavedMix', () => {
  it('replaces the tracks, term and baseline', () => {
    useCalculatorStore.getState().loadSavedMix([fixed('250,000', '30', '4.8')], 30)

    const state = useCalculatorStore.getState()
    expect(state.tracks).toHaveLength(1)
    expect(state.tracks[0].type).toBe('fixed')
    expect(state.tracks[0].amountText).toBe('250,000')
    expect(state.tracks[0].yearsText).toBe('30')
    expect(state.tracks[0].rateText).toBe('4.8')
    expect(state.tracks[0].method).toBe('spitzer')
    expect(state.termYears).toBe(30)
    expect(state.activePreset).toBeNull()
    expect(isMixDirty(state)).toBe(false)
  })

  it('mirrors the loan field from the tracks when no property is entered', () => {
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8'), fixed('50,000', '30', '5')], 30)
    expect(useCalculatorStore.getState().startingAmountText).toBe('150,000')
  })

  it('keeps a property-derived loan untouched', () => {
    useCalculatorStore.getState().setPropertyValue('2,000,000', null)
    useCalculatorStore.getState().setCapital('500,000', null)
    const derived = useCalculatorStore.getState().startingAmountText

    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30)
    expect(useCalculatorStore.getState().startingAmountText).toBe(derived)
  })

  it('gives every loaded track a fresh editor id', () => {
    // Same payload twice: ids come from the editor, not from the saved mix,
    // so two loads of the same mix never share track ids.
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30)
    const first = useCalculatorStore.getState().tracks[0].id
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30)
    expect(useCalculatorStore.getState().tracks[0].id).not.toBe(first)
  })

  it('never grows the editor past MAX_TRACKS', () => {
    const many = Array.from({ length: MAX_TRACKS + 2 }, () => fixed('100,000', '30', '4.8'))
    useCalculatorStore.getState().loadSavedMix(many, 30)
    expect(useCalculatorStore.getState().tracks).toHaveLength(MAX_TRACKS)
  })
})

describe('loadSavedMix with a scenario', () => {
  const scenario: SavedMixScenario = {
    startingAmountText: '1,200,000',
    propertyValueText: '1,800,000',
    capitalText: '600,000',
    incomeText: '28,000',
    purpose: 'upgrade',
    realtorPercentText: '2',
    lawyerPercentText: '',
    appraiserFeeText: '1,500',
    renovationAmountText: '50,000',
    otherExpenses: [{ label: 'רכב', amountText: '1,200', oneTimeAmountText: '0' }],
    ptiThresholdPercent: 35,
  }

  it('restores every scenario input alongside the mix', () => {
    useCalculatorStore.getState().loadSavedMix([fixed('250,000', '30', '4.8')], 30, scenario)

    const state = useCalculatorStore.getState()
    expect(state.propertyValueText).toBe('1,800,000')
    expect(state.capitalText).toBe('600,000')
    expect(state.incomeText).toBe('28,000')
    expect(state.purpose).toBe('upgrade')
    expect(state.realtorPercentText).toBe('2')
    expect(state.appraiserFeeText).toBe('1,500')
    expect(state.renovationAmountText).toBe('50,000')
    expect(state.ptiThresholdPercent).toBe(35)
    expect(state.otherExpenses).toHaveLength(1)
    expect(state.otherExpenses[0].amountText).toBe('1,200')
    // A fresh editor id, not the (id-less) saved shape.
    expect(state.otherExpenses[0].id).toBeTruthy()
    expect(isMixDirty(state)).toBe(false)
  })

  it('leaves the entered starting amount alone instead of mirroring the tracks', () => {
    // With a scenario the loan field is part of the saved state, so it must
    // not be re-derived from the tracks the way a bare mix load does.
    useCalculatorStore.getState().loadSavedMix([fixed('250,000', '30', '4.8')], 30, scenario)
    expect(useCalculatorStore.getState().startingAmountText).toBe('1,200,000')
  })

  it('round-trips what serializeScenario captures', () => {
    const original = useCalculatorStore.getState()
    const captured = serializeScenario(original)

    useCalculatorStore.getState().reset()
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30, captured)

    const restored = useCalculatorStore.getState()
    expect(restored.propertyValueText).toBe(original.propertyValueText)
    expect(restored.capitalText).toBe(original.capitalText)
    expect(restored.incomeText).toBe(original.incomeText)
    expect(restored.purpose).toBe(original.purpose)
    expect(restored.ptiThresholdPercent).toBe(original.ptiThresholdPercent)
  })
})

describe('loaded mix identity (update in place)', () => {
  it('remembers the saved mix it was loaded from', () => {
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1')
    expect(useCalculatorStore.getState().loadedMixId).toBe('mix-1')
  })

  it('carries the saved mix name alongside its id', () => {
    useCalculatorStore
      .getState()
      .loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1', 'First home')
    expect(useCalculatorStore.getState().loadedMixLabel).toBe('First home')
  })

  it('detaches from the saved mix when a preset is picked', () => {
    useCalculatorStore
      .getState()
      .loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1', 'First home')
    useCalculatorStore.getState().loadPreset('basket4')
    expect(useCalculatorStore.getState().loadedMixId).toBeNull()
    expect(useCalculatorStore.getState().loadedMixLabel).toBeNull()
  })

  it('keeps the loaded mix across a reset and marks the reset as unsaved', () => {
    useCalculatorStore
      .getState()
      .loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1', 'First home')
    useCalculatorStore.getState().reset()
    expect(useCalculatorStore.getState().loadedMixId).toBe('mix-1')
    expect(useCalculatorStore.getState().loadedMixLabel).toBe('First home')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(true)
  })

  it('detachMix drops the identity but keeps the numbers', () => {
    useCalculatorStore
      .getState()
      .loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1', 'First home')
    useCalculatorStore.getState().detachMix()
    expect(useCalculatorStore.getState().loadedMixId).toBeNull()
    expect(useCalculatorStore.getState().loadedMixLabel).toBeNull()
    // The mix itself is untouched, so it is still the same baseline.
    expect(useCalculatorStore.getState().tracks[0].amountText).toBe('100,000')
    expect(isMixDirty(useCalculatorStore.getState())).toBe(false)
  })

  it('records the saved label on a rename without detaching', () => {
    useCalculatorStore
      .getState()
      .loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1', 'Old name')
    useCalculatorStore.getState().markMixSaved('mix-1', 'New name')
    expect(useCalculatorStore.getState().loadedMixId).toBe('mix-1')
    expect(useCalculatorStore.getState().loadedMixLabel).toBe('New name')
  })

  it('adopts the id of a freshly created mix once it is saved', () => {
    useCalculatorStore.getState().markMixSaved('new-mix')
    expect(useCalculatorStore.getState().loadedMixId).toBe('new-mix')
  })

  it('keeps the loaded mix when only the baseline is rebaselined', () => {
    useCalculatorStore.getState().loadSavedMix([fixed('100,000', '30', '4.8')], 30, null, 'mix-1')
    useCalculatorStore.getState().markMixSaved()
    expect(useCalculatorStore.getState().loadedMixId).toBe('mix-1')
  })
})
