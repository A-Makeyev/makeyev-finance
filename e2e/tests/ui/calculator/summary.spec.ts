import { test, expect } from '../../../fixtures'
import { ils } from '../../../support/ils'

test.describe('mortgage calculator - summary notes', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('fee amounts keep the room to show a full ₪ figure at every width', async ({ calc }) => {
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

  test('LTV warning triggers above the BoI purpose limit', async ({ calc }) => {
    await calc.selectPurpose('investment')
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('400,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText('60%')
    await expect(calc.summaryNotes).toContainText(ils(500_000))
    // Capital note: 40% ≥ required(50)+15 → good
    await expect(calc.summaryNotes).toContainText('הון עצמי 40% משווי הנכס')
  })

  test('compliant equity and financing ratio merge into one line', async ({ calc }) => {
    // 25% equity + 75% financing on a first home: the two ✔️ facts (equity
    // share, compliant LTV) render as a single merged line.
    await calc.setPropertyValue('1,000,000')
    await calc.setCapital('250,000')

    await expect(calc.summaryNotes).toBeVisible()
    await expect(calc.summaryNotes).toContainText(
      'הון עצמי 25% משווי הנכס ~ עומד במותר לדירה ראשונה (עד 75%)',
    )
  })

  test('one recommended upfront total replaces the bank-requirement line', async ({ calc }) => {
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

  test('purchase-tax info line leads the 💡 group', async ({ calc }) => {
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

  test('purchase-tax breakdown shows the full ladder', async ({ calc }) => {
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

  test('green allowance line names both the payment and the ceiling', async ({ calc }) => {
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
})
