import { test, expect } from '../../fixtures'
import type { CalculatorPage } from '../../pages/CalculatorPage'
import { ils } from '../../support/ils'

/**
 * Comparison feature e2e: the /compare page shows N scenarios side by side
 * against shared buyer inputs, with best-in-row highlighting and regulatory
 * status. Every figure is cross-checked against the main calculator's
 * displayed values (same pure functions, so the numbers must agree).
 */

test.describe('mortgage comparison - /compare', () => {
  /** Navigate via the calculator CTA so the comparison is seeded from it. */
  async function gotoSeeded(calc: CalculatorPage): Promise<void> {
    await calc.goto()
    await calc.page.getByTestId('open-comparison').click()
    await expect(calc.page.getByTestId('compare-shell')).toBeVisible()
  }

  test('seeds from the calculator: same mix priced by the comparison rows', async ({
    calc,
    page,
  }) => {
    // The calculator's ₪1,000,000 recommended mix at 15y shows ₪7,772 first
    // payment; the comparison prices the same mix into its own rows: the
    // average payment (golden: total 1,451,762.66 / 180 = 8,065.35) and the
    // recommended net income at the 33% ceiling (ceil(8065.35/0.33/500)·500).
    await calc.goto()
    await expect(calc.monthlyPayment).toHaveText(ils(7_772))
    await calc.page.getByTestId('open-comparison').click()
    await expect(calc.page.getByTestId('compare-shell')).toBeVisible()
    const avgCell = page.getByTestId('compare-row-avgPayment').locator('td').first()
    await expect(avgCell).toContainText(ils(8_065))
    const incomeCell = page.getByTestId('compare-row-recommendedIncome').locator('td').first()
    await expect(incomeCell).toContainText(ils(24_500))
  })

  test('default (direct) visit opens scenario 1 with the calculator default mix', async ({
    page,
  }) => {
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toBeVisible()
    // Scenario 1 (תרחיש 1) opens with the calculator's own ₪1,000,000
    // תמהיל מומלץ: 400k prime @ 5.75 + 340k fixed @ 4.5 + 260k indexed @ 3.0
    // (fallback prime - the compare page does not fetch the live BOI rate).
    await expect(page.getByTestId('compare-track-amount-1-1')).toHaveValue('400,000')
    await expect(page.getByTestId('compare-track-rate-1-1')).toHaveValue('5.75')
    // Scenario 2 stays blank: the alternative mix is the user's to define.
    await expect(page.getByTestId('compare-track-amount-2-1')).toHaveValue('')
    await expect(page.getByTestId('compare-track-rate-2-1')).toHaveValue('4.5')
    const row = page.getByTestId('compare-row-avgPayment')
    await expect(row.locator('td')).toHaveCount(2)
    // One priced column has nothing to beat yet: no best highlighting.
    await expect(row.locator('td.best')).toHaveCount(0)
    // Scenario 1's mix averages ₪8,011.56/month (hand-checked golden:
    // total 1,442,081 / 180 months); the blank column reads as "no figures
    // yet", not as a ₪0 mortgage.
    await expect(row.locator('td').first()).toHaveText(ils(8_012))
    await expect(row.locator('td').nth(1)).toHaveText('-')
    // The recommended net income row: 33% ceiling on the average payment
    // (ceil(8011.56/0.33/500)·500 = 24,500); dash for the blank scenario.
    const incomeRow = page.getByTestId('compare-row-recommendedIncome')
    await expect(incomeRow.locator('td').first()).toHaveText(ils(24_500))
    await expect(incomeRow.locator('td').nth(1)).toHaveText('-')
    await expect(page.getByTestId('compare-row-status')).toContainText('הזינו מסלולים')
    // A term now exists, so the payments row names it instead of the generic.
    await expect(page.getByTestId('compare-row-totalPayment').locator('th')).toHaveText(
      'סך התשלומים ל-15 שנים',
    )
  })

  test('tweaking one scenario highlights the best value per row', async ({ calc, page }) => {
    await gotoSeeded(calc)
    // Scenario 2 opens blank, so give it something to compare against by
    // duplicating the mix the calculator seeded into scenario 1 (the copy
    // lands in the middle: [mix, copy, blank]).
    await page.getByTestId('compare-duplicate-1').click()
    await expect(page.getByTestId('compare-scenario-editor-3')).toBeVisible()
    // Scenario 1: stretch the scenario term to 20 years - the same loan over
    // 240 months instead of 180, so a lower average payment (6,784.52 vs
    // 8,065.35, seeded at the mocked prime 6.0) and a higher total interest
    // (563,258 vs 405,916). The scenario term slider drives every track.
    await page.getByTestId('compare-term-1').fill('20')

    // The longer term must win the average-payment row (scenario 1 = first td)
    // while losing the total-interest row (scenario 2 = second td wins).
    const interestRow = page.getByTestId('compare-row-totalInterest')
    await expect(interestRow.locator('td').nth(1)).toHaveClass(/best/)
    const avgRow = page.getByTestId('compare-row-avgPayment')
    await expect(avgRow.locator('td').first()).toHaveClass(/best/)
  })

  test('blank shared inputs hint the values the priced scenarios need', async ({ page }) => {
    await page.goto('/compare')
    // Scenario 1 carries the calculator's ₪1,000,000 recommended mix and
    // scenario 2 is blank, so the hints come from that one priced column:
    // the value financing ₪1M at the 75% first-home limit, its required 25%
    // equity, and the income whose 33% ceiling allowance carries the mix's
    // 7,718.13 first payment.
    await expect(page.getByTestId('compare-property-value')).toHaveAttribute(
      'placeholder',
      '1,333,500',
    )
    await expect(page.getByTestId('compare-capital')).toHaveAttribute('placeholder', '250,000')
    await expect(page.getByTestId('compare-income')).toHaveAttribute('placeholder', '23,500')

    // Typing the property value drops its own hint (advice only shows while
    // the field is blank) and re-derives the equity hint from the typed value
    // (25% of ₪1.2M), following תכלית הרכישה.
    await page.getByTestId('compare-property-value').fill('1,200,000')
    expect(await page.getByTestId('compare-property-value').getAttribute('placeholder')).toBeNull()
    await expect(page.getByTestId('compare-capital')).toHaveAttribute('placeholder', '300,000')

    // תכלית הרכישה re-prices the same hint: an investment property needs 50%
    // of the ₪1.2M value in equity.
    await page.getByTestId('compare-purpose').selectOption('investment')
    await expect(page.getByTestId('compare-capital')).toHaveAttribute('placeholder', '600,000')
  })

  test('duplicate scenario, edit the copy, then remove it', async ({ calc, page }) => {
    await gotoSeeded(calc)
    await page.getByTestId('compare-duplicate-1').click()
    // Three scenarios now; the copy sits next to the original with equal amounts.
    await expect(page.getByTestId('compare-track-2-1')).toBeVisible()
    const original = page.getByTestId('compare-track-amount-1-1')
    const copy = page.getByTestId('compare-track-amount-2-1')
    await expect(copy).toHaveValue(await original.inputValue())

    // Editing the copy leaves the original untouched.
    await copy.fill('800,000')
    await copy.blur()
    await expect(original).toHaveValue('400,000')

    // Remove the middle scenario (the edited copy) back down to two: the blank
    // alternative that was scenario 2 moves up into its place.
    await page.getByTestId('compare-scenario-remove-2').click()
    await expect(page.getByTestId('compare-track-amount-2-1')).toHaveValue('')
    await expect(page.getByTestId('compare-scenario-remove-2')).toHaveCount(0)
  })

  test('the one shared sum prices every mix (calculator parity)', async ({ page }) => {
    await page.goto('/compare')
    // One loan for the whole page: it opens with the calculator's ₪1,000,000
    // prefill, and scenario 1's recommended preset is highlighted.
    await expect(page.getByTestId('compare-mortgage-sum')).toHaveValue('1,000,000')
    await expect(page.getByTestId('compare-preset-1-basket4')).toHaveClass(/active/)
    // Scenario 2 opens blank. Picking the recommended preset prices it at the
    // shared loan right away - the 40/34/26 split of ₪1,000,000 (golden) -
    // with no per-scenario loan to type.
    await page.getByTestId('compare-preset-2-basket4').click()
    await expect(page.getByTestId('compare-track-amount-2-1')).toHaveValue('400,000')
    await expect(page.getByTestId('compare-track-amount-2-2')).toHaveValue('340,000')
    await expect(page.getByTestId('compare-track-amount-2-3')).toHaveValue('260,000')
    // Re-typing the sum re-allocates EVERY scenario's mix (both carry the
    // basket4 lineup), so the columns stay directly comparable.
    await page.getByTestId('compare-mortgage-sum').fill('2,000,000')
    await expect(page.getByTestId('compare-track-amount-1-1')).toHaveValue('800,000')
    await expect(page.getByTestId('compare-track-amount-2-3')).toHaveValue('520,000')
    // A property value re-derives the one loan: capital 200k on a 1.2M
    // property mirrors 1M into the sum field.
    await page.getByTestId('compare-property-value').fill('1,200,000')
    await page.getByTestId('compare-capital').fill('200,000')
    await expect(page.getByTestId('compare-mortgage-sum')).toHaveValue('1,000,000')
  })

  test('shared inputs reprice every scenario; LTV status flips to a violation', async ({
    calc,
    page,
  }) => {
    await gotoSeeded(calc)
    // Property 1.2M, capital 200k → loan context 1M = 83.3% > 75% first-home
    // limit: both scenario columns show the LTV violation.
    await page.getByTestId('compare-property-value').fill('1,200,000')
    await page.getByTestId('compare-capital').fill('200,000')

    const statusRow = page.getByTestId('compare-row-status')
    await expect(statusRow).toContainText('חריגה מתקרת המימון')
    // Upfront total row shows the recommended cash figure for the shared deal.
    const upfrontRow = page.getByTestId('compare-row-upfront')
    await expect(upfrontRow).toContainText(ils(335_400))
  })

  test('other expenses fold into PTI, the boundary, and the upfront cash', async ({ page }) => {
    await page.goto('/compare')
    // Income 24,000: the opening mix's 7,718.13 first payment is 32.2% of it,
    // under the 33% ceiling - no PTI warning in the priced column.
    await page.getByTestId('compare-income').fill('24,000')
    const statusRow = page.getByTestId('compare-row-status')
    await expect(statusRow).toContainText('החזר בתקרה המומלצת')
    // The recommended-income row already reports the average-based advice:
    // ceil(8011.56/0.33/500)·500 = 24,500 at the default inputs.
    const incomeRow = page.getByTestId('compare-row-recommendedIncome')
    await expect(incomeRow.locator('td').first()).toHaveText(ils(24_500))

    // The shared expenses block opens with one blank row (calculator parity);
    // the row test ids carry the internal id suffix, so match the prefix.
    const monthly = page.locator('[data-testid^="compare-expense-amount-"]')
    await expect(monthly).toHaveCount(1)
    // ₪1,000/month lifts the obligation to 8,718.13 = 36.3%: over the ceiling.
    await monthly.fill('1,000')
    await expect(statusRow).toContainText('מעל תקרת החזר')
    // The warning clears exactly at the reported minimum income
    // (8,718.13 / 26,500 = 32.9%): the boundary itself, not just past it.
    await page.getByTestId('compare-income').fill('26,500')
    await expect(statusRow).toContainText('החזר בתקרה המומלצת')
    // The recommended income folds the expense in too: 8011.56 + 1000 =
    // 9011.56 → ceil(9011.56/0.33/500)·500 = 27,500.
    await expect(incomeRow.locator('td').first()).toHaveText(ils(27_500))

    // The one-time amount joins the recommended upfront cash: 300,000
    // suggested capital + 35,400 fees on the 1.2M deal, then +5,000.
    await page.getByTestId('compare-property-value').fill('1,200,000')
    await page.getByTestId('compare-capital').fill('200,000')
    const upfrontRow = page.getByTestId('compare-row-upfront')
    await expect(upfrontRow).toContainText(ils(335_400))
    await page.locator('[data-testid^="compare-expense-onetime-"]').fill('5,000')
    await expect(upfrontRow).toContainText(ils(340_400))

    // Removing the row reprices both figures back down.
    await page.locator('[data-testid^="compare-expense-remove-"]').click()
    await expect(page.locator('[data-testid^="compare-expense-amount-"]')).toHaveCount(0)
    await expect(upfrontRow).toContainText(ils(335_400))
    await expect(statusRow).toContainText('החזר בתקרה המומלצת')
  })

  test('comparison table fits its card instead of scrolling sideways', async ({ calc, page }) => {
    await gotoSeeded(calc)
    // Figures in every column: the currency values, the mix line and the status
    // chips are what used to widen the table past its card (the metric names
    // and values were all nowrap, so nothing could give).
    await page.getByTestId('compare-track-amount-2-1').fill('900,000')
    await page.getByTestId('compare-track-amount-2-1').blur()
    await page.getByTestId('compare-duplicate-1').click()
    await expect(page.getByTestId('compare-scenario-editor-3')).toBeVisible()

    const sideways = async () =>
      (await page.evaluate(`(() => {
        const wrap = document.querySelector('.compare-table-wrap')
        return wrap.scrollWidth - wrap.clientWidth
      })()`)) as number

    for (const width of [768, 860, 900, 1024, 1100, 1280, 1600]) {
      await page.setViewportSize({ width, height: 900 })
      expect(
        await sideways(),
        `comparison table scrolls sideways at ${width}px`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('mobile: stacked card view with a scenario switcher (no table)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/compare')
    await expect(page.getByTestId('compare-card')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toHaveCount(0)
    // Tab 2 shows scenario 2's metrics; the editor switches with it.
    await page.getByTestId('compare-switch-tab-2').click()
    await expect(page.getByTestId('compare-card')).toContainText('תרחיש 2')
    await expect(page.getByTestId('compare-scenario-editor-2')).toBeVisible()
    // No horizontal overflow at 375px.
    const overflow = (await page.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    )) as number
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('English page renders LTR with translated labels', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    await expect(page.getByTestId('compare-table')).toContainText('Average monthly payment')
    await expect(page.getByTestId('compare-table')).toContainText('Recommended net income')
    const dir = (await page.evaluate('document.documentElement.dir')) as string
    expect(dir).toBe('ltr')
  })

  test('Hebrew page renders RTL', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_language', 'hebrew'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    const dir = (await page.evaluate('document.documentElement.dir')) as string
    expect(dir).toBe('rtl')
  })

  test('dark theme: compare surfaces flip with the tokens', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('site_theme', 'dark'))
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    const colors = (await page.evaluate(`(() => {
      const panel = document.querySelector('.compare-shared')
      return {
        background: getComputedStyle(panel).backgroundColor,
        ink: getComputedStyle(panel).color,
      }
    })()`)) as { background: string; ink: string }
    // Dark theme's --calc-paper is #16201f; the panel must not stay light.
    expect(colors.background).not.toBe('rgb(255, 253, 248)')
  })
})

