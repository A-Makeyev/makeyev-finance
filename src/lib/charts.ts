/**
 * Pure chart geometry - axis ticks, donut arc paths and axis label
 * formatting. No DOM, no dependencies; see tests/unit/charts.test.ts.
 */

/** Short ₪ label for chart axes: ₪1.5M / ₪250K / ₪750 - never full digits. */
export function formatAxisShekel(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '₪0'
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000
    const text = Number.isInteger(millions) ? String(millions) : millions.toFixed(1)
    return `₪${text}M`
  }
  if (Math.abs(value) >= 1_000) return `₪${Math.round(value / 1_000)}K`
  return `₪${Math.round(value)}`
}

/**
 * "Nice" axis ticks from 0 to `max` (inclusive): picks a step from the
 * 1/2/2.5/5×10ⁿ families so labels stay round. Always returns 0 first, plus
 * `max` itself only when it sits on the grid or clears the last round tick
 * by a quarter step (closer than that, its label would overlap).
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  const rawStep = max / Math.max(1, targetCount)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  const factor =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10
  const step = factor * magnitude
  const ticks: number[] = []
  for (let tick = 0; tick <= max + step * 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)))
  }
  // The axis can end above the last round tick - show the true max too,
  // but only when it stays legible: it must clear the last round tick by
  // at least a quarter step (any closer and its label prints on top of the
  // round one below), and its abbreviated label must differ from that
  // tick's (₪7,500 and ₪8,200 both print "₪8K", which read as the same
  // payment shown twice). Failing either check, the round tick stays the
  // top label, just shy of the plot's top edge.
  const last = ticks[ticks.length - 1]
  if (max - last > step * 0.25 && formatAxisShekel(max) !== formatAxisShekel(last)) {
    ticks.push(Number(max.toFixed(6)))
  }
  return ticks
}

/** Smallest "nice" step (1/2/2.5/5×10ⁿ) that is >= value. */
function niceStepUp(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const residual = value / magnitude
  const factor =
    residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10
  return factor * magnitude
}

/** Evenly stepped gridline values 0..step × intervals (`intervals` slices). */
function axisTicks(step: number, intervals: number): number[] {
  const ticks: number[] = []
  for (let index = 0; index <= intervals; index++) {
    ticks.push(Number((index * step).toFixed(6)))
  }
  return ticks
}

/** True when any two ticks on the axis print the same abbreviated label. */
function hasDuplicateLabels(ticks: number[]): boolean {
  const labels = new Set(ticks.map((tick) => formatAxisShekel(tick)))
  return labels.size !== ticks.length
}

export interface DualAxisTicks {
  /** Left (payments) axis gridline values: 0 .. scaleMaxPayment, evenly stepped. */
  paymentTicks: number[]
  /** Right (balance) axis gridline values: same count, same row fractions. */
  balanceTicks: number[]
  /** Plot-top of the payments scale: step × intervals (>= the data max). */
  scaleMaxPayment: number
  /** Plot-top of the balance scale: step × intervals (>= the data max). */
  scaleMaxBalance: number
  /** Shared gridline interval count (each ticks array is intervals + 1 long). */
  intervals: number
}

/**
 * Grid-aligned dual-axis ticks for the amortization chart: the payments
 * scale (left) and the balance scale (right) are both cut into the same
 * number of equal intervals with round steps, and each scale top extends
 * to step × intervals, so the solid payments grid and the dashed balance
 * grid draw on the same rows instead of crossing mid-plot. The shared
 * interval count is searched around `targetCount` (2..7) and ranked by: no
 * duplicated axis labels first (e.g. step-500 grids print 1,500 and 2,000
 * both as "₪2K"), then the worse axis' headroom (scale top / data max - keeps the data filling
 * the plot), then closeness to the target, then fewer gridlines. Every
 * candidate guarantees scaleMax >= its data max, so no series clips above
 * the top gridline. Returns null when either max is unusable; the caller
 * then falls back to two independent niceTicks scales (grids may cross,
 * as before).
 */
