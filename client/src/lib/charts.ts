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
 * 1/2/2.5/5×10ⁿ families so labels stay round, and always returns 0 as the
 * first tick plus `max` when it lands on the step grid.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  const rawStep = max / Math.max(1, targetCount)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  const factor = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10
  const step = factor * magnitude
  const ticks: number[] = []
  for (let tick = 0; tick <= max + step * 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)))
  }
  // The axis can end above the last round tick - show the true max too.
  const last = ticks[ticks.length - 1]
  if (max - last > step * 1e-9) ticks.push(Number(max.toFixed(6)))
  return ticks
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
  const clampedEnd =
    sweep >= Math.PI * 2 ? startAngle + Math.PI * 2 - 1e-4 : endAngle
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
export function xAxisTicks(count: number, monthly: boolean): XTick[] {
  const ticks: XTick[] = []
  if (monthly) {
    for (let index = 0; index < count; index++) {
      const month = index + 1
      if (month % 12 === 0) ticks.push({ index, label: String(month / 12) })
      else if (month % 6 === 0) ticks.push({ index, label: null })
    }
    return ticks
  }
  const step = count <= 18 ? 1 : count <= 40 ? 2 : Math.ceil(count / 12)
  for (let index = 0; index < count; index++) {
    if (index % step === 0) ticks.push({ index, label: String(index + 1) })
    else if (step > 1) ticks.push({ index, label: null })
  }
  return ticks
}