/**
 * Scenario-editor layout invariants, as a list of problems (empty = sound).
 *
 * Regression guard: the editors originally reused the calculator's 5-column
 * track grid inside a ~315-610px column, where the fields' intrinsic widths
 * widened the fieldset to ~960-1040px - it spilled hundreds of pixels outside
 * its card (over the neighbouring scenario) and dragged the per-track remove
 * button with it. Fields must now stay inside their own card at every width,
 * every select must be able to show its text, and the comparison table must
 * not scroll sideways.
 */
const LAYOUT_PROBLEMS = `(() => {
  const problems = []
  const doc = document.documentElement
  const overflow = doc.scrollWidth - doc.clientWidth
  if (overflow > 1) problems.push('page overflows by ' + overflow + 'px')
  const within = (inner, outer, tolerance) =>
    inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance

  // Text a field cannot show is text the browser cuts in half, and a select
  // never wraps: every option has to fit the room the field really has (its
  // 36px of inline-end padding already reserves the chevron).
  const textWidth = (element, text) => {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.whiteSpace = 'pre'
    probe.style.font = getComputedStyle(element).font
    probe.textContent = text
    document.body.appendChild(probe)
    const width = probe.getBoundingClientRect().width
    probe.remove()
    return width
  }
  const fits = (select, texts, where) => {
    const style = getComputedStyle(select)
    const room =
      select.clientWidth -
      parseFloat(style.paddingInlineStart) -
      parseFloat(style.paddingInlineEnd)
    texts.forEach((text) => {
      const needed = textWidth(select, text)
      if (needed > room) {
        problems.push(
          where + ' needs ' + Math.round(needed) + 'px for "' + text + '" but has ' + Math.round(room) + 'px',
        )
      }
    })
  }
  // The purchase purpose is a fixed three-way pick the page prices its LTV
  // limits from, so all three options must stay readable...
  const purpose = document.querySelector('[data-testid="compare-purpose"]')
  if (purpose) {
    fits(purpose, Array.from(purpose.options).map((option) => option.text), 'purpose select')
  }
  // ...while the track type list is the calculator's fixed regulatory
  // vocabulary (longest entry wishes it had 400px), so only the chosen value
  // has to be readable.
  document.querySelectorAll('.compare-track select').forEach((select, index) => {
    const chosen = select.options[select.selectedIndex]
    fits(select, [chosen ? chosen.text : ''], 'track select ' + (index + 1))
  })

  // No sideways scrolling: the comparison table must fit its own card at every
  // width the table layout is used (768px up).
  const tableWrap = document.querySelector('.compare-table-wrap')
  if (tableWrap && tableWrap.scrollWidth - tableWrap.clientWidth > 1) {
    problems.push(
      'comparison table scrolls sideways by ' + (tableWrap.scrollWidth - tableWrap.clientWidth) + 'px',
    )
  }

  document.querySelectorAll('.compare-scenario-editor').forEach((card, cardIndex) => {
    const cardBox = card.getBoundingClientRect()
    card.querySelectorAll('.mortgage-track').forEach((track, trackIndex) => {
      const where = 'card ' + (cardIndex + 1) + ' track ' + (trackIndex + 1)
      const trackBox = track.getBoundingClientRect()
      if (!within(trackBox, cardBox, 1)) {
        problems.push(where + ' sits ' + Math.round(trackBox.width) + 'px wide in a ' + Math.round(cardBox.width) + 'px card')
      }
      track.querySelectorAll('.input-wrap, .select-wrap').forEach((wrap, wrapIndex) => {
        const wrapBox = wrap.getBoundingClientRect()
        if (!within(wrapBox, trackBox, 1)) {
          problems.push(where + ' field ' + (wrapIndex + 1) + ' spills out of the track')
        }
        // Squeezed columns are the other half of the same failure: a field
        // narrow enough to hide its own number is as broken as one that
        // overlaps the next scenario.
        if (wrapBox.width < 96) {
          problems.push(where + ' field ' + (wrapIndex + 1) + ' is only ' + Math.round(wrapBox.width) + 'px wide')
        }
      })
      const remove = track.querySelector('.remove-track')
      const legend = track.querySelector('legend')
      if (remove && legend) {
        const a = remove.getBoundingClientRect()
        const b = legend.getBoundingClientRect()
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          problems.push(where + ' remove button overlaps its legend')
        }
      }
      // The remove button belongs on the fieldset's chevron column (the same
      // spot it keeps in the calculator), above the fields - not floating in
      // the card's corner.
      const chevron = track.querySelector('.select-chevron')
      if (remove && chevron) {
        const a = remove.getBoundingClientRect()
        const b = chevron.getBoundingClientRect()
        const delta = Math.abs(a.left + a.width / 2 - (b.left + b.width / 2))
        if (delta > 8) {
          problems.push(where + ' remove button is ' + Math.round(delta) + 'px off the chevron column')
        }
        if (a.bottom > b.top) {
          problems.push(where + ' remove button is not above the field rows')
        }
      }
      // The term slider's value bubble drops below its row; it must land in the
      // reserved strip above the preset mixes, not on top of the buttons below
      // it (the slider now sits directly above them).
      if (trackIndex === 0) {
        const bubble = card.querySelector('.compare-term-row .slider-current')
        const presets = card.querySelector('.compare-preset-list')
        if (
          bubble &&
          presets &&
          bubble.getBoundingClientRect().bottom > presets.getBoundingClientRect().top + 1
        ) {
          problems.push(where + ' slider value overlaps the preset mixes')
        }
      }
    })
  })
  return problems
})()`

