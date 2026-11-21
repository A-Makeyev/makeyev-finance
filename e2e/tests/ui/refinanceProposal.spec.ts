import { test, expect } from '../../fixtures'
import { RefinancePage } from '../../pages/RefinancePage'
import { mockGetSessionUser } from '../../support/authMocks'
import { emptyExistingMortgageTrack } from '../../../src/features/refinance/existingMortgage'
import { ils } from '../../support/ils'

const snapshot = {
  version: 1,
  existingTracks: [{ ...emptyExistingMortgageTrack('track-1'), type: 'fixed', linkage: 'unlinked',
    currentBalance: 100000, contractedAnnualRate: 6, remainingMonths: 120, method: 'spitzer' }],
  proposedTracks: [{ type: 'fixed', sharePercent: 100, annualRatePercent: 4, termYears: 10,
    method: 'spitzer', resetMonths: 0 }],
  feeAmount: 2000, feeMode: 'cash',
}

test('aligns corresponding tracks across the existing and proposed columns', async ({ mockedPage }) => {
  await mockGetSessionUser(mockedPage)
  await mockedPage.route('**/api/mixes', route => route.fulfill({ json: { mixes: [], max: 4 } }))
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.addExisting()
  await refinance.addProposed.click()
  await refinance.expectAlignedTracks()
})

test('removing and re-adding an existing track keeps balances independent', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.addExisting()
  await refinance.addExisting()
  await refinance.removeExisting(2)
  await refinance.addExisting()
  await refinance.existingBalance(2).fill('50000')
  await refinance.existingBalance(3).fill('30000')
  await refinance.removeExisting(3)
  await expect(refinance.existingBalance(2)).toHaveValue('50,000')
})

test('loaded proposals display the saved existing balances and terms', async ({ mockedPage }) => {
  await mockGetSessionUser(mockedPage)
  await mockedPage.route('**/api/refinances', route => route.fulfill({ json: {
    refinances: [{ id: 'saved', label: 'Saved proposal', snapshot }], max: 4,
  } }))
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto('/refinance?refinance=saved')
  await refinance.expectReady()
  await expect(refinance.balance).toHaveValue('100,000')
  await expect(refinance.rate).toHaveValue('6')
  await expect(refinance.remaining).toHaveValue('120')
})

test('multiple proposal tracks allocate the principal and enforce the six-track limit', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.fillExisting('100000', '6', '120')
  await refinance.addProposed.click()
  await refinance.proposedShare(1).fill('60')
  await refinance.proposedShare(2).fill('40')
  await refinance.expectReady()
  await expect(refinance.proposedAmount(1)).toContainText(ils(60000))
  await expect(refinance.proposedAmount(2)).toContainText(ils(40000))
  for (let index = 0; index < 4; index++) await refinance.addProposed.click()
  await expect(refinance.addProposed).toHaveCount(0)
  await refinance.removeProposed(3)
  await expect(refinance.addProposed).toBeVisible()
})

test('loads a saved mix, saves its proposal, and reloads the saved values', async ({ mockedPage }) => {
  await mockGetSessionUser(mockedPage)
  let stored: Record<string, unknown> | null = null
  let finishSave!: () => void
  const saving = new Promise<void>(resolve => { finishSave = resolve })
  await mockedPage.route('**/api/mixes', route => route.fulfill({ json: { max: 4, mixes: [{
    id: 'mix', label: 'Saved mix', tracks: [
      { type: 'fixed', amountText: '600000', rateText: '4', yearsText: '10', method: 'spitzer' },
      { type: 'prime', amountText: '400000', rateText: '5', yearsText: '20', method: 'equalPrincipal' },
    ],
  }] } }))
  await mockedPage.route('**/api/refinances', async route => {
    if (route.request().method() === 'POST') {
      await saving
      stored = { ...route.request().postDataJSON(), id: 'saved', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      return route.fulfill({ status: 201, json: { refinance: stored } })
    }
    return route.fulfill({ json: { refinances: stored ? [stored] : [], max: 4 } })
  })
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.fillExisting('100000', '6', '120')
  await refinance.loadMix.selectOption('mix')
  await expect(refinance.proposedShare(1)).toHaveValue('60')
  await expect(refinance.proposedAmount(2)).toContainText(ils(40000))
  await refinance.newRate.fill('101')
  await expect(refinance.save).toBeDisabled()
  await refinance.newRate.fill('4')
  await refinance.save.click()
  await refinance.saveLabel.fill('My refinance')
  await refinance.saveConfirm.click({ trial: true })
  const resting = await refinance.saveConfirm.boundingBox()
  await refinance.saveConfirm.click()
  await expect(refinance.saveConfirmSpinner).toBeVisible()
  const pending = await refinance.saveConfirm.boundingBox()
  expect(pending?.width).toBe(resting?.width)
  expect(pending?.height).toBe(resting?.height)
  finishSave()
  await expect(refinance.saved).toBeVisible()
  await refinance.goto('/refinance?refinance=saved')
  await expect(refinance.balance).toHaveValue('100,000')
  await expect(refinance.proposedShare(2)).toHaveValue('40')
  await refinance.expectReady()
})

for (const width of [360, 768, 1024, 1440]) {
  for (const locale of ['he', 'en']) {
    for (const theme of ['light', 'dark']) {
      test(`proposal layout ${width} ${locale} ${theme}`, async ({ mockedPage }) => {
        await mockedPage.setViewportSize({ width, height: 900 })
        await mockedPage.addInitScript(value => localStorage.setItem('site_theme', value), theme)
        const refinance = new RefinancePage(mockedPage)
        await refinance.goto(locale === 'en' ? '/en/refinance' : '/refinance')
        await refinance.fillExisting('100000', '6', '120')
        await refinance.addProposed.click()
        await refinance.expectReady()
        if (width >= 1024) {
          await refinance.addExisting()
          await refinance.expectAlignedTracks()
        }
        await refinance.expectLayout(locale === 'en' ? 'ltr' : 'rtl')
      })
    }
  }
}
