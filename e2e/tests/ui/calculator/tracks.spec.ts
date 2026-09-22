import { test, expect } from '../../../fixtures'
import { ils } from '../../../support/ils'

test.describe('mortgage calculator - tracks and allocation', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
  })

  test('default mix has three tracks; removal keeps at least one', async ({ calc }) => {
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

  test('remove-track stays centered on the select chevron column', async ({ calc }) => {
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

  test('manual rate override is respected (autoRate cleared)', async ({ calc }) => {
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

  test('property/capital bidirectional sync derives and restores the loan', async ({ calc }) => {
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

  test('zero loan shows the no-need state', async ({ calc }) => {
    await calc.setPropertyValue('100,000')
    await calc.setCapital('200,000')
    await expect(calc.startingAmount).toBeDisabled()
    await expect(calc.startingAmount).toHaveValue('אין צורך 🥳')
  })

  test('variable-rate cap blocks calculation and auto-fix trims variable tracks only', async ({
    calc,
  }) => {
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

  test('auto-fix without a pinned property shrinks the loan total', async ({ calc }) => {
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

  test('typing a home amount fills empty tracks with the recommended mix', async ({ calc }) => {
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

  test('clearing a track under a pinned loan splits it evenly across survivors', async ({
    calc,
  }) => {
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

  test('typing the home price keeps the mix and shows the tax ladder', async ({ calc }) => {
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

  test('typing the loan amount keeps the mix and shows the tax ladder', async ({ calc }) => {
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
})