/** Desktop widths, from the 768px table/card switch up to the 1240px shell. */
const EDITOR_WIDTHS = [768, 900, 1024, 1280, 1600]

for (const language of ['hebrew', 'english'] as const) {
  test(`scenario editors stay inside their cards at every width - ${language}`, async ({
    page,
  }) => {
    await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
    await page.goto('/compare')
    await expect(page.getByTestId('compare-shell')).toBeVisible()
    // Scenario 1 opens with the calculator's 3-track mix, so its remove
    // buttons render from the start - the anchoring is measured at every
    // width without adding anything.
    await expect(page.getByTestId('compare-track-remove-1-1')).toBeVisible()

    for (const width of EDITOR_WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        language === 'hebrew' ? 'rtl' : 'ltr',
      )
      expect(await page.evaluate(LAYOUT_PROBLEMS), `compare layout at ${width}px`).toEqual([])
    }

    // Three scenarios squeeze the editor columns to ~315px - the tightest the
    // side-by-side layout gets - so re-check with one duplicated copy.
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.getByTestId('compare-duplicate-1').click()
    await expect(page.getByTestId('compare-scenario-editor-3')).toBeVisible()
    expect(await page.evaluate(LAYOUT_PROBLEMS), 'compare layout with 3 scenarios').toEqual([])
  })
}

