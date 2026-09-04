import { describe, expect, it } from 'vitest'
import {
  arcPath,
  donutSegments,
  formatAxisShekel,
  midAngle,
  niceTicks,
  xAxisTicks,
} from '../../src/lib/charts'

describe('formatAxisShekel', () => {
  it('abbreviates millions, thousands and plain shekels', () => {
    expect(formatAxisShekel(1_500_000)).toBe('₪1.5M')
    expect(formatAxisShekel(1_000_000)).toBe('₪1M')
    expect(formatAxisShekel(250_000)).toBe('₪250K')
    expect(formatAxisShekel(750)).toBe('₪750')
    expect(formatAxisShekel(0)).toBe('₪0')
  })

  it('rounds thousands away from sub-1000 noise', () => {
    expect(formatAxisShekel(333_333)).toBe('₪333K')
  })
})

describe('niceTicks', () => {
  it('picks round steps covering the range', () => {
    expect(niceTicks(1_000_000)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000])
    expect(niceTicks(900_000)).toEqual([0, 250_000, 500_000, 750_000, 900_000])
  })

  it('starts at zero and handles a zero max', () => {
    expect(niceTicks(0)).toEqual([0])
    const ticks = niceTicks(100)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(100)
  })

  it('prefers whole steps and lands the max on top', () => {
    expect(niceTicks(5)).toEqual([0, 2, 4, 5])
  })

  it('uses 2.5 steps when the range divides evenly into them', () => {
    expect(niceTicks(10)).toEqual([0, 2.5, 5, 7.5, 10])
  })

  it('drops the max label when it would overlap the last round tick', () => {
    // A 103K max: the round grid ends at 100K (50K step) and appending 103K
    // printed ₪103K directly on top of ₪100K - the axis now ends on the
    // round tick instead.
    expect(niceTicks(103_000)).toEqual([0, 50_000, 100_000])
  })

  it('still shows the true max when it clears the round grid', () => {
    expect(niceTicks(140_000)).toEqual([0, 50_000, 100_000, 140_000])
  })
})

describe('donutSegments', () => {
  it('slices clockwise from 12 oclock', () => {
    const segments = donutSegments([1, 1, 2])
    expect(segments.map((segment) => segment.fraction)).toEqual([0.25, 0.25, 0.5])
    // First slice starts at -90° (12 o'clock).
    expect(segments[0].startAngle).toBeCloseTo(-Math.PI / 2)
    // Slices advance clockwise without gaps or overlaps.
    expect(segments[1].startAngle).toBeCloseTo(segments[0].endAngle)
    expect(segments[2].startAngle).toBeCloseTo(segments[1].endAngle)
    expect(segments[2].endAngle).toBeCloseTo((3 * Math.PI) / 2)
  })

  it('returns nothing for an empty or zero total', () => {
    expect(donutSegments([])).toEqual([])
    expect(donutSegments([0, 0])).toEqual([])
  })

  it('clamps negative values to zero share', () => {
    const segments = donutSegments([-5, 10])
    expect(segments[0].fraction).toBe(0)
    expect(segments[1].fraction).toBe(1)
  })
})

describe('arcPath', () => {
  it('draws a unit donut slice with outer and inner arcs', () => {
    const path = arcPath(0, 0, 10, 5, 0, Math.PI / 2)
    expect(path).toContain('M 10 0')
    expect(path).toContain('A 10 10 0 0 1')
    expect(path).toContain('A 5 5 0 0 0')
    expect(path.trim().endsWith('Z')).toBe(true)
  })

  it('keeps a full-circle slice visible by clamping the sweep', () => {
    const path = arcPath(0, 0, 10, 5, 0, Math.PI * 2)
    // Endpoints differ by the tiny clamp, so the arc renders.
    expect(path).toContain(`A 10 10 0 1 1`)
    expect(path).not.toBe('')
  })
})

describe('midAngle', () => {
  it('averages the two angles', () => {
    expect(midAngle(0, Math.PI)).toBeCloseTo(Math.PI / 2)
  })
})

describe('xAxisTicks', () => {
  it('labels every year for typical 15-18 year terms', () => {
    const ticks = xAxisTicks(17, false)
    expect(ticks.map((tick) => tick.label)).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17',
    ])
  })

  it('steps to every 2nd year past 18 rows, keeping minor ticks', () => {
    const ticks = xAxisTicks(30, false)
    const labeled = ticks.filter((tick) => tick.label !== null)
    expect(labeled.map((tick) => tick.label)).toEqual([
      '1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23', '25', '27', '29',
    ])
    // Minor ticks fill the gaps.
    expect(ticks.length).toBe(30)
  })

  it('monthly view labels year boundaries with half-year minor ticks', () => {
    const ticks = xAxisTicks(24, true)
    const labeled = ticks.filter((tick) => tick.label !== null)
    expect(labeled.map((tick) => tick.label)).toEqual(['1', '2'])
    // Month 6 and 18 are the unlabeled minor ticks.
    expect(ticks.length).toBe(4)
  })
})
