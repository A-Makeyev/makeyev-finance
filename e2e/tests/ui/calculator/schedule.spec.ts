import { test, expect } from '../../../fixtures'

test.describe('mortgage calculator - amortization schedule', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('schedule always shows the full horizon, with no expand button', async ({ calc }) => {
    // Default term is 15y - the full 15 rows render, no expand control.
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)

    await calc.termSlider.fill('30')
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(30)
  })

  test('monthly schedule tab relabels the payment axis and matches yearly label density', async ({
    calc,
  }) => {
    // The chart is fed from the same rows the table renders, so the two tabs
    // plot one curve at two granularities. What must NOT be the same is the
    // payments axis: a yearly row carries 12 payments, a monthly row one, so
    // the same label over both scales would misstate every figure by 12x.
    const probe = `(() => {
      const chart = document.querySelector('[data-testid="amortization-chart"]')
      if (!chart) return null
      const svg = chart.querySelector('svg')
      return {
        bars: svg.querySelectorAll('rect.chart-bar').length,
        areas: svg.querySelectorAll('path.chart-area').length,
        titles: [...svg.querySelectorAll('text.chart-axis-title')].map((n) => n.textContent),
        xLabels: [...svg.querySelectorAll('text.chart-tick')]
          .filter((n) => n.getAttribute('y') === '524')
          .map((n) => n.textContent)
      }
    })()`

    const yearly = (await calc.page.evaluate(probe)) as {
      bars: number
      areas: number
      titles: string[]
      xLabels: string[]
    } | null
    expect(yearly, 'chart rendered').not.toBeNull()
    // 15 yearly rows, each a three-segment stack (net principal + indexation +
    // interest) because the default mix carries an indexed track.
    expect(yearly!.bars).toBe(45)
    expect(yearly!.areas).toBe(0)
    expect(yearly!.titles).toContain('תשלום שנתי')
    expect(yearly!.xLabels).toHaveLength(15)

    await calc.page.getByTestId('schedule-granularity-monthly').click()
    const monthly = (await calc.page.evaluate(probe)) as typeof yearly
    // 180 monthly rows cannot be bars: the same curve becomes three areas
    // (net principal, indexation and interest).
    expect(monthly!.bars).toBe(0)
    expect(monthly!.areas).toBe(3)
    // The payments axis is scaled to ONE payment now, so it has to say so.
    expect(monthly!.titles).toContain('תשלום חודשי')
    expect(monthly!.titles).not.toContain('תשלום שנתי')
    // Year-boundary labels stay exactly as dense as the yearly tab's.
    expect(monthly!.xLabels).toEqual(yearly!.xLabels)

    // The tooltip's payment line follows the same mode (and names months).
    await calc.page.locator('[data-testid="amortization-chart"] svg').hover()
    const tooltip = calc.page.locator('.chart-tooltip')
    await expect(tooltip).toContainText('תשלום חודשי')
    await expect(tooltip).not.toContainText('תשלום שנתי')
  })

  test('a long indexed loan draws the negative net principal below zero', async ({ calc }) => {
    // One fully indexed track over 30 years: year one adds more CPI drift than
    // the principal payment repays, so net principal is negative. The chart
    // must show that shortfall under the zero line, not clamp it to 0 (which
    // would break the segments' reconciliation to the payment).
    await calc.track(3).remove()
    await calc.track(2).remove()
    await calc.track(1).setType('fixedIndexed')
    await calc.track(1).setAmount('1,000,000')
    await calc.termSlider.fill('30')

    const chart = calc.page.getByTestId('amortization-chart')
    await expect(chart).toBeVisible()
    await expect(chart.locator('.chart-legend')).toContainText('הצמדה')
    const probe = (await chart.locator('svg').evaluate(`(() => {
      const svg = document.querySelector('[data-testid="amortization-chart"] svg')
      return {
        negativeTicks: [...svg.querySelectorAll('text.chart-tick')].some((node) =>
          (node.textContent || '').trim().startsWith('-₪'),
        ),
        zeroLine: svg.querySelectorAll('.chart-zero-line').length,
        indexationBars: svg.querySelectorAll('rect.chart-bar-indexation').length,
        hasNaN: svg.innerHTML.includes('NaN'),
      }
    })()`)) as {
      negativeTicks: boolean
      zeroLine: number
      indexationBars: number
      hasNaN: boolean
    }
    expect(probe.negativeTicks, 'the axis extends below zero').toBe(true)
    expect(probe.zeroLine, 'the zero line is drawn').toBe(1)
    expect(probe.indexationBars, 'one indexation segment per year').toBe(30)
    expect(probe.hasNaN, 'no broken geometry').toBe(false)
  })

  test('per-track chart follows the monthly tab like the total view does', async ({ calc }) => {
    await calc.page.getByTestId('schedule-view-separate').click()

    // Per-track plot: one balance line per track. Labeled x ticks sit at
    // y = HEIGHT - 36 in this chart's 560-unit viewBox.
    const probe = `(() => {
      const chart = document.querySelector('[data-testid="per-track-chart"]')
      if (!chart) return null
      const svg = chart.querySelector('svg')
      const lines = [...svg.querySelectorAll('path.chart-line-track')]
      return {
        lines: lines.length,
        points: lines.map((line) => (line.getAttribute('d') || '').split('L').length),
        xLabels: [...svg.querySelectorAll('text.chart-tick')]
          .filter((n) => n.getAttribute('y') === '524')
          .map((n) => n.textContent)
      }
    })()`

    const yearly = (await calc.page.evaluate(probe)) as {
      lines: number
      points: number[]
      xLabels: string[]
    } | null
    expect(yearly, 'per-track chart rendered').not.toBeNull()
    // Three tracks over 15 years: three polylines of 15 points each.
    expect(yearly!.lines).toBe(3)
    expect(yearly!.points).toEqual([15, 15, 15])
    expect(yearly!.xLabels).toHaveLength(15)

    await calc.page.getByTestId('schedule-granularity-monthly').click()
    const monthly = (await calc.page.evaluate(probe)) as typeof yearly
    // Monthly: the same lines, one point per month (180), so the chart and the
    // tables under it can never disagree about the schedule's granularity.
    expect(monthly!.points).toEqual([180, 180, 180])
    // Year-boundary labels keep the yearly density.
    expect(monthly!.xLabels).toEqual(yearly!.xLabels)

    // And the tooltip names months, not years, in this mode.
    await calc.page.locator('[data-testid="per-track-chart"] svg').hover()
    const tooltip = calc.page.locator('[data-testid="per-track-chart"] .chart-tooltip')
    await expect(tooltip).toContainText('חודש')
    await expect(tooltip).not.toContainText('שנה')
  })

  test('no schedule table is shown while no loan is entered', async ({ calc }) => {
    // The default preset (basket4) fills the tables - clear every track so
    // nothing is left to calculate, then check the header-only table is gone.
    for (let index = 1; index <= 3; index++) {
      await calc.track(index).setAmount('')
    }
    await expect(calc.page.getByTestId('schedule-body')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(0)
    await expect(calc.page.locator('.schedule-empty')).toBeVisible()

    // A real amount brings the full 15-year table back (fixed-rate track,
    // so the variable-share cap doesn't block the calculation).
    await calc.track(1).setType('fixed')
    await calc.track(1).setAmount('500,000')
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)
  })

  test('the cost donut prints each slice share inside the slice, readable in both themes', async ({
    calc,
  }) => {
    // The share used to live only in the hover callout. It now also sits inside
    // the slice from 8% up, and the ink is picked PER SLICE: white reads on the
    // teal and purple fills but only 2.2:1 on the gold interest slice, so that
    // one takes near-black. This probe reads the rendered colors and measures
    // contrast, so a palette or token change that kills legibility fails here.
    const probe = `(() => {
      const donut = document.querySelector('[data-testid="total-cost-donut"]')
      if (!donut) return null
      const luminance = (color) => {
        const [r, g, b] = color.match(/[\\d.]+/g).map(Number)
        const channel = (value) => {
          const ratio = value / 255
          return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }
      const contrast = (one, other) => {
        const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a)
        return (light + 0.05) / (dark + 0.05)
      }
      const amounts = [...donut.querySelectorAll('.cost-legend-amount')].map((node) =>
        Number((node.textContent || '').split('·')[0].replace(/[^\\d]/g, '')),
      )
      const total = amounts.reduce((sum, amount) => sum + amount, 0)
      return {
        slices: [...donut.querySelectorAll('svg g.mix-slice')].map((group, index) => {
          const text = group.querySelector('text.donut-slice-label')
          const path = group.querySelector('path')
          return {
            share: total > 0 ? Math.round((amounts[index] / total) * 100) : 0,
            label: text ? text.textContent : null,
            contrast: text
              ? Number(
                  contrast(getComputedStyle(path).fill, getComputedStyle(text).fill).toFixed(2),
                )
              : null,
          }
        }),
      }
    })()`

    type DonutShares = {
      slices: { share: number; label: string | null; contrast: number | null }[]
    } | null

    const expectSharesInSlices = (donut: DonutShares, theme: string) => {
      expect(donut, `cost donut rendered (${theme})`).not.toBeNull()
      expect(donut!.slices.length).toBeGreaterThanOrEqual(2)
      for (const slice of donut!.slices) {
        if (slice.share < 8) {
          // Too thin to hold a number; the hover callout still carries it.
          expect(slice.label, `${theme}: thin slice stays unlabeled`).toBeNull()
          continue
        }
        expect(slice.label, `${theme}: ${slice.share}% slice label`).toBe(`${slice.share}%`)
        // AA for normal text: the number has to be readable on its own fill.
        expect(slice.contrast, `${theme}: ${slice.share}% label contrast`).toBeGreaterThanOrEqual(
          4.5,
        )
      }
    }

    expectSharesInSlices((await calc.page.evaluate(probe)) as DonutShares, 'light')

    // Dark mode brightens all three fills, so every label has to flip to dark
    // ink there - the theme white would be 2.6:1 on the teal slice.
    await calc.page.evaluate(() => localStorage.setItem('site_theme', 'dark'))
    await calc.goto()
    await expect(calc.page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expectSharesInSlices((await calc.page.evaluate(probe)) as DonutShares, 'dark')
  })

  test('the cost donut repeats each slice share as text for the legend and for assistive tech', async ({
    calc,
  }) => {
    // A donut is a picture. The legend carries the shares visually, and a
    // visually-hidden list repeats the same figures for a screen reader, wired
    // to the SVG through aria-describedby - otherwise the chart announces as a
    // title with no data in it. The list must be visually hidden, not
    // display:none, or assistive tech would not see it either.
    const probe = `(() => {
      const root = document.querySelector('[data-testid="total-cost-donut"]')
      if (!root) return null
      const digits = (text) => [...(text || '')].filter((char) => char >= '0' && char <= '9').join('')
      const svg = root.querySelector('svg')
      const describedBy = svg ? svg.getAttribute('aria-describedby') : null
      const list = describedBy ? root.querySelector('[id="' + describedBy + '"]') : null
      const style = list ? getComputedStyle(list) : null
      return {
        legend: [...root.querySelectorAll('.cost-legend-item')].map((row) => {
          const amountLine = row.querySelector('.cost-legend-amount')
          const [amountText, shareText] = (amountLine ? amountLine.textContent : '').split('·')
          return {
            amount: Number(digits(amountText)),
            share: (shareText || '').trim(),
          }
        }),
        items: list ? [...list.querySelectorAll('li')].map((li) => li.textContent) : null,
        wired: !!list && list.getAttribute('data-testid') === 'total-cost-donut-summary',
        hidden:
          !!style &&
          style.position === 'absolute' &&
          list.getBoundingClientRect().width <= 1,
      }
    })()`

    type CostLegendProbe = {
      legend: { amount: number; share: string }[]
      items: string[] | null
      wired: boolean
      hidden: boolean
    } | null

    const data = (await calc.page.evaluate(probe)) as CostLegendProbe
    expect(data, 'cost donut rendered').not.toBeNull()
    const { legend, items, wired, hidden } = data!

    expect(legend.length).toBeGreaterThanOrEqual(2)
    expect(wired, 'the SVG describes itself with the text list').toBe(true)
    expect(hidden, 'the text list is visually hidden, never display:none').toBe(true)
    expect(items, 'text list rendered').not.toBeNull()
    expect(items!.length, 'one line per slice plus the total').toBe(legend.length + 1)

    const total = legend.reduce((sum, row) => sum + row.amount, 0)
    legend.forEach((row, index) => {
      const share = total > 0 ? Math.round((row.amount / total) * 100) : 0
      // The legend and the text list have to agree with the ring, and with
      // each other: one rounding, one source.
      expect(row.share, `legend share ${index}`).toBe(`${share}%`)
      expect(items![index], `summary share ${index}`).toContain(`${share}%`)
      expect(items![index], `summary amount ${index}`).toContain(
        row.amount.toLocaleString('en-US'),
      )
    })
    expect(items![items!.length - 1], 'summary total').toContain(total.toLocaleString('en-US'))
  })

  test('the donut pair renders both rings and their text at the same scale', async ({ calc }) => {
    // Side by side, the two donuts are read as one comparison. They used to
    // disagree twice over: the mix ring was 11% larger at the same width, and
    // its 320-unit canvas made every label render smaller than the cost
    // donut's 170-unit one. Both now share the 170-unit canvas in the pair.
    await calc.page.setViewportSize({ width: 900, height: 1000 })
    const cost = calc.page.getByTestId('total-cost-donut')
    await expect(cost).toBeVisible()
    await expect(calc.page.locator('[data-testid="track-mix-donut"] svg')).toHaveAttribute(
      'viewBox',
      '0 0 170 170',
    )

    type TextStyle = { size: string; weight: string; color: string }
    type ProbeSide = {
      svgWidth: number
      ring: number
      slice: { height: number }
      label: { height: number }
      value: { height: number; width: number }
      valueText: string
      legendName: TextStyle
      legendNumber: TextStyle
    }

    const probe = (await calc.page.evaluate(`(() => {
      const measure = (selector) => {
        const root = document.querySelector(selector)
        const svg = root.querySelector('svg')
        const svgRect = svg.getBoundingClientRect()
        const paths = [...svg.querySelectorAll('g.mix-slice path')]
        const union = paths.reduce(
          (acc, path) => {
            const box = path.getBoundingClientRect()
            return {
              left: Math.min(acc.left, box.left),
              right: Math.max(acc.right, box.right),
              top: Math.min(acc.top, box.top),
              bottom: Math.max(acc.bottom, box.bottom),
            }
          },
          { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
        )
        const text = (query) => {
          const el = svg.querySelector(query)
          if (!el) return null
          const box = el.getBoundingClientRect()
          return { width: box.width, height: box.height, font: getComputedStyle(el).fontSize }
        }
        const styleOf = (el) => {
          if (!el) return null
          const style = getComputedStyle(el)
          return { size: style.fontSize, weight: style.fontWeight, color: style.color }
        }
        const valueEl = svg.querySelector('text.donut-center-value')
        return {
          svgWidth: svgRect.width,
          viewBox: svg.getAttribute('viewBox'),
          ring: union.right - union.left,
          slice: text('text.donut-slice-label'),
          label: text('text.donut-center-label'),
          value: text('text.donut-center-value'),
          valueText: valueEl ? valueEl.textContent.trim() : '',
          legendName: styleOf(root.querySelector('.mix-legend-name, .cost-legend-name')),
          legendNumber: styleOf(root.querySelector('.mix-legend-amount, .cost-legend-amount')),
        }
      }
      return {
        cost: measure('[data-testid="total-cost-donut"]'),
        mix: measure('[data-testid="track-mix-donut"]'),
      }
    })()`)) as { cost: ProbeSide; mix: ProbeSide }

    const { cost: costSide, mix } = probe

    // Same canvas, same rendered width, same ring diameter.
    expect(costSide.svgWidth).toBeCloseTo(mix.svgWidth, 0)
    expect(costSide.ring).toBeCloseTo(mix.ring, 0)
    // Same text scale: equal glyph heights for the share, the centre label
    // and the centre figure.
    expect(costSide.slice.height).toBeCloseTo(mix.slice.height, 0)
    expect(costSide.label.height).toBeCloseTo(mix.label.height, 0)
    expect(costSide.value.height).toBeCloseTo(mix.value.height, 0)

    // The centre figure can be full size because the mix total is compact:
    // ₪1M rather than ₪1,000,000, with the exact amounts in the legend.
    expect(mix.valueText).toMatch(/^₪[\d.]+M$/)
    expect(mix.value.width).toBeLessThan(mix.svgWidth * 0.5)

    // Both legends share one typographic scale: same size, weight and color
    // for the name line and for the amount line.
    expect(costSide.legendName).toEqual(mix.legendName)
    expect(costSide.legendNumber).toEqual(mix.legendNumber)

    // The two legends face each other under their rings, so their two-line
    // rows sit on the same lines: same top, same height. Each legend is
    // centered on its own ring and keeps its chips in one column, exactly like
    // the wide band's legends.
    const legends = (await calc.page.evaluate(`(() => {
      const tops = (selector) =>
        [...document.querySelectorAll(selector)].map((row) =>
          Math.round(row.getBoundingClientRect().top),
        )
      const centers = (selector) =>
        [...document.querySelectorAll(selector)].map((row) => {
          const chip = row.querySelector('.chart-swatch').getBoundingClientRect()
          return chip.left + chip.width / 2
        })
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      }
      return {
        mixRows: tops('.schedule-donut-pair .mix-legend-item'),
        costRows: tops('.schedule-donut-pair .cost-legend-item'),
        mixChips: centers('.schedule-donut-pair .mix-legend-item'),
        costChips: centers('.schedule-donut-pair .cost-legend-item'),
        mixLegend: box('.schedule-donut-pair .mix-legend'),
        costLegend: box('.schedule-donut-pair .cost-legend'),
        mixRing: box('.schedule-donut-pair .mix-donut svg'),
        costRing: box('.schedule-donut-pair .cost-donut svg'),
      }
    })()`)) as {
      mixRows: number[]
      costRows: number[]
      mixChips: number[]
      costChips: number[]
      mixLegend: { left: number; top: number; width: number; height: number }
      costLegend: { left: number; top: number; width: number; height: number }
      mixRing: { left: number; top: number; width: number; height: number }
      costRing: { left: number; top: number; width: number; height: number }
    }
    expect(legends.mixRows).toHaveLength(3)
    expect(legends.costRows).toEqual(legends.mixRows)
    expect(legends.costLegend.top).toBe(legends.mixLegend.top)
    expect(legends.costLegend.height).toBe(legends.mixLegend.height)
    for (const chip of legends.mixChips) {
      expect(Math.abs(chip - legends.mixChips[0]), 'mix chips share one column').toBeLessThanOrEqual(1)
    }
    for (const chip of legends.costChips) {
      expect(Math.abs(chip - legends.costChips[0]), 'cost chips share one column').toBeLessThanOrEqual(1)
    }
    // Centered on its own ring, then nudged by the shared direction shift both
    // legends take (--schedule-legend-shift), so neither sits dead center.
    const shift = (await calc.page.evaluate(`(() => {
      const value = getComputedStyle(document.querySelector('.schedule-section'))
        .getPropertyValue('--schedule-legend-shift')
      return parseFloat(value) || 0
    })()`)) as number
    const center = (box: { left: number; width: number }) => box.left + box.width / 2
    expect(Math.abs(center(legends.mixLegend) - (center(legends.mixRing) + shift))).toBeLessThanOrEqual(1)
    expect(
      Math.abs(center(legends.costLegend) - (center(legends.costRing) + shift)),
    ).toBeLessThanOrEqual(1)

    // On a phone the pair wraps: the two rings stack on one center line, so
    // the legends sit one under the other and their chips have to land on ONE
    // vertical line. A cost legend sized to its own text is narrower than the
    // mix legend, and centering it on the same ring pushed its squares off the
    // mix legend's column.
    await calc.page.setViewportSize({ width: 430, height: 1200 })
    await expect
      .poll(() =>
        calc.page.evaluate(`(() => {
          const centerOf = (selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect()
            return Math.round(rect.left + rect.width / 2)
          }
          return Math.abs(
            centerOf('.schedule-donut-pair .mix-donut svg') -
              centerOf('.schedule-donut-pair .cost-donut svg'),
          )
        })()`),
      )
      .toBeLessThanOrEqual(1)

    const stacked = (await calc.page.evaluate(`(() => {
      const chips = (selector) =>
        [...document.querySelectorAll(selector)].map((row) => {
          const chip = row.querySelector('.chart-swatch').getBoundingClientRect()
          return chip.left + chip.width / 2
        })
      return {
        mix: chips('.schedule-donut-pair .mix-legend-item'),
        cost: chips('.schedule-donut-pair .cost-legend-item'),
      }
    })()`)) as { mix: number[]; cost: number[] }
    expect(stacked.mix).toHaveLength(3)
    expect(stacked.cost).toHaveLength(3)
    for (const chip of stacked.cost) {
      expect(
        Math.abs(chip - stacked.mix[0]),
        'the two legends share one chip column once the rings stack',
      ).toBeLessThanOrEqual(1)
    }
  })

  test('the wide mix ring matches the cost ring and gives the freed width to the chart', async ({
    calc,
  }) => {
    type LegendStyle = { size: string; weight: string; color: string }
    // The wide band used to draw the mix ring at 280px while the cost ring in
    // the asides was 190px. Both now render at 210px - bigger than the first
    // pass at 190px, without enlarging their labels - and the chart beside the
    // ring takes the width the ring gives up.
    await calc.page.setViewportSize({ width: 1440, height: 1200 })
    const mix = calc.page.locator('[data-testid="track-mix-donut"] svg')
    const cost = calc.page.locator('[data-testid="total-cost-donut"] svg')
    const chart = calc.page.getByTestId('amortization-chart')
    await chart.scrollIntoViewIfNeeded()
    const mixBox = await mix.boundingBox()
    const costBox = await cost.boundingBox()
    const chartBox = await chart.boundingBox()
    expect(mixBox).not.toBeNull()
    expect(costBox).not.toBeNull()
    expect(chartBox).not.toBeNull()
    expect(mixBox!.width).toBeCloseTo(210, 0)
    expect(costBox!.width).toBeCloseTo(210, 0)
    expect(Math.abs(mixBox!.width - costBox!.width)).toBeLessThanOrEqual(1)
    expect(chartBox!.width).toBeGreaterThan(800)

    // The rings grew but their type did not: both still render the share and
    // the centre figure at the ~13px / ~20px they read at the old 190px ring.
    // Font sizes inside an SVG are viewBox units, so the rendered size is the
    // declared size times the ring's own scale; read both.
    const typeSizes = (await calc.page.evaluate(`(() => {
      const rendered = (rootSelector, textSelector) => {
        const root = document.querySelector(rootSelector)
        const svg = root && root.querySelector('svg')
        const text = root && root.querySelector(textSelector)
        if (!svg || !text) return 0
        const units = Number(svg.getAttribute('viewBox').split(' ')[2])
        const scale = svg.getBoundingClientRect().width / units
        return parseFloat(getComputedStyle(text).fontSize) * scale
      }
      return {
        mixSlice: rendered('[data-testid="track-mix-donut"]', 'text.donut-slice-label'),
        mixValue: rendered('[data-testid="track-mix-donut"]', 'text.donut-center-value'),
        costSlice: rendered('[data-testid="total-cost-donut"]', 'text.donut-slice-label'),
        costValue: rendered('[data-testid="total-cost-donut"]', 'text.donut-center-value'),
      }
    })()`)) as { mixSlice: number; mixValue: number; costSlice: number; costValue: number }
    expect(typeSizes.mixSlice).toBeGreaterThan(12)
    expect(typeSizes.mixSlice).toBeLessThan(14)
    expect(typeSizes.costSlice).toBeGreaterThan(12)
    expect(typeSizes.costSlice).toBeLessThan(14)
    expect(typeSizes.mixValue).toBeGreaterThan(19)
    expect(typeSizes.mixValue).toBeLessThan(21)
    expect(typeSizes.costValue).toBeGreaterThan(19)
    expect(typeSizes.costValue).toBeLessThan(21)

    // Both legends are tight blocks under their own ring: the text and its chip
    // stay together, the block's own width is the longest row, and the two chip
    // columns share one vertical line. The cost row copies the mix row's ink
    // name and muted "amount · share" line.
    await calc.page.evaluate('document.fonts.ready')
    const columns = (await calc.page.evaluate(`(() => {
      // Centers, not an edge: the band forces LTR on the mix donut while the
      // cost donut inherits the page's RTL, so a "start" edge would be a
      // different side of the square for each legend.
      const squares = (rootSelector, rowSelector) => {
        const root = document.querySelector(rootSelector)
        return [...root.querySelectorAll(rowSelector)].map((row) => {
          const box = row.querySelector('.chart-swatch').getBoundingClientRect()
          return box.x + box.width / 2
        })
      }
      const box = (node) => {
        const rect = node.getBoundingClientRect()
        return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
      }
      const mix = document.querySelector('[data-testid="track-mix-donut"]')
      const cost = document.querySelector('[data-testid="total-cost-donut"]')
      const direction = getComputedStyle(mix.querySelector('.mix-legend')).direction
      const edge = (node) => {
        const box = node.getBoundingClientRect()
        return direction === 'rtl' ? box.right : box.left
      }
      // One cost row, read line by line: the name opens the row and the amount
      // sits under it, like the mix legend's stacked rows.
      const costRow = document.querySelector('[data-testid="total-cost-donut"] .cost-legend-item')
      const costName = costRow.querySelector('.cost-legend-name').getBoundingClientRect()
      const costAmount = costRow.querySelector('.cost-legend-amount').getBoundingClientRect()
      const costChip = costRow.querySelector('.chart-swatch').getBoundingClientRect()
      const styleOf = (selector, root) => {
        const node = root.querySelector(selector)
        if (!node) return null
        const style = getComputedStyle(node)
        return { size: style.fontSize, weight: style.fontWeight, color: style.color }
      }
      return {
        direction,
        mixSquares: squares('[data-testid="track-mix-donut"]', '.mix-legend-item'),
        costSquares: squares('[data-testid="total-cost-donut"]', '.cost-legend-item'),
        rows: [...mix.querySelectorAll('.mix-legend-item')].map((row) => ({
          square: edge(row.querySelector('.chart-swatch')),
          name: edge(row.querySelector('.mix-legend-name')),
          amount: edge(row.querySelector('.mix-legend-amount')),
        })),
        mixRing: box(mix.querySelector('svg')),
        mixLegend: box(mix.querySelector('.mix-legend')),
        costRing: box(cost.querySelector('svg')),
        costLegend: box(cost.querySelector('.cost-legend')),
        mixNameStyle: styleOf('.mix-legend-name', mix),
        costNameStyle: styleOf('.cost-legend-name', cost),
        mixAmountStyle: styleOf('.mix-legend-amount', mix),
        costAmountStyle: styleOf('.cost-legend-amount', cost),
        costAmountTexts: [...cost.querySelectorAll('.cost-legend-amount')].map((node) =>
          (node.textContent || '').trim(),
        ),
        costChipToName:
          direction === 'rtl' ? costChip.left - costName.right : costName.left - costChip.right,
        costLines: { nameTop: costName.top, nameBottom: costName.bottom, amountTop: costAmount.top },
      }
    })()`)) as {
      direction: string
      mixSquares: number[]
      costSquares: number[]
      rows: { square: number; name: number; amount: number }[]
      mixRing: { left: number; right: number; width: number }
      mixLegend: { left: number; right: number; width: number }
      costRing: { left: number; right: number; width: number }
      costLegend: { left: number; right: number; width: number }
      mixNameStyle: LegendStyle
      costNameStyle: LegendStyle
      mixAmountStyle: LegendStyle
      costAmountStyle: LegendStyle
      costAmountTexts: string[]
      costChipToName: number
      costLines: { nameTop: number; nameBottom: number; amountTop: number }
    }
    expect(columns.mixSquares).toHaveLength(3)
    expect(columns.costSquares.length).toBeGreaterThan(1)
    const center = (box: { left: number; width: number }) => box.left + box.width / 2
    // Both legends are one box on one center line. Hebrew shifts that line off
    // the ring center (per the shared --schedule-legend-shift), English keeps it
    // centered; the two legends must move together either way.
    expect(Math.abs(center(columns.mixLegend) - center(columns.costLegend))).toBeLessThanOrEqual(1)
    if (columns.direction === 'rtl') {
      expect(Math.abs(center(columns.mixLegend) - center(columns.mixRing) + 26)).toBeLessThanOrEqual(1)
    } else {
      expect(Math.abs(center(columns.mixLegend) - center(columns.mixRing))).toBeLessThanOrEqual(1)
    }
    // The two rings still sit on the same vertical lines.
    expect(columns.mixRing.left).toBe(columns.costRing.left)
    expect(columns.mixRing.right).toBe(columns.costRing.right)
    // The mix chips and the cost chips form one vertical line, not two columns
    // a few pixels apart.
    for (const square of columns.mixSquares) {
      expect(
        Math.abs(square - columns.costSquares[0]),
        'mix and cost chips share one column',
      ).toBeLessThanOrEqual(1)
    }
    // Inside each legend every chip sits on one line, and the text stays right
    // beside its own chip instead of being pushed across the column.
    for (const square of columns.costSquares) {
      expect(Math.abs(square - columns.costSquares[0]), 'cost chips share one line').toBeLessThanOrEqual(1)
    }
    expect(columns.costChipToName).toBeLessThanOrEqual(10)
    // The cost row is the mix row: ink name line, then the amount and its share
    // on one muted line joined by a middle dot.
    expect(columns.costNameStyle).toEqual(columns.mixNameStyle)
    expect(columns.costAmountStyle).toEqual(columns.mixAmountStyle)
    for (const text of columns.costAmountTexts) {
      expect(text).toContain('·')
    }
    // And within the mix legend every row shares one chip/name/amount column,
    // so the rows read as a table instead of stepping in and out.
    for (const row of columns.rows) {
      expect(row.square, 'chips share one line').toBeCloseTo(columns.rows[0].square, 0)
      expect(row.name, 'names share one line').toBeCloseTo(columns.rows[0].name, 0)
      expect(row.amount, 'amount starts under its name').toBeCloseTo(row.name, 0)
    }

    // The wide cost legend stacks like the mix one: the name on the first line,
    // the amount on the next, instead of name, amount and share sharing a row.
    expect(columns.costLines.amountTop).toBeGreaterThanOrEqual(columns.costLines.nameBottom - 1)
  })

  test('the schedule table takes keyboard focus and scrolls with the keyboard', async ({
    calc,
  }) => {
    // The bar is hidden to keep the panel clean, so the capped scroller is a
    // focusable region instead: Tab reaches it and the keyboard pans the rows.
    const scroller = calc.page.locator('.schedule-content .table-wrap').first()
    await scroller.scrollIntoViewIfNeeded()
    await expect(scroller).toHaveAttribute('role', 'region')
    await expect(scroller).toHaveAttribute('tabindex', '0')
    await expect(scroller).toHaveAttribute('aria-label', /./)

    const measure = await scroller.evaluate((node) => ({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }))
    expect(measure.scrollTop).toBe(0)
    expect(measure.scrollHeight).toBeGreaterThan(measure.clientHeight)

    await scroller.focus()
    await expect(scroller).toBeFocused()
    await calc.page.keyboard.press('PageDown')
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0)
  })

  test('chart tooltips hang just above the hovered data, not at the pointer', async ({ calc }) => {
    // The callout belongs to the graph: its bottom edge sits a fixed 10px above
    // the hovered point, and moving the cursor up or down inside one period
    // cannot move it. It used to track the pointer's height, which left it
    // wherever the cursor happened to be rather than on the line being read.
    const readTip = (selector: string) =>
      calc.page.evaluate(
        `(() => {
          const root = document.querySelector('${selector}')
          if (!root) return null
          const svg = root.querySelector('svg')
          const tip = root.querySelector('.chart-tooltip')
          if (!tip) return null
          const vbH = Number(svg.getAttribute('viewBox').split(' ')[3])
          const svgRect = svg.getBoundingClientRect()
          const plotRect = svg.parentElement.getBoundingClientRect()
          const tipRect = tip.getBoundingClientRect()
          const dots = [
            ...root.querySelectorAll(
              'circle.chart-dot, circle.chart-dot-track, circle.forecast-hover-dot',
            ),
          ]
          const anchorY = dots.length
            ? Math.min(...dots.map((dot) => Number(dot.getAttribute('cy'))))
            : null
          // Measured from the plot's top edge, so a scroll between the two
          // hovers cannot masquerade as the tooltip moving.
          return {
            top: tipRect.top - plotRect.top,
            bottom: tipRect.bottom - plotRect.top,
            plotHeight: plotRect.height,
            anchorPx: anchorY === null ? null : (anchorY / vbH) * svgRect.height,
          }
        })()`,
      )

    type TipProbe = {
      top: number
      bottom: number
      plotHeight: number
      anchorPx: number | null
    } | null

    const hoverAt = async (selector: string, xFraction: number, yFraction: number) => {
      const svg = calc.page.locator(`${selector} svg`)
      await svg.scrollIntoViewIfNeeded()
      const box = (await svg.boundingBox())!
      await svg.hover({ position: { x: box.width * xFraction, y: box.height * yFraction } })
      return (await readTip(selector)) as TipProbe
    }

    const expectDataAnchored = async (selector: string, name: string) => {
      const lowered = await hoverAt(selector, 0.5, 0.8)
      const raised = await hoverAt(selector, 0.5, 0.2)
      expect(lowered, `${name}: tooltip rendered`).not.toBeNull()
      expect(raised, `${name}: tooltip rendered`).not.toBeNull()
      // Same period, very different pointer heights: the callout must not move.
      expect(raised!.top, `${name}: pointer height is ignored`).toBeCloseTo(lowered!.top, 0)
      expect(raised!.bottom, `${name}: pointer height is ignored`).toBeCloseTo(lowered!.bottom, 0)
      // Never outside the plot, even when the point sits near its top edge.
      expect(lowered!.top, `${name}: stays inside the plot`).toBeGreaterThanOrEqual(-0.5)
      expect(lowered!.bottom, `${name}: stays inside the plot`).toBeLessThanOrEqual(
        lowered!.plotHeight + 0.5,
      )
      // And when there is room above the point, the gap is the fixed 10px.
      if (lowered!.anchorPx !== null && lowered!.top > 1) {
        expect(lowered!.bottom, `${name}: hangs 10px above the data`).toBeCloseTo(
          lowered!.anchorPx - 10,
          0,
        )
      }
    }

    await expectDataAnchored('[data-testid="amortization-chart"]', 'amortization')

    // The callout fades: it is a live element while hovering, and the CSS
    // transition on opacity is what runs when it closes. Without the transition
    // it would still snap in and out.
    const amortTip = calc.page.locator('[data-testid="amortization-chart"] .chart-tooltip')
    await expect(amortTip).toHaveAttribute('data-open', 'true')
    const fade = await amortTip.evaluate((element) => {
      const style = getComputedStyle(element)
      return { property: style.transitionProperty, seconds: parseFloat(style.transitionDuration) }
    })
    expect(fade.property, 'opacity is the animated property').toContain('opacity')
    expect(fade.seconds, 'the fade has a duration').toBeGreaterThan(0)
    // Moving off the chart clears it - the hold for the fade must not leave a
    // stale callout behind.
    await calc.page.mouse.move(0, 0)
    await expect(amortTip).toHaveCount(0)

    await calc.page.getByTestId('schedule-view-separate').click()
    await expectDataAnchored('[data-testid="per-track-chart"]', 'per-track')
    // The forecast charts share the same contract, hover dots included: the
    // callout hangs above the highest dot at the hovered year.
    await calc.forecast.scrollTo()
    await expectDataAnchored('[data-testid="forecast-reset-chart"]', 'forecast')
  })

  test.describe('narrow screens', () => {
    test.use({ language: 'english', viewport: { width: 360, height: 800 } })

    test('the per-track tooltip wraps inside the plot instead of hanging past it', async ({
      localizedCalc,
    }) => {
      // One row per track, so in English on a phone the callout used to be
      // wider than the plot it is anchored in. It is now capped at the plot
      // width and the rows wrap; no content may be lost doing so.
      await localizedCalc.goto()
      await localizedCalc.page.getByTestId('schedule-view-separate').click()
      const svg = localizedCalc.page.locator('[data-testid="per-track-chart"] svg')
      await svg.scrollIntoViewIfNeeded()
      const box = (await svg.boundingBox())!
      await svg.hover({ position: { x: box.width * 0.5, y: box.height * 0.6 } })

      const tip = localizedCalc.page.locator('[data-testid="per-track-chart"] .chart-tooltip')
      await expect(tip).toBeVisible()
      await expect(tip.locator('.chart-tooltip-row')).toHaveCount(3)

      const probe = (await localizedCalc.page.evaluate(`(() => {
        const root = document.querySelector('[data-testid="per-track-chart"]')
        const svg = root.querySelector('svg')
        const plot = svg.parentElement.getBoundingClientRect()
        const tip = root.querySelector('.chart-tooltip').getBoundingClientRect()
        return {
          plotWidth: plot.width,
          tipWidth: tip.width,
          insidePlot: tip.left >= plot.left - 0.5 && tip.right <= plot.right + 0.5,
        }
      })()`)) as { plotWidth: number; tipWidth: number; insidePlot: boolean }

      expect(probe.tipWidth, 'never wider than the plot').toBeLessThanOrEqual(
        probe.plotWidth + 0.5,
      )
      expect(probe.insidePlot, 'the whole callout stays inside the plot').toBe(true)
    })
  })

  test('the chart hydrates without a server/client mismatch', async ({ calc }) => {
    // The calculator is prerendered, so anything the server and the browser
    // render differently surfaces here as a React hydration error. The chart is
    // the risky part: its geometry comes out of Math.pow, which is not required
    // to be correctly rounded, so the two renders can land a last bit apart -
    // invisible, but React compares the attributes as written.
    const messages: string[] = []
    calc.page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        messages.push(message.text())
      }
    })
    await calc.page.reload()
    await expect(calc.page.getByTestId('amortization-chart')).toBeVisible()

    const mismatches = messages.filter((text) => /hydrat|did not match|server rendered/i.test(text))
    expect(mismatches, `console:\n${messages.join('\n')}`).toEqual([])
  })
})