test('phone and tablet widths hold the same invariants', async ({ page }) => {
  // Below 768px the page swaps the table for the stacked card and the scenario
  // switcher; the field/select invariants still have to hold there.
  for (const language of ['hebrew', 'english'] as const) {
    await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
    for (const width of [360, 420, 650]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/compare')
      await expect(page.getByTestId('compare-shell')).toBeVisible()
      expect(
        await page.evaluate(LAYOUT_PROBLEMS),
        `compare layout at ${width}px (${language})`,
      ).toEqual([])
    }
  }
})

test('back link returns to the calculator and flips with the reading direction', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('site_language', 'hebrew'))
  await page.goto('/compare')
  const back = page.getByTestId('compare-back')
  await expect(back).toBeVisible()
  await expect(back).toHaveAttribute('href', '/calculators')
  await expect(back).toContainText('חזרה למחשבון')

  const arrow = async () =>
    (await page.evaluate(`(() => {
      const icon = document.querySelector('.compare-back-icon')
      const link = document.querySelector('.compare-back')
      const i = icon.getBoundingClientRect()
      const l = link.getBoundingClientRect()
      return {
        transform: getComputedStyle(icon).transform,
        fromStart: i.left - l.left,
        fromEnd: l.right - i.right,
      }
    })()`)) as { transform: string; fromStart: number; fromEnd: number }

  // The arrow trails the label in reading order in both directions: on the
  // inline end in LTR (the right), mirrored to the inline end in RTL (the
  // left) by the stylesheet, so "back" points the way the layout reads.
  const rtl = await arrow()
  expect(rtl.transform).toBe('matrix(-1, 0, 0, 1, 0, 0)')
  expect(rtl.fromStart, 'RTL arrow sits at the inline end (the left)').toBeLessThan(2)

  await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
  await page.goto('/compare')
  await expect(page.getByTestId('compare-back')).toContainText('Back to the mortgage calculator')
  const ltr = await arrow()
  expect(ltr.transform).toBe('none')
  expect(ltr.fromEnd, 'LTR arrow sits at the inline end (the right)').toBeLessThan(2)
})

test('English compare heading fits a 360px viewport', async ({ page }) => {
  // "Mortgage scenario comparison" is the longest hero title on the site and
  // used to overhang the viewport (the hero h1 is nowrap by default).
  await page.addInitScript(() => localStorage.setItem('site_language', 'english'))
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/compare')
  await expect(page.getByTestId('compare-shell')).toBeVisible()
  const overflow = (await page.evaluate(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )) as number
  expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
})
