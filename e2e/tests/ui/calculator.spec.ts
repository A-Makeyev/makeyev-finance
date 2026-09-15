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

  test('fee amounts keep the room to show a full ₪ figure at every width', async () => {
    // Regression: the costs row's four columns squeezed the ₪ side of the
    // realtor / lawyer pairs - the percent sits on a 100px floor, so every
    // pixel the row lost came off the amount, leaving it 72px at 940px and
    // 53px at 481px. The leading digits of a real fee ("23,600") were hidden
    // while the field looked fine. The row must fold to fewer columns before
    // the amount runs out of room. 940 and 560 are the widths that used to
    // squeeze the pair; the rest guard the other layouts around them.
    const widths = [1440, 1160, 1024, 940, 700, 560, 360]
    for (const width of widths) {
      await calc.page.setViewportSize({ width, height: 900 })
      await calc.page.locator('[data-testid="lawyer-amount"]').scrollIntoViewIfNeeded()
      // String-form evaluate: the e2e tsconfig has no DOM lib.
      const metrics = (await calc.page.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d')
        const digits = '1,000,000'
        const fields = ['realtor-amount', 'lawyer-amount'].map((id) => {
          const el = document.querySelector('[data-testid="' + id + '"]')
          const cs = getComputedStyle(el)
          ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
          const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
          return {
            room: el.clientWidth - pad,
            needed: ctx.measureText(digits).width,
          }
        })
        return {
          fields,
          overflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })()`)) as { fields: { room: number; needed: number }[]; overflow: number }

      for (const field of metrics.fields) {
        expect(
          field.room,
          `₪ text area at ${width}px (needs ${Math.ceil(field.needed)})`,
        ).toBeGreaterThanOrEqual(field.needed)
      }
      expect(metrics.overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
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

  test('purchase-tax info line leads the 💡 group', async () => {
    // 2,000,000 first home: tax = (2,000,000 - 1,978,745) × 3.5% = 743.925,
    // displayed to the shekel as 744 (0.04%). The purchase tax is the first
    // 💡 fact about the deal, ahead of the required-payment line (feedback
    // request).
    await calc.setPropertyValue('2,000,000')
    await calc.setCapital('500,000')

    await expect(calc.summaryNotes).toBeVisible()
    const infoLines = calc.summaryNotes.locator('.note-line.info')
    await expect(infoLines.first()).toContainText('מס רכישה (דירה ראשונה)')
    await expect(infoLines.first()).toContainText(ils(744))
    // The required payment follows it, not leads it.
    await expect(infoLines.nth(1)).toContainText('ההחזר החודשי לתקופה של')
  })

  test('purchase-tax breakdown shows the full ladder', async () => {
    // 2,000,000 first home: each reached band quotes the part of THIS value
    // landing in it and its tax (the rows sum to the exact tax), unreached
    // bands dash out, the 3.5% band the value falls into is highlighted, and
    // the total quotes the tax for this value (743.925 → 744 displayed).
    await calc.setPropertyValue('2,000,000')
    await calc.setCapital('500,000')

    const breakdown = calc.page.getByTestId('purchase-tax-breakdown')
    await expect(breakdown).toBeVisible()
    await expect(breakdown.locator('summary')).toHaveText('פירוט מס רכישה')
    await breakdown.locator('summary').click()

    const rows = breakdown.locator('tbody tr')
    await expect(rows).toHaveCount(5)
    await expect(rows.nth(0)).toContainText('0%')
    await expect(rows.nth(0)).toContainText(ils(1_978_745))
    // The current band: only 21,255 ₪ of the value lands in it, taxed 744 ₪.
    await expect(rows.nth(1)).toContainText('3.5%')
    await expect(rows.nth(1)).toContainText(ils(2_347_040))
    await expect(rows.nth(1)).toContainText(ils(21_255))
    await expect(rows.nth(1)).toContainText(ils(744))
    // Bands above the value stay dashed out.
    await expect(rows.nth(2)).toContainText('5%')
    await expect(rows.nth(2)).toContainText('-')
    await expect(rows.nth(3)).toContainText('8%')
    await expect(rows.nth(3)).toContainText('-')
    await expect(rows.nth(4)).toContainText('10%')
    await expect(rows.nth(4)).toContainText('ומעלה')
    // The unreached open-ended top band dashes too, like the other
    // unreached bands.
    await expect(rows.nth(4).locator('td').nth(2)).toHaveText('-')
    await expect(rows.nth(4).locator('td').nth(3)).toHaveText('-')

    // The current band is highlighted AND framed: its background differs from
    // an ordinary row's, and so does its accent border color.
    await expect(rows.nth(1)).toHaveClass(/is-current/)
    await expect(rows.nth(1)).toHaveAttribute('title', 'מדרגה נוכחית')
    const styles = (await calc.page.evaluate(`(() => {
      const rows = document.querySelectorAll('[data-testid="purchase-tax-breakdown"] tbody tr')
      const cell = (i) => rows[i].querySelector('td')
      return [
        getComputedStyle(cell(1)).backgroundColor,
        getComputedStyle(cell(0)).backgroundColor,
        getComputedStyle(cell(1)).borderBlockStartColor,
        getComputedStyle(cell(0)).borderBlockStartColor,
      ]
    })()`)) as string[]
    expect(styles[0]).not.toBe(styles[1])
    expect(styles[2]).not.toBe(styles[3])

    // The total row quotes the very figure the summary 💡 line shows.
    await expect(breakdown.locator('tfoot')).toContainText(ils(744))
    await expect(calc.summaryNotes).toContainText(ils(744))

    // The tax column reads מס לתשלום and its money cells carry the accent
    // color - the "what adds up" column reads as the payoff at a glance.
    await expect(breakdown.locator('thead th').nth(3)).toHaveText('מס לתשלום')
    const taxColStyles = (await calc.page.evaluate(`(() => {
      const table = document.querySelector('[data-testid="purchase-tax-breakdown"] table')
      return [
        getComputedStyle(table.querySelector('tbody tr td:nth-child(4)')).color,
        getComputedStyle(table.querySelector('tbody tr td:nth-child(3)')).color,
        getComputedStyle(table.querySelector('tfoot td')).color,
      ]
    })()`)) as string[]
    expect(taxColStyles[0]).toBe(taxColStyles[2])
    expect(taxColStyles[0]).not.toBe(taxColStyles[1])

    // The 30-day deadline rides the total row as a caption.
    await expect(breakdown.locator('.tax-total-deadline')).toContainText('30')

    // Narrow phone width: the ladder stays inside the panel.
    await calc.page.setViewportSize({ width: 360, height: 900 })
    await expect(breakdown).toBeVisible()
    const rect = (await calc.page.evaluate(`(() => {
      const el = document.querySelector('[data-testid="purchase-tax-breakdown"] table')
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, viewport: window.innerWidth }
    })()`)) as { left: number; right: number; viewport: number }
    expect(rect.left).toBeGreaterThanOrEqual(-1)
    expect(rect.right).toBeLessThanOrEqual(rect.viewport + 1)
  })

  test('typing the home price keeps the mix and shows the tax ladder', async () => {
    // Typing passes through sub-₪1,000 values, where the recommended mix's
    // shares cannot be split across the tracks in whole shekels. The mix must
    // still be the recommended 40/34/26 afterwards - the drifting 40/30/30
    // carries 70% variable, trips the BoI 2/3 cap and freezes the summary, so
    // the 💡 tax line and its ladder vanish while the price reads ₪100M.
    await calc.propertyValue.click()
    await calc.propertyValue.pressSequentially('100000000', { delay: 10 })
    await expect(calc.propertyValue).toHaveValue('100,000,000')
    await expect(calc.formError).toBeHidden()
    await expect(calc.track(1).amount()).toHaveValue('40,000,000')
    await expect(calc.track(2).amount()).toHaveValue('34,000,000')
    await expect(calc.track(3).amount()).toHaveValue('26,000,000')

    // The 💡 tax line is there, and the ladder behind it opens on the same tax.
    await expect(calc.summaryNotes).toContainText('מס רכישה')
    await expect(calc.summaryNotes).toContainText(ils(9_310_215))
    const breakdown = calc.page.getByTestId('purchase-tax-breakdown')
    await expect(breakdown).toBeVisible()
    await breakdown.locator('summary').click()
    await expect(breakdown.locator('tfoot')).toContainText(ils(9_310_215))
  })

  test('typing the loan amount keeps the mix and shows the tax ladder', async () => {
    // Same keyed-digits exposure as the home price: the loan walks through
    // sub-₪1,000 values while typing, and the final mix must still be the
    // recommended 40/34/26 (a drifting 40/30/30 trips the BoI 2/3 cap and
    // freezes the summary behind the error). Loan-only basis: 2,000,000 is
    // past the 1,978,745 exemption, so the 💡 tax line and its ladder show.
    await calc.startingAmount.fill('')
    await calc.startingAmount.pressSequentially('2000000', { delay: 10 })
    await expect(calc.startingAmount).toHaveValue('2,000,000')
    await expect(calc.formError).toBeHidden()
    await expect(calc.track(1).amount()).toHaveValue('800,000')
    await expect(calc.track(2).amount()).toHaveValue('680,000')
    await expect(calc.track(3).amount()).toHaveValue('520,000')
    await expect(calc.summaryNotes).toContainText(ils(744))
    await expect(calc.page.getByTestId('purchase-tax-breakdown')).toBeVisible()
  })

  test('home-price input caps at ₪100M', async () => {
    // Typing 150M clamps to 100,000,000 (grouped); every derived figure (the
    // summary tax line among them) then derives from the capped value.
    await calc.setPropertyValue('150,000,000')
    await expect(calc.propertyValue).toHaveValue('100,000,000')

    // Under-cap values pass through untouched.
    await calc.setPropertyValue('2,500,000')
    await expect(calc.propertyValue).toHaveValue('2,500,000')
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

    // The years figure is part of that phrase, so it takes the label's ink
    // rather than a second highlight colour inside one sentence (user request).
    const labelColors = (await calc.page.evaluate(
      `(() => {
        const label = document.querySelector('[data-testid="total-payment-label"]')
        const years = label.querySelector('.term-years-value')
        return {
          label: getComputedStyle(label).color,
          years: years ? getComputedStyle(years).color : null,
        }
      })()`,
    )) as { label: string; years: string | null }
    expect(labelColors.years, 'years figure rendered').not.toBeNull()
    expect(labelColors.years, 'years figure matches the label ink').toBe(labelColors.label)
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