export function alignedDualTicks(
  maxPayment: number,
  maxBalance: number,
  targetCount = 4,
): DualAxisTicks | null {
  const usable = (max: number) => Number.isFinite(max) && max > 0
  if (!usable(maxPayment) || !usable(maxBalance)) return null
  let best: DualAxisTicks | null = null
  let bestHeadroom = Number.POSITIVE_INFINITY
  let bestDistance = Number.POSITIVE_INFINITY
  for (let intervals = 2; intervals <= 7; intervals++) {
    const stepPayment = niceStepUp(maxPayment / intervals)
    const stepBalance = niceStepUp(maxBalance / intervals)
    const scaleMaxPayment = stepPayment * intervals
    const scaleMaxBalance = stepBalance * intervals
    const paymentTicks = axisTicks(stepPayment, intervals)
    const balanceTicks = axisTicks(stepBalance, intervals)
    if (hasDuplicateLabels(paymentTicks) || hasDuplicateLabels(balanceTicks)) continue
    // Headroom is bounded (< 2) because a nice step is under 2× the value
    // it was snapped from, so an absolute epsilon is a safe tie window.
    const headroom = Math.max(scaleMaxPayment / maxPayment, scaleMaxBalance / maxBalance)
    const distance = Math.abs(intervals - targetCount)
    const better =
      headroom < bestHeadroom - 1e-9 || (headroom <= bestHeadroom + 1e-9 && distance < bestDistance)
    if (better) {
      bestHeadroom = headroom
      bestDistance = distance
      best = { paymentTicks, balanceTicks, scaleMaxPayment, scaleMaxBalance, intervals }
    }
  }
  return best
}

export interface DonutSegmentInput {
  value: number
}

export interface DonutSegment {
  /** Slice share of the total, 0-1 (0 when the total is 0). */
  fraction: number
  startAngle: number
  endAngle: number
}

/**
 * Slices a donut into angular segments (radians, starting at 12 o'clock,
 * clockwise). Angles are already gap-ready: the component insets each slice
 * when drawing. A total of 0 yields no segments.
 */
export function donutSegments(values: number[]): DonutSegment[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (total <= 0) return []
  let cursor = -Math.PI / 2 // start at 12 o'clock
  return values.map((value) => {
    const fraction = Math.max(0, value) / total
    const sweep = fraction * Math.PI * 2
    const segment = { fraction, startAngle: cursor, endAngle: cursor + sweep }
    cursor += sweep
    return segment
  })
}

/**
 * SVG path for a donut slice between two radii. `endAngle - startAngle` is
 * clamped just under a full turn so a 100% slice still renders (a full-circle
 * arc with equal endpoints would draw nothing).
 */
export function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle
  const clampedEnd = sweep >= Math.PI * 2 ? startAngle + Math.PI * 2 - 1e-4 : endAngle
  const x0 = cx + rOuter * Math.cos(startAngle)
  const y0 = cy + rOuter * Math.sin(startAngle)
  const x1 = cx + rOuter * Math.cos(clampedEnd)
  const y1 = cy + rOuter * Math.sin(clampedEnd)
  const x2 = cx + rInner * Math.cos(clampedEnd)
  const y2 = cy + rInner * Math.sin(clampedEnd)
  const x3 = cx + rInner * Math.cos(startAngle)
  const y3 = cy + rInner * Math.sin(startAngle)
  const largeArc = clampedEnd - startAngle > Math.PI ? 1 : 0
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x3} ${y3}`,
    'Z',
  ].join(' ')
}

/** Mid-angle of a slice - used to place percentage labels. */
export function midAngle(startAngle: number, endAngle: number): number {
  return (startAngle + endAngle) / 2
}

export interface XTick {
  /** Row index the tick sits on. */
  index: number
  /** Axis label text, or null for a small unlabeled (minor) tick. */
  label: string | null
}

/**
 * Evenly spaced x-axis ticks: every period when there is room (up to 18
 * rows), otherwise every 2nd row with minor ticks between; monthly rows
 * label the year boundaries (every 12th month) with minor ticks at the
 * half-year. Labels are bare numbers - "שנה" lives in the tooltip/title.
 */
/**
 * How many periods between labeled ticks: every one up to 18, every 2nd up to
 * 40, then roughly a dozen labels across the horizon. Shared by both
 * granularities, so the same term gets the same label density whichever tab
 * the reader is on.
 */
function labelStep(count: number): number {
  return count <= 18 ? 1 : count <= 40 ? 2 : Math.ceil(count / 12)
}

export function xAxisTicks(count: number, monthly: boolean): XTick[] {
  const ticks: XTick[] = []
  if (monthly) {
    // Points are months, but only year boundaries can carry a label: month
    // numbers 1-360 would be unreadable, and the table already has its own
    // "total months" column. The step is the YEARS one, so a 30-year horizon
    // is labeled 1, 3, 5... in either tab instead of 30 crowded labels here
    // and 15 there. Every 6th month keeps an unlabeled tick.
    const yearStep = labelStep(Math.ceil(count / 12))
    for (let index = 0; index < count; index++) {
      const month = index + 1
      if (month % 12 === 0) {
        const year = month / 12
        ticks.push({ index, label: (year - 1) % yearStep === 0 ? String(year) : null })
      } else if (month % 6 === 0) {
        ticks.push({ index, label: null })
      }
    }
    return ticks
  }
  const step = labelStep(count)
  for (let index = 0; index < count; index++) {
    if (index % step === 0) ticks.push({ index, label: String(index + 1) })
    else if (step > 1) ticks.push({ index, label: null })
  }
  return ticks
}
