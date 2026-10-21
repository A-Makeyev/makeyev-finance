import { test, expect } from '../../../fixtures'
import type { Locator } from '@playwright/test'

/** Reads a money cell as a number (formatted with ₪, commas and RTL marks). */
async function amountOf(locator: Locator): Promise<number> {
  const text = (await locator.innerText()).replace(/[^\d.]/g, '')
  return Number.parseFloat(text) || 0
}

test.describe('mortgage calculator - early-repayment fee', () => {
  test.beforeEach(async ({ calc }) => {
    await calc.goto()
    await calc.page.getByTestId('prepayment-calculator').scrollIntoViewIfNeeded()
  })

  test('prices every track off the schedule, with the prime track exempt', async ({ calc }) => {
    const section = calc.page.getByTestId('prepayment-calculator')
    await expect(section).toBeVisible()
    // The prime track carries the statutory exemption instead of a figure.
    await expect(calc.page.getByTestId('prepayment-row-prime')).toBeVisible()
    await expect(calc.page.getByTestId('prepayment-fee-prime')).toContainText('פטור')

    // A comparison rate BELOW the contractual one has to produce a fee, and a
    // lower one still has to produce a bigger fee - the formula's whole point.
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const fixedAtTwo = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixedAtTwo).toBeGreaterThan(0)

    await calc.page.getByTestId('prepayment-market-rate').fill('1')
    const fixedAtOne = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixedAtOne).toBeGreaterThan(fixedAtTwo)

    // The total is the sum of the priced tracks (the exempt one adds nothing).
    const total = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(total).toBeGreaterThanOrEqual(fixedAtOne)
  })

  test('waives only the five-year reset track at an exit station', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    const before = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(before).toBeGreaterThan(0)

    await calc.page.getByTestId('prepayment-exit-station').check()
    // The five-year indexed track is on its reset date, so it is waived.
    await expect(calc.page.getByTestId('prepayment-fee-variableIndexed5y')).toContainText('פטור')
    // The fixed track has no exit station, so it keeps its fee.
    const fixed = await amountOf(calc.page.getByTestId('prepayment-fee-fixed'))
    expect(fixed).toBeGreaterThan(0)
    const after = await amountOf(calc.page.getByTestId('prepayment-total'))
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)
  })

  test('puts the fee-free prime track first in the cheapest payoff order', async ({ calc }) => {
    await calc.page.getByTestId('prepayment-market-rate').fill('2')
    await calc.page.getByTestId('prepayment-partial').fill('700000')

    const order = calc.page.getByTestId('prepayment-order')
    await expect(order).toBeVisible()
    // Cheapest shekels first: the exempt prime track, then a priced one.
    await expect(order.locator('li').first()).toContainText('פריים')
    await expect(order.locator('li').nth(1)).toBeVisible()
    await expect(order).toContainText('עמלה')
  })

  test('says so when the chosen date is past every track', async ({ calc }) => {
    // The default term is 15 years, so a year-30 prepayment has nothing left
    // to price: the section says that instead of showing a zero balance.
    await calc.page.getByTestId('prepayment-years').fill('30')
    await expect(calc.page.getByTestId('prepayment-empty')).toBeVisible()
    await expect(calc.page.getByTestId('prepayment-total')).toHaveCount(0)
  })
})

test.describe('early-repayment fee in English (LTR)', () => {
  test.use({ language: 'english' })

  test('renders its own heading and table', async ({ localizedCalc }) => {
    await localizedCalc.goto()
    const section = localizedCalc.page.getByTestId('prepayment-calculator')
    await section.scrollIntoViewIfNeeded()
    await expect(section.locator('h2')).toHaveText('Early-repayment fee')
    await expect(localizedCalc.page.getByTestId('prepayment-total')).toBeVisible()
  })
})
