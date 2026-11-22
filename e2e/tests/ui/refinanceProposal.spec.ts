import { test, expect } from '../../fixtures'
import { RefinancePage } from '../../pages/RefinancePage'
import { mockGetSessionUser } from '../../support/authMocks'
import { emptyExistingMortgageTrack } from '../../../src/features/refinance/existingMortgage'
import { ils } from '../../support/ils'

const snapshot = {
  version: 2,
  existingTracks: [{ ...emptyExistingMortgageTrack('track-1'), type: 'fixed', linkage: 'unlinked',
    currentBalance: 100000, contractedAnnualRate: 6, remainingMonths: 120, method: 'spitzer' }],
  proposals: [{
    label: '',
    proposedTracks: [{ type: 'fixed', sharePercent: 100, annualRatePercent: 4, termYears: 10,
      method: 'spitzer', resetMonths: 0 }],
    feeAmount: 2000, feeMode: 'cash',
  }],
  existingResetStepPercent: 0,
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

test('keeps the existing add-track control under its own list as the proposed mix grows', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  const before = await refinance.addExistingTrackDocumentBox()
  await refinance.addProposed.click()
  await refinance.addProposed.click()
  const after = await refinance.addExistingTrackDocumentBox()

  // The proposed column now has three tracks. The shared first row can grow a
  // few pixels when its fields gain a remove control, but the existing button
  // no longer drops by a whole proposed track.
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(8)
  await refinance.expectAddControlsUnderLists(1, 3)
  // The shared footer row still lines the two assumption fields up.
  await refinance.expectFooterFieldsAligned()
  await refinance.expectOfferCard(1)
  await refinance.expectResetHintSingleLine()
  await refinance.expectFeeModeLabelOnFeeLine()
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

test('holds the form with a loader while a saved plan loads on reload', async ({ mockedPage }) => {
  await mockGetSessionUser(mockedPage)
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await mockedPage.route('**/api/refinances', async route => {
    await held
    return route.fulfill({ json: {
      refinances: [{ id: 'saved', label: 'Saved proposal', snapshot }], max: 4,
    } })
  })

  const refinance = new RefinancePage(mockedPage)
  await refinance.goto('/refinance?refinance=saved')
  await expect(refinance.loading).toBeVisible()
  // The draft form is never drawn behind the loader, so nothing changes shape.
  await expect(refinance.proposalTab(1)).toHaveCount(0)
  await expect(refinance.balance).toHaveCount(0)

  release()
  await expect(refinance.loading).toHaveCount(0)
  await expect(refinance.balance).toHaveValue('100,000')
  await expect(refinance.proposalTab(1)).toBeVisible()
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

test('compares two proposals against the same existing side and switches between them', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.fillExisting('100000', '6', '120')
  await refinance.fillProposal('10', '4', '2000')
  await refinance.expectReady()

  // Adding the second proposal shows the remove action without moving save.
  const saveBefore = await refinance.saveDocumentBox()
  await refinance.addProposalPlan.click()
  const saveAfter = await refinance.saveDocumentBox()
  expect(Math.abs(saveAfter.y - saveBefore.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(saveAfter.x - saveBefore.x)).toBeLessThanOrEqual(1)
  await expect(refinance.proposalTab(2)).toBeVisible()
  await refinance.newTerm.fill('10')
  await refinance.newRate.fill('5')
  await refinance.fee.fill('0')

  // One save control sits at the row's side, outside the offer strip.
  const saveBox = await refinance.saveSignIn.boundingBox()
  const tabsBox = await refinance.proposalTabs.boundingBox()
  expect(Math.abs(saveBox!.width - 34)).toBeLessThanOrEqual(1)
  expect(Math.abs(saveBox!.height - 34)).toBeLessThanOrEqual(1)
  await expect(refinance.saveSignIn).toHaveText('')
  await expect(refinance.saveSignIn).toHaveAttribute('aria-label', 'התחבר כדי לשמור')
  const rtl = await mockedPage.evaluate(() => document.documentElement.dir === 'rtl')
  if (rtl) expect(saveBox!.x + saveBox!.width).toBeLessThan(tabsBox!.x)
  else expect(saveBox!.x).toBeGreaterThan(tabsBox!.x + tabsBox!.width)

  // The remove icon sits inside the offer card on the date's line.
  const row = await refinance.proposalRowBoxes(2)
  const centerY = (box: { y: number; height: number }) => box.y + box.height / 2
  expect(Math.abs(centerY(row.remove) - centerY(row.date))).toBeLessThanOrEqual(1)
  expect(Math.abs(row.remove.width - 24)).toBeLessThanOrEqual(1)
  expect(Math.abs(row.remove.height - 24)).toBeLessThanOrEqual(1)
  expect(row.remove.x).toBeGreaterThanOrEqual(row.tab.x - 1)
  expect(row.remove.x + row.remove.width).toBeLessThanOrEqual(row.tab.x + row.tab.width + 1)
  await expect(refinance.removeProposal(2)).toHaveText('')
  await expect(refinance.removeProposal(2)).toHaveAttribute('aria-label', 'הסרת ההצעה')
  expect(row.name.y).toBeLessThan(row.date.y)

  // Both cards are priced against the same payoff statement.
  await expect(refinance.proposalResult(1)).toContainText(ils(1012))
  await expect(refinance.proposalResult(1)).toContainText('חודש 21')
  await expect(refinance.proposalResult(2)).toContainText(ils(1061))

  // The cheaper proposal is marked once there are two to compare, and the
  // marker is the same teal ring + badge as the compare page.
  await expect(refinance.proposalResult(1)).toHaveClass(/is-best/)
  await expect(refinance.proposalResult(1)).toContainText('ההצעה המשתלמת ביותר')
  await expect(refinance.proposalResult(2)).not.toHaveClass(/is-best/)

  // Switching tabs shows each proposal's own values, and offers can be added
  // until the four-offer cap is reached.
  await refinance.proposalTab(1).click()
  await expect(refinance.newRate).toHaveValue('4')
  await refinance.proposalTab(2).click()
  await expect(refinance.newRate).toHaveValue('5')
  await refinance.addProposalPlan.click()
  await expect(refinance.proposalTab(3)).toBeVisible()
  await refinance.addProposalPlan.click()
  await expect(refinance.proposalTab(4)).toBeVisible()
  await expect(refinance.addProposalPlan).toHaveCount(0)
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

  // Saving as a new plan moves the URL to it, so a reload reopens that plan.
  await refinance.saveNew.click()
  await expect(refinance.saveLabel).toHaveValue('My refinance (העתק)')
  await refinance.saveConfirm.click()
  await expect(refinance.saveModal).toBeHidden()
  await expect(mockedPage).toHaveURL(/\/refinance\?refinance=saved$/)
})

test('removing an offer warns first and only removes it after confirming', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.addProposalPlan.click()
  await expect(refinance.proposalTab(2)).toBeVisible()

  await refinance.removeProposal(2).click()
  await expect(refinance.removeOfferDialog).toBeVisible()
  await refinance.removeOfferCancel.click()
  await expect(refinance.removeOfferDialog).toBeHidden()
  await expect(refinance.proposalTab(2)).toBeVisible()

  await refinance.removeProposal(2).click()
  await expect(refinance.removeOfferDialog).toBeVisible()
  await refinance.removeOfferConfirm.click()
  await expect(refinance.removeOfferDialog).toBeHidden()
  await expect(refinance.proposalTab(2)).toHaveCount(0)
  await expect(refinance.proposalTab(1)).toBeVisible()
})

test('leaving with edits warns, and Stay keeps the page', async ({ mockedPage }) => {
  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.existingBalance(1).fill('100000')

  await mockedPage.getByTestId('nav-link-services').click()
  await expect(refinance.unsavedDialog).toBeVisible()
  await expect(refinance.unsavedDialog).toHaveAttribute('dir', 'rtl')
  await refinance.unsavedStay.click()
  await expect(refinance.unsavedDialog).toBeHidden()
  await expect(mockedPage).toHaveURL(/\/refinance$/)
  await expect(refinance.existingBalance(1)).toHaveValue('100,000')

  await mockedPage.getByTestId('nav-link-services').click()
  await expect(refinance.unsavedDialog).toBeVisible()
  await refinance.unsavedLeave.click()
  await expect(mockedPage).toHaveURL(/\/services$/)
})

test('saves every offer as one named plan, prefilled with the plan name', async ({ mockedPage }) => {
  await mockGetSessionUser(mockedPage)
  await mockedPage.route('**/api/mixes', route => route.fulfill({ json: { mixes: [], max: 4 } }))
  type SavedPost = {
    id?: string
    label: string
    snapshot: {
      proposals: {
        feeAmount: number
        proposedTracks: { annualRatePercent: number }[]
      }[]
    }
  }
  const posted: SavedPost[] = []
  await mockedPage.route('**/api/refinances', route => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({ json: { refinances: [], max: 4 } })
    }
    const body = route.request().postDataJSON() as SavedPost
    posted.push(body)
    return route.fulfill({
      status: 201,
      json: {
        refinance: {
          id: 'saved',
          label: body.label,
          snapshot: body.snapshot,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    })
  })

  const refinance = new RefinancePage(mockedPage)
  await refinance.goto()
  await refinance.fillExisting('100000', '6', '120')
  await refinance.fillProposal('10', '4', '2000')
  await refinance.addProposalPlan.click()
  await refinance.newTerm.fill('10')
  await refinance.newRate.fill('5')
  await refinance.fee.fill('0')
  await refinance.expectReady()

  // Saving as another plan is only offered once a plan is loaded.
  await expect(refinance.saveNew).toHaveCount(0)
  await refinance.save.click()
  // A multi-offer plan is named as a plan, not after one of its offers.
  await expect(refinance.saveLabel).toHaveValue('תוכנית מיחזור')
  await expect(refinance.savePlanHint).toContainText('2')
  await refinance.saveLabel.fill('Two offers')
  await refinance.saveConfirm.click()
  await expect(refinance.saved).toBeVisible()
  await expect(refinance.saved).toContainText('התוכנית נשמרה')

  expect(posted).toHaveLength(1)
  expect(posted[0].label).toBe('Two offers')
  expect(posted[0].snapshot.proposals).toHaveLength(2)
  expect(posted[0].snapshot.proposals[0].proposedTracks[0].annualRatePercent).toBe(4)
  expect(posted[0].snapshot.proposals[1].feeAmount).toBe(0)
  expect(posted[0].snapshot.proposals[1].proposedTracks[0].annualRatePercent).toBe(5)

  // The loaded plan can be saved again as a second, separate plan.
  await expect(refinance.saveNew).toBeVisible()
  await refinance.saveNew.click()
  await expect(refinance.saveModal).toBeVisible()
  await expect(refinance.saveLabel).toHaveValue('Two offers (העתק)')
  await refinance.saveConfirm.click()
  await expect(refinance.saveModal).toBeHidden()
  await expect.poll(() => posted.length).toBe(2)
  expect(posted[1].id).toBeUndefined()
  expect(posted[1].label).toBe('Two offers (העתק)')
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
