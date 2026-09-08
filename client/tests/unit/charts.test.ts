import { describe, expect, it } from 'vitest'
import {
  alignedDualTicks,
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

  it('drops the max tick when its axis label matches the last round tick', () => {
    // A ~8.2K payment max: the round grid ends at 7,500 (2.5K step) and the
    // true max passes the quarter-step overlap check, but ₪7,500 and ₪8,200
    // both print as "₪8K" - the axis showed the same label twice. The max
    // tick only stays when its label differs from the one below it.
    const ticks = niceTicks(8_200)
    expect(ticks).toEqual([0, 2_500, 5_000, 7_500])
    expect(new Set(ticks.map((tick) => formatAxisShekel(tick))).size).toBe(ticks.length)
  })

  it('keeps the max tick when its label differs from the last round tick', () => {
    // 9K clears 7,500 by a full step and prints as ₪9K - a distinct label.
    expect(niceTicks(9_000)).toEqual([0, 2_500, 5_000, 7_500, 9_000])
  })
})

describe('alignedDualTicks', () => {
  it('gives both axes the same gridline rows on a typical loan', () => {
    // 60K yearly payments vs 800K balance: 4 intervals wins (payments step
    // 20K with an 80K top; balance keeps 200K steps) - the alternative
    // counts force one axis into 50%+ headroom.
    const result = alignedDualTicks(60_000, 800_000)
    expect(result).not.toBeNull()
    expect(result!.intervals).toBe(4)
    expect(result!.paymentTicks).toEqual([0, 20_000, 40_000, 60_000, 80_000])
    expect(result!.balanceTicks).toEqual([0, 200_000, 400_000, 600_000, 800_000])
    expect(result!.scaleMaxPayment).toBe(80_000)
    expect(result!.scaleMaxBalance).toBe(800_000)
    // No series clips above the top gridline.
    expect(result!.scaleMaxPayment).toBeGreaterThanOrEqual(60_000)
    expect(result!.scaleMaxBalance).toBeGreaterThanOrEqual(800_000)
  })

  it('places both tick sets at identical fractions of their scale tops', () => {
    // The property the whole alignment is for: tick i sits at i/intervals
    // on both axes, so the solid and dashed gridlines coincide.
    const result = alignedDualTicks(60_000, 800_000)!
    expect(result.paymentTicks).toHaveLength(result.balanceTicks.length)
    result.paymentTicks.forEach((tick, index) => {
      expect(tick / result.scaleMaxPayment).toBeCloseTo(
        result.balanceTicks[index] / result.scaleMaxBalance,
      )
    })
  })

  it('uses a 2.5-family step when that lands both scales exactly on their max', () => {
    // 50K payments / 2.5M balance: 5 intervals gives both axes zero
    // headroom (10K and 500K steps) - no other count comes close.
    const result = alignedDualTicks(50_000, 2_500_000)
    expect(result!.intervals).toBe(5)
    expect(result!.paymentTicks).toEqual([0, 10_000, 20_000, 30_000, 40_000, 50_000])
    expect(result!.balanceTicks).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000])
    expect(result!.scaleMaxPayment).toBe(50_000)
    expect(result!.scaleMaxBalance).toBe(2_500_000)
  })

  it('skips a count whose axis labels collide (1,500 and 2,000 both print "₪2K")', () => {
    // 1,800 payments / 5,000 balance: 4-7 intervals snap the payments step
    // to 500, whose grid puts 1,500 and 2,000 on the axis - both print
    // "₪2K". Those counts are disqualified, so the search falls back to 2
    // intervals (1K / 2.5K steps), the least-headroom collision-free one.
    const result = alignedDualTicks(1_800, 5_000)
    expect(result!.intervals).toBe(2)
    expect(result!.paymentTicks).toEqual([0, 1_000, 2_000])
    expect(result!.balanceTicks).toEqual([0, 2_500, 5_000])
    // Whatever the inputs, the winner never repeats an axis label.
    const paymentLabels = result!.paymentTicks.map((tick) => formatAxisShekel(tick))
    const balanceLabels = result!.balanceTicks.map((tick) => formatAxisShekel(tick))
    expect(new Set(paymentLabels).size).toBe(paymentLabels.length)
    expect(new Set(balanceLabels).size).toBe(balanceLabels.length)
  })

  it('breaks a headroom tie toward the target count', () => {
    // Equal maxima: 2 and 4 intervals both land exactly on the max; the
    // one closer to the target of 4 wins.
    const result = alignedDualTicks(100_000, 100_000)
    expect(result!.intervals).toBe(4)
    expect(result!.paymentTicks).toEqual([0, 25_000, 50_000, 75_000, 100_000])
    expect(result!.balanceTicks).toEqual([0, 25_000, 50_000, 75_000, 100_000])
  })

  it('returns null for unusable maxima (caller falls back to niceTicks)', () => {
    expect(alignedDualTicks(0, 800_000)).toBeNull()
    expect(alignedDualTicks(60_000, 0)).toBeNull()
    expect(alignedDualTicks(Number.NaN, 800_000)).toBeNull()
    expect(alignedDualTicks(60_000, Number.POSITIVE_INFINITY)).toBeNull()
    expect(alignedDualTicks(-5, 800_000)).toBeNull()
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
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
    ])
  })

  it('steps to every 2nd year past 18 rows, keeping minor ticks', () => {
    const ticks = xAxisTicks(30, false)
    const labeled = ticks.filter((tick) => tick.label !== null)
    expect(labeled.map((tick) => tick.label)).toEqual([
      '1',
      '3',
      '5',
      '7',
      '9',
      '11',
      '13',
      '15',
      '17',
      '19',
      '21',
      '23',
      '25',
      '27',
      '29',
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
