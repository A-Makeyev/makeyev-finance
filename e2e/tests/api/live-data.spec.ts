import { test, expect, type Page } from '@playwright/test'
import { installExternalMocks, type CbsFixtureOptions } from '../../support/mocks'
import { CalculatorPage } from '../../pom/CalculatorPage'
import { computeTrackResult } from '@/lib/amortization'
import { formatCurrency } from '@/lib/format'

/**
 * API-level tests: the calculator must incorporate live BOI/CBS data when
 * available and fall back silently when those endpoints fail - exactly the
 * legacy contract (`.catch(() => {})`, 2% fallback inflation, 5.75 prime).
 */

const CPI: CbsFixtureOptions = {
  currentValue: '106',
  previousValue: '105.4',
  currentPercent: '0.4',
  currentPercentYear: '3.5',
  previousPercentYear: '3.0',
}

async function setupSingleIndexedTrack(page: Page) {
  const calc = new CalculatorPage(page)
  await calc.goto()
  // Pin the term to 30y (the default is 15) so the expected totals below match.
  await calc.termSlider.fill('30')
  const track = calc.track(1)
  await track.setAmount('100,000')
  await track.setType('fixedIndexed')
  await track.rate().fill('3')
  return { calc, track }
}

test.describe('Bank of Israel prime rate', () => {
  test('prime tracks adopt live key rate + 1.5 margin', async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    const calc = new CalculatorPage(page)
    await calc.goto()
    // Basket2 includes a prime track; its rate becomes 4.5 + 1.5 = 6.
    await calc.selectPreset('basket2')
    await expect(calc.track(2).type()).toHaveValue('prime')
    await expect(calc.track(2).rate()).toHaveValue('6')
  })

  test('falls back to 5.75 seeding when BOI is unreachable', async ({ page }) => {
    await installExternalMocks(page, { boiKeyRate: null })
    const calc = new CalculatorPage(page)
    await calc.goto()
    await calc.selectPreset('basket2')
    await expect(calc.track(2).type()).toHaveValue('prime')
    await expect(calc.track(2).rate()).toHaveValue('5.75')
  })

  test('manual user-entered rates are never overridden by re-seeding or the live feed', async ({
    page,
  }) => {
    await installExternalMocks(page, { boiKeyRate: 4.5 })
    const calc = new CalculatorPage(page)
    await calc.goto()
    const track = calc.track(1)

    // Prime type seeds the live rate (4.5 + 1.5 = 6) as an "auto" rate…
    await track.setType('prime')
    await expect(track.rate()).toHaveValue('6')

    // …the user types a custom rate → autoRate flag cleared…
    await track.rate().fill('11.5')
    await expect(track.rate()).toHaveValue('11.5')

    // …and neither a type re-selection nor another seeding pass overwrites it.
    await track.setType('fixed')
    await track.setType('prime')
    await expect(track.rate()).toHaveValue('11.5')
  })
})

test.describe('CBS CPI index', () => {
  test('indexed tracks use real annual inflation from the CPI feed', async ({ page }) => {
    await installExternalMocks(page, { cpi: CPI })
    const { calc } = await setupSingleIndexedTrack(page)

    const expected = computeTrackResult({
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      annualInflation: 0.035,
    })!
    await expect(calc.totalPayment).toHaveText(formatCurrency(expected.totalPaid))
  })

  test('indexed tracks fall back to 2% inflation when CBS is down', async ({ page }) => {
    await installExternalMocks(page, { cpi: null })
    const calc = new CalculatorPage(page)
    await calc.goto()
    // Pin the term to 30y (the default is 15) so the expected totals below match.
    await calc.termSlider.fill('30')

    // Index bar stays hidden entirely (legacy parity).
    await expect(calc.page.locator('[aria-label="מדדי מחירים"]')).toHaveCount(0)

    const track = calc.track(1)
    await track.setAmount('100,000')
    await track.setType('fixedIndexed')
    await track.rate().fill('3')

    const expected = computeTrackResult({
      principal: 100_000,
      years: 30,
      annualRatePercent: 3,
      type: 'fixedIndexed',
      method: 'spitzer',
      annualInflation: 0.02,
    })!
    await expect(calc.totalPayment).toHaveText(formatCurrency(expected.totalPaid))
  })
})

test.describe('CBS index bar', () => {
  test('renders three feeds with trend arrows once fetches succeed', async ({ page }) => {
    await installExternalMocks(page, { cpi: CPI })
    await page.goto('/')
    const anchors = page.locator('[aria-label="מדדי מחירים"] a')
    await expect(anchors).toHaveCount(3)
    await expect(anchors.first()).toContainText('106')
    await expect(anchors.first()).toContainText('%')
  })

  test('bar remains hidden while all CBS feeds fail', async ({ page }) => {
    await installExternalMocks(page, { cpi: null })
    await page.goto('/')
    await expect(page.getByTestId('navbar')).toBeVisible() // sanity: app rendered
    await expect(page.locator('[aria-label="מדדי מחירים"]')).toHaveCount(0)
  })
})
