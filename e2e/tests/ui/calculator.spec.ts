import { test, expect } from '@playwright/test'
import { installExternalMocks } from '../../support/mocks'
import { CalculatorPage } from '../../pom/CalculatorPage'
import { formatGroupedNumber, ils } from '../../support/ils'

test.describe('mortgage calculator - core UI flows', () => {
  let calc: CalculatorPage

  test.beforeEach(async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    calc = new CalculatorPage(page)
    await calc.goto()
  })

  test('renders the recommended mix (תמהיל מומלץ) by default', async () => {
    // ₪1,000,000 split prime 400k / fixed 340k / variableIndexed5y 260k,
    // 15y Spitzer → ₪7,772/month (default term is 15)
    await expect(calc.monthlyPayment).toHaveText(ils(7_772))
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.track(1).type()).toHaveValue('prime')
    await expect(calc.track(1).amount()).toHaveValue('400,000')
    await expect(calc.track(2).type()).toHaveValue('fixed')
    await expect(calc.track(2).amount()).toHaveValue('340,000')
    await expect(calc.track(3).type()).toHaveValue('variableIndexed5y')
    await expect(calc.track(3).amount()).toHaveValue('260,000')
    await expect(calc.track(1).years()).toHaveValue('15')
    await expect(calc.termSlider).toHaveValue('15')
    await expect(calc.startingAmount).toHaveValue('1,000,000')
    await expect(calc.formError).toBeHidden()
  })

  test('default mix has three tracks; removal keeps at least one', () => {
    test.setTimeout(45_000)
    return test.step('remove down to one, then guard the last', async () => {
      await expect(calc.page.getByTestId('track-3')).toBeVisible()
      await expect(calc.addTrackButton).toBeHidden()

      await calc.track(3).removeTrack()
      await expect(calc.page.getByTestId('track-3')).toHaveCount(0)
      await calc.track(2).removeTrack()
      await expect(calc.page.getByTestId('track-2')).toHaveCount(0)
      await expect(calc.page.getByTestId('track-1')).toBeVisible()
      await calc.track(1).removeTrack()
      await expect(calc.page.getByTestId('track-1')).toBeVisible()
    })
  })

  test('remove-track stays centered on the select chevron column', async () => {
    // Regression: the × was pinned at a fixed 33px while the fieldset's
    // inline padding narrows to 12px on phones, which drifted it ~6px off the
    // chevron column it stands on. It must line up at every width.
    for (const width of [1280, 360]) {
      await calc.page.setViewportSize({ width, height: 900 })
      await calc.page.locator('[data-testid="track-1"]').scrollIntoViewIfNeeded()
      // String-form evaluate: the e2e tsconfig has no DOM lib.
      const gap = (await calc.page.evaluate(`(() => {
        const field = document.querySelector('[data-testid="track-1"]')
        const remove = field.querySelector('.remove-track')
        const range = document.createRange()
        range.selectNodeContents(remove)
        const ink = range.getBoundingClientRect()
        const cx = ink.x + ink.width / 2
        return [...field.querySelectorAll('.select-chevron')].reduce((best, c) => {
          const b = c.getBoundingClientRect()
          const dx = Math.abs(b.x + b.width / 2 - cx)
          return dx < best ? dx : best
        }, Infinity)
      })()`)) as number
      expect(gap, `× vs chevron column at ${width}px`).toBeLessThanOrEqual(1)
    }
  })

  test('preset baskets populate tracks and highlight selection', async () => {
    // תמהיל 2 = two tracks (fixed + prime, half each).
    await calc.selectPreset('basket2')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.page.getByTestId('track-1')).toBeVisible()
    await expect(calc.page.getByTestId('track-2')).toBeVisible()
    await expect(calc.page.getByTestId('track-3')).toHaveCount(0)
    await expect(calc.track(1).type()).toHaveValue('fixed')
    // Prime track adopts live BOI key rate (4.5) + margin (1.5) = 6.
    await expect(calc.track(2).type()).toHaveValue('prime')
    await expect(calc.track(2).rate()).toHaveValue('6')

    // תמהיל 3 = three equal tracks, including the 5-year variable.
    await calc.selectPreset('basket3')
    await expect(calc.preset('basket3')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.preset('basket2')).toHaveAttribute('aria-pressed', 'false')
    await expect(calc.page.getByTestId('track-3')).toBeVisible()
    await expect(calc.track(1).type()).toHaveValue('fixed')
    await expect(calc.track(3).type()).toHaveValue('variableIndexed5y')

    await calc.selectPreset('basket4')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.preset('basket3')).toHaveAttribute('aria-pressed', 'false')
  })

  test('manual rate override is respected (autoRate cleared)', async () => {
    const track = calc.track(1)
    await track.setType('prime')
    await track.setAmount('300,000')

    await track.rate().fill('9.99')
    await expect(track.rate()).toHaveValue('9.99')

    const before = await calc.monthlyPayment.textContent()
    await track.rate().fill('4.0')
    const after = await calc.monthlyPayment.textContent()
    expect(after).not.toBe(before)
    await expect(track.rate()).toHaveValue(/^4(\.0)?$/)
  })

  test('property/capital bidirectional sync derives and restores the loan', async () => {
    await calc.setPropertyValue('2,000,000')
    await calc.setCapital('500,000')

    await expect(calc.startingAmount).toBeDisabled()
    await expect(calc.startingAmount).toHaveValue('1,500,000')
    // Tracks rescaled to the derived loan (1,500,000 · 40% prime share).
    await expect(calc.track(1).amount()).toHaveValue('600,000')

    // Clearing the property value restores manual entry with remembered gross.
    await calc.setPropertyValue('')
    await expect(calc.startingAmount).toBeEnabled()
    await expect(calc.startingAmount).toHaveValue('2,000,000')
  })

  test('zero loan shows the no-need state', async () => {
    await calc.setPropertyValue('100,000')
    await calc.setCapital('200,000')
    await expect(calc.startingAmount).toBeDisabled()
    await expect(calc.startingAmount).toHaveValue('אין צורך 🥳')
  })

  test('LTV warning triggers above the BoI purpose limit', async () => {
    await calc.selectPurpose('investment')
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('400,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText('60%')
    await expect(calc.summaryNotes).toContainText(ils(500_000))
    // Capital note: 40% ≥ required(50)+15 → good
    await expect(calc.summaryNotes).toContainText('הון עצמי 40% משווי הנכס')
  })

  test('compliant equity and financing ratio merge into one line', async () => {
    // 25% equity + 75% financing on a first home: the two ✔️ facts (equity
    // share, compliant LTV) render as a single merged line.
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('250,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText(
      'הון עצמי 25% משווי הנכס ~ עומד במותר לדירה ראשונה (עד 75%)',
    )
  })

  test('one recommended upfront total replaces the bank-requirement line', async () => {
    // 1M property, 250k equity (loan derives to 750k). The bank's equity
    // requirement no longer gets its own 💡 line (feedback): the single cash
    // line is the recommended total - 250k equity + 0 tax (first home under
    // the exempt bracket) + 30,680 fees = 280,680.
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('250,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText(
      `סה"כ הון עצמי מומלץ לביצוע העסקה: ${ils(280_680)}`,
    )
    await expect(calc.summaryNotes).not.toContainText('אישור הבנק')
    await expect(calc.summaryNotes).not.toContainText('הון עצמי נדרש')
  })

  test('green allowance line names both the payment and the ceiling', async () => {
    // 25% equity + 75% financing, 30,000 income: the 5,829 payment fits
    // under the 33% ceiling (9,900), so the green line quotes both numbers.
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('250,000')
    await calc.setIncome('30,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText(
      `ההחזר החודשי של ${ils(5829)} נמוך מהתקרה המומלצת של ${ils(9900)} לחודש (33% מהכנסה של ${ils(30000)})`,
    )

    // A 1,000 monthly expense reduces the room left for the mortgage: the
    // ceiling drops to 33% × 30,000 - 1,000 = 8,900, and the payment still
    // fits underneath it.
    await calc.page.getByTestId('expense-amount-expense-1').fill('1,000')
    await expect(calc.summaryNotes).toContainText(
      `ההחזר החודשי של ${ils(5829)} נמוך מהתקרה המומלצת של ${ils(8900)} לחודש (33% מהכנסה של ${ils(30000)} פחות ${ils(1000)})`,
    )
  })

  test('income below the required payment flags the allowance and suggests a minimum', async () => {
    await calc.setIncome('1,000')
    await expect(calc.summaryNotes).toBeVisible()
    // The required payment is a neutral 💡 fact line: term and figure.
    await expect(calc.summaryNotes).toContainText('לתקופה של 15 שנים')
    await expect(calc.summaryNotes).toContainText('7,772')
    // Affordability line (bad ❌, short): at the 33% ceiling the 1,000 income
    // allows ceil(1,000 × 0.33) = 330, far below the required payment, and
    // the line names the expected payment and the minimum income that fits.
    await expect(calc.summaryNotes).toContainText('ההכנסה לא מספיקה להחזר החודשי הצפוי')
    await expect(calc.summaryNotes).toContainText(ils(7_772))
    await expect(calc.summaryNotes).toContainText('33%')
    await expect(calc.summaryNotes).toContainText(ils(1_000))
    await expect(calc.summaryNotes).toContainText('24,000')
    // Income hint: ceil((7772 / 0.33 + 0)/500)·500 = 24,000 - typing it makes
    // the ceiling allowance cover the payment.
    await expect(calc.monthlyIncome).toHaveAttribute('placeholder', formatGroupedNumber(24_000))
  })

  test('variable-rate cap blocks calculation and auto-fix trims variable tracks only', async () => {
    const track1 = calc.track(1)
    await calc.setPropertyValue('1,000,000')
    await track1.setType('prime')
    await track1.setAmount('900,000')

    await expect(calc.formError).toContainText('66.66%')
    await expect(calc.autofixButton).toBeVisible()
    await expect(track1.legend()).toHaveClass(/variable-limit-flag/)

    await calc.autofixButton.click()
    await expect(calc.formError).toBeHidden()
    await expect(calc.autofixButton).toBeHidden()
    // Auto-fix keeps the fixed track (56,667) as entered and trims only the
    // variable tracks down to the ⅔ ceiling (2·56,667 = 113,334 across prime
    // and the 5-year variable), so the loan total shrinks to 170,001 instead
    // of inflating the fixed track.
    await expect(calc.track(1).amount()).toHaveValue('108,128')
    await expect(calc.track(2).amount()).toHaveValue('56,667')
    await expect(calc.track(3).amount()).toHaveValue('5,206')
    await expect(calc.monthlyPayment).not.toHaveText('₪0')
  })

  test('auto-fix without a pinned property shrinks the loan total', async () => {
    // Prime 900,000 (variable) on top of the default fixed 340,000 and 5-year
    // variable 260,000 exceeds the ⅔ ceiling. Auto-fix keeps the fixed 340,000
    // as entered and trims the variable tracks to 2×340,000 = 680,000, so the
    // loan drops from 1,500,000 to 1,020,000 and the loan field follows.
    await calc.track(1).setAmount('900,000')
    await expect(calc.autofixButton).toBeVisible()
    await calc.autofixButton.click()
    await expect(calc.autofixButton).toBeHidden()
    await expect(calc.track(1).amount()).toHaveValue('527,586')
    await expect(calc.track(2).amount()).toHaveValue('340,000')
    await expect(calc.track(3).amount()).toHaveValue('152,414')
    await expect(calc.startingAmount).toHaveValue('1,020,000')
  })

  test('typing a home amount fills empty tracks with the recommended mix', async () => {
    // With some tracks left empty (e.g. cleared), the whole loan used to land
    // in whichever single track still held money - usually the last variable
    // one, which then tripped the ⅔ cap. Typing the home/property amount must
    // re-allocate the loan across all tracks with the active preset's mix:
    // 40/34/26 of ₪1,500,000 → 600,000 / 510,000 / 390,000.
    await calc.track(1).amount().fill('')
    await calc.track(1).amount().blur()
    await calc.track(2).amount().fill('')
    await calc.track(2).amount().blur()
    await calc.setPropertyValue('1,500,000')
    await expect(calc.track(1).amount()).toHaveValue('600,000')
    await expect(calc.track(2).amount()).toHaveValue('510,000')
    await expect(calc.track(3).amount()).toHaveValue('390,000')
    await expect(calc.formError).toBeHidden()
  })

  test('clearing a track under a pinned loan splits it evenly across survivors', async () => {
    await calc.setPropertyValue('2,000,000')
    // Clearing the prime track frees its share of the ₪2,000,000 loan - the
    // two survivors split the whole loan evenly (₪1,000,000 each) instead of
    // the largest one absorbing most of the freed money.
    await calc.track(1).amount().fill('')
    await calc.track(1).amount().blur()
    await expect(calc.track(1).amount()).toHaveValue('')
    await expect(calc.track(2).amount()).toHaveValue('1,000,000')
    await expect(calc.track(3).amount()).toHaveValue('1,000,000')
    await expect(calc.startingAmount).toHaveValue('2,000,000')
    await expect(calc.formError).toBeHidden()
  })

  test('schedule always shows the full horizon, with no expand button', async () => {
    // Default term is 15y - the full 15 rows render, no expand control.
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(15)

    await calc.termSlider.fill('30')
    await expect(calc.page.getByTestId('expand-schedule')).toHaveCount(0)
    await expect(calc.page.locator('[data-testid^="schedule-year-"]')).toHaveCount(30)
  })

  test('monthly schedule tab relabels the payment axis and matches yearly label density', async () => {
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
          .filter((n) => n.getAttribute('y') === '296')
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
    // 15 yearly rows: 15 stacked bars (principal + interest rects), no area.
    expect(yearly!.bars).toBe(30)
    expect(yearly!.areas).toBe(0)
    expect(yearly!.titles).toContain('תשלום שנתי')
    expect(yearly!.xLabels).toHaveLength(15)

    await calc.page.getByTestId('schedule-granularity-monthly').click()
    const monthly = (await calc.page.evaluate(probe)) as typeof yearly
    // 180 monthly rows cannot be bars: the same curve becomes two areas.
    expect(monthly!.bars).toBe(0)
    expect(monthly!.areas).toBe(2)
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

  test('per-track chart follows the monthly tab like the total view does', async () => {
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

  test('no schedule table is shown while no loan is entered', async () => {
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

  test('track years field edits as a number input clamped to 30', async () => {
    const years = calc.track(1).years()
    await expect(years).toHaveAttribute('type', 'number')
    await expect(years).toHaveValue('15')

    // Appending clamps to the 30-year max (15 + "0" = 150 → 30).
    await years.focus()
    await calc.page.keyboard.press('End')
    await calc.page.keyboard.type('0')
    await expect(years).toHaveValue('30')

    // Select-all and overwrite works and persists.
    await years.focus()
    await calc.page.keyboard.press('Control+a')
    await calc.page.keyboard.type('20')
    await expect(years).toHaveValue('20')
    await years.blur()
    await expect(years).toHaveValue('20')

    // Clearing is allowed; blur restores a minimum of 1.
    await years.focus()
    await calc.page.keyboard.press('Control+a')
    await calc.page.keyboard.press('Backspace')
    await expect(years).toHaveValue('')
    await years.blur()
    await expect(years).toHaveValue('1')
  })

  test('term slider drives track years both ways', async () => {
    // NOTE: RTL range inputs invert arrow-key direction differently per engine
    // (Chromium/Firefox invert, WebKit does not) - drive the value directly,
    // which exercises the same onChange wiring as native keyboard input.
    await calc.termSlider.fill('29')
    await expect(calc.termSlider).toHaveValue('29')
    await expect(calc.track(1).years()).toHaveValue('29')
    await expect(calc.page.getByTestId('total-payment-label')).toContainText('ל-29 שנים')
  })

  test('reset asks for confirmation then restores the default mix', async () => {
    await calc.selectPreset('basket4')
    await calc.setPropertyValue('3,000,000')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')

    // Clicking reset opens the confirmation modal without clearing anything yet.
    await calc.resetButton.click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeVisible()
    await expect(calc.propertyValue).toHaveValue('3,000,000')

    // Cancelling keeps all data untouched.
    await calc.page.getByTestId('reset-confirm-no').click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeHidden()
    await expect(calc.propertyValue).toHaveValue('3,000,000')

    // Confirming zeros the sum and returns to תמהיל מומלץ (still selected, blank).
    await calc.resetButton.click()
    await calc.page.getByTestId('reset-confirm-yes').click()
    await expect(calc.page.getByTestId('reset-confirm')).toBeHidden()
    await expect(calc.propertyValue).toHaveValue('')
    await expect(calc.startingAmount).toBeEnabled()
    await expect(calc.startingAmount).toHaveValue('')
    await expect(calc.preset('basket4')).toHaveAttribute('aria-pressed', 'true')
    await expect(calc.track(1).type()).toHaveValue('prime')
    // Track amounts come back blank (not "0") so nothing counts as entered
    // and no "positive amount" error appears.
    await expect(calc.track(1).amount()).toHaveValue('')
    await expect(calc.track(2).amount()).toHaveValue('')
    await expect(calc.track(3).amount()).toHaveValue('')
    await expect(calc.formError).toBeHidden()
    await expect(calc.termSlider).toHaveValue('15')
  })
})
