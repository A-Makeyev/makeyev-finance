import type { Page } from '@playwright/test'
import { expect, serveQuotes, test } from '../../fixtures'
import { mockGetSessionUser } from '../../support/authMocks'

/**
 * Saved mixes from the outside: the signed-out control, the unsaved-changes
 * confirm, and the fact that the API refuses a caller with no session.
 *
 * The save/list flow itself needs a real session in the database, which this
 * suite deliberately does not create; the refusals below are the part that must
 * hold regardless of what the UI shows.
 */

test.describe('saved mixes', () => {
  test.beforeEach(async ({ mockedPage }) => {
    await serveQuotes(mockedPage, [])
  })

  test('a signed-out visitor gets the sign-in prompt, not a save button', async ({ calc }) => {
    await calc.goto()

    await expect(calc.saveMixSignIn).toBeVisible()
    await expect(calc.saveMix).toHaveCount(0)
  })

  test('the prompt leads to login with the calculator as the target', async ({ mockedPage, calc }) => {
    await calc.goto()
    await calc.saveMixSignIn.click()

    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)calculators$/)
  })

  test('the saved-mix menu is signed-in only and loads mixes from the calculator', async ({
    mockedPage,
    calc,
  }) => {
    // Signed-out visitors cannot list private mixes.
    await calc.goto()
    await expect(calc.myMixesMenuTrigger).toHaveCount(0)

    const firstId = '507f1f77bcf86cd799439011'
    const secondId = '507f1f77bcf86cd799439012'
    // Set the mix data BEFORE navigating to the calculator, so the fetch happens
    // while the page is already loaded (the / route request is already in flight
    // when goto() returns, and route.fulfill() for that request resolves the
    // query instead of the route we set up next).
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture(firstId, 'First home'),
      savedMixFixture(secondId, 'Second home'),
    ])
    await calc.goto()
    await expect(calc.myMixesMenuTrigger).toBeVisible()
    await calc.myMixesMenuTrigger.hover()
    await expect(calc.savedMixesMenu).toBeVisible()
    await expect(calc.savedMixMenuItem(firstId)).toContainText('First home')
    await expect(calc.myMixesProfileLink).toHaveAttribute('href', '/profile#saved-mixes')

    // A clean calculator loads immediately, even though the URL stays on this page.
    const scrollBeforeLoad = await calc.scrollPosition()
    await calc.savedMixMenuItem(firstId).click()
    await expect(calc.mixTitle).toContainText('First home')

    // Dirty work is protected before a different saved mix replaces it.
    await calc.termSlider.fill('20')
    await calc.myMixesMenuTrigger.hover()
    await calc.savedMixMenuItem(secondId).click()
    await expect(calc.loadMixDialog).toBeVisible()
    await calc.loadMixCancel.click()
    await expect(calc.mixTitle).toContainText('First home')

    await calc.myMixesMenuTrigger.hover()
    await calc.savedMixMenuItem(secondId).click()
    await calc.loadMixConfirm.click()
    await expect(calc.mixTitle).toContainText('Second home')

    await mockedPage.goto('/en/calculators')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
    expect(await calc.documentDirection()).toBe('ltr')
    await mockedPage.setViewportSize({ width: 360, height: 800 })
    await calc.myMixesMenuTrigger.click()
    await expect(calc.savedMixesMenu).toBeVisible()
    const menuBox = await calc.savedMixesMenu.boundingBox()
    expect(menuBox).not.toBeNull()
    expect(menuBox!.x).toBeGreaterThanOrEqual(0)
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(360)
    await calc.savedMixMenuItem(firstId).click()
    await expect(calc.mixTitle).toContainText('First home')
  })

  test('a ?mix= deep link still renders the calculator signed out', async ({ mockedPage, calc }) => {
    // The saved mixes are private, so signed out there is nothing to load -
    // but the link must degrade to the normal calculator, never an error page.
    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await expect(calc.monthlyPayment).toBeVisible()
  })

  test('a ?mix= deep link restores the saved mix and its scenario', async ({ mockedPage, calc }) => {
    // The feed is mocked because mixes are private and this suite has no
    // session: the subject is the deep-link load, not authorization.
    const mix = {
      id: '507f1f77bcf86cd799439011',
      label: 'Loaded mix',
      termYears: 27,
      tracks: [
        { type: 'fixed', amountText: '250,000', yearsText: '27', rateText: '4.8', method: 'spitzer' },
      ],
      scenario: {
        startingAmountText: '250,000',
        propertyValueText: '1,500,000',
        capitalText: '400,000',
        incomeText: '22,000',
        purpose: 'first',
        realtorPercentText: '',
        lawyerPercentText: '',
        appraiserFeeText: '',
        renovationAmountText: '',
        otherExpenses: [],
        ptiThresholdPercent: 33,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await mockedPage.route('**/api/mixes', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes: [mix], max: 5 }),
        })
        : route.continue(),
    )

    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    // The scenario input and the term both come from the saved mix, not the
    // calculator defaults (a blank property value, a 15-year term).
    await expect(calc.propertyValue).toHaveValue('1,500,000')
    await expect(calc.termSlider).toHaveValue('27')
    // Loading from the profile lands on the calculator's own heading, not at
    // the top of the page.
    await expect(calc.panelHeading).toBeInViewport()
  })

  test('the action row sits beside Show payments and never overflows a phone', async ({
    mockedPage,
    calc,
  }) => {
    // The compact action pair (Show payments + save) shares one row on
    // desktop. On a 360px phone the controls may wrap onto their own lines,
    // but none of them may leave the viewport or overlap.
    await mockedPage.setViewportSize({ width: 1280, height: 900 })
    await calc.goto()
    await expect(calc.saveMixSignIn).toBeVisible()

    const wideShow = await calc.showPayments.boundingBox()
    const wideSave = await calc.saveMixSignIn.boundingBox()
    expect(wideShow).not.toBeNull()
    expect(wideSave).not.toBeNull()
    // Same row (a shared vertical band) and no horizontal overlap.
    expect(Math.abs(wideShow!.y - wideSave!.y)).toBeLessThanOrEqual(2)
    const [left, right] = wideShow!.x < wideSave!.x ? [wideShow!, wideSave!] : [wideSave!, wideShow!]
    expect(left.x + left.width).toBeLessThanOrEqual(right.x)

    await mockedPage.setViewportSize({ width: 360, height: 900 })
    // Every control in the action cell stays inside the viewport. "My mixes" is
    // not here: it is signed-in only, and this pass is signed out.
    for (const control of [calc.showPayments, calc.saveMixSignIn]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(361)
    }
    // The two buttons still do not overlap each other.
    const narrowShow = await calc.showPayments.boundingBox()
    const narrowSave = await calc.saveMixSignIn.boundingBox()
    const sameRow = Math.abs(narrowShow!.y - narrowSave!.y) <= 2
    if (sameRow) {
      const [l, r] =
        narrowShow!.x < narrowSave!.x ? [narrowShow!, narrowSave!] : [narrowSave!, narrowShow!]
      expect(l.x + l.width).toBeLessThanOrEqual(r.x)
    }

    // Signed in the row carries one more control, which must fit too.
    await mockGetSessionUser(mockedPage)
    await mockedPage.route('**/api/mixes', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes: [], max: 4 }),
        })
        : route.continue(),
    )
    await calc.goto()
    await expect(calc.myMixesMenuTrigger).toBeVisible()
    for (const control of [calc.showPayments, calc.saveMix, calc.myMixesMenuTrigger]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(361)
    }

    // On a desktop width all three share ONE line: the row is compact enough
    // that the third control no longer wraps onto a line of its own.
    await mockedPage.setViewportSize({ width: 1280, height: 900 })
    await calc.goto()
    await expect(calc.myMixesMenuTrigger).toBeVisible()
    const row = await Promise.all(
      [calc.showPayments, calc.saveMix, calc.myMixesMenuTrigger].map((c) => c.boundingBox()),
    )
    const ys = row.map((box) => box!.y)
    const xs = row.map((box) => box!.x)
    // Same vertical band...
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(2)
    // ...and side by side, in order, without overlapping.
    const sorted = [...xs].sort((a, b) => a - b)
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]).toBeGreaterThan(sorted[index - 1])
    }
    expect(row.every((box) => box!.x + box!.width <= 1281)).toBe(true)

    // Which control is last, not just that they are side by side: the row
    // concludes with the action that writes the mix, and the link to what is
    // already saved reads as leading up to it. Reading order, so this holds at
    // the end of the row in Hebrew (leftmost) as well as English (rightmost).
    expect(await calc.actionRowReadingOrder()).toEqual([
      'show-payments',
      'my-mixes-menu-trigger',
      'save-mix',
    ])
  })

  test('an edited mix asks before it is discarded', async ({ mockedPage, calc }) => {
    await calc.goto()
    // An edit is what makes the mix unsaved work (the term is part of a mix).
    await calc.termSlider.fill('29')

    await mockedPage.getByTestId('nav-link-services').click()
    await expect(calc.unsavedDialog).toBeVisible()

    // Staying keeps the visitor on the calculator with the edit intact.
    await calc.unsavedStay.click()
    await expect(calc.unsavedDialog).toBeHidden()
    await expect(mockedPage).toHaveURL(/\/calculators$/)

    // Leaving goes through.
    await mockedPage.getByTestId('nav-link-services').click()
    await calc.confirmLeaveIfPrompted()
    await expect(mockedPage).toHaveURL(/\/services$/)
  })

  test('an untouched mix leaves without a prompt', async ({ mockedPage, calc }) => {
    await calc.goto()

    // Nothing was edited, so the default mix is not unsaved work and the live
    // prime rate landing does not make it look like it is.
    await mockedPage.getByTestId('nav-link-services').click()
    await expect(mockedPage).toHaveURL(/\/services$/)
    await expect(calc.unsavedDialog).toBeHidden()
  })

  test('a signed-in visitor can save from the unsaved-changes confirm', async ({
    mockedPage,
    calc,
  }) => {
    // No loaded mix here, so this exercises the dialog handing off to the save
    // control's naming modal (the one save surface).
    await mockGetSessionUser(mockedPage)
    await mockedPage.route('**/api/mixes', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes: [], max: 4 }),
        })
        : route.continue(),
    )
    await calc.goto()
    await calc.termSlider.fill('29')

    await mockedPage.getByTestId('nav-link-services').click()
    await expect(calc.unsavedDialog).toBeVisible()
    await expect(calc.unsavedDialog).toHaveAttribute('dir', 'rtl')
    expect(await calc.unsavedDialogActionOrder()).toEqual([
      'unsaved-mix-save',
      'unsaved-mix-stay',
      'unsaved-mix-leave',
    ])

    await calc.unsavedSave.click()
    await expect(calc.saveMixModal).toBeVisible()
    await expect(calc.saveMixLabel).toBeVisible()
  })

  test('a loaded mix saves straight into itself, with no naming prompt', async ({
    mockedPage,
    calc,
  }) => {
    // The mix already has a name, so "save" must not re-ask for one: it PATCHes
    // the loaded id rather than opening the naming modal.
    await mockGetSessionUser(mockedPage)
    const mix = {
      id: '507f1f77bcf86cd799439011',
      label: 'Loaded mix',
      termYears: 27,
      tracks: [
        { type: 'fixed', amountText: '250,000', yearsText: '27', rateText: '4.8', method: 'spitzer' },
      ],
      scenario: {
        startingAmountText: '250,000',
        propertyValueText: '1,500,000',
        capitalText: '400,000',
        incomeText: '22,000',
        purpose: 'first',
        realtorPercentText: '',
        lawyerPercentText: '',
        appraiserFeeText: '',
        renovationAmountText: '',
        otherExpenses: [],
        ptiThresholdPercent: 33,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    let patchCalls = 0
    await mockedPage.route('**/api/mixes', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes: [mix], max: 4 }),
        })
        : route.continue(),
    )
    // The PATCH is held open so the button can be measured while the save is
    // actually in flight, which is the state that used to resize it.
    let releasePatch: () => void = () => { }
    const patchHeld = new Promise<void>((resolve) => {
      releasePatch = resolve
    })
    await mockedPage.route('**/api/mixes/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      patchCalls += 1
      await patchHeld
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mix }),
      })
    })

    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    // Freshly loaded and untouched: the control reports the saved state rather
    // than offering a save that would write an identical mix.
    await expect(calc.saveMixState).toBeVisible()
    await expect(calc.saveMix).toHaveCount(0)
    // The mark trails the label instead of leading it, so the pill reads as a
    // word with a tick after it rather than an icon in front of one.
    expect(await calc.savedStateMarkIsAfterText()).toBe(true)

    // An edit brings the action back.
    await calc.termSlider.fill('29')
    await expect(calc.saveMix).toBeVisible()
    await expect(calc.saveMixState).toHaveCount(0)

    // Idle: the button is exactly as wide as its label (an always-on spinner slot
    // used to leave dead space in front of the text).
    const widthBefore = (await calc.saveMix.boundingBox())!.width
    const textBefore = await calc.saveMix.innerText()

    await calc.saveMix.click()

    // No naming modal, and the save went out as an update.
    await expect(calc.saveMixModal).toHaveCount(0)
    await expect.poll(() => patchCalls).toBe(1)

    // Mid-save the label swaps to the saving text plus a spinner, and NOTHING
    // in the row moves: the control keeps its exact width. innerText skips the
    // invisible idle label, so this is the text the reader actually sees.
    await expect(calc.saveMix).toHaveAttribute('aria-busy', 'true')
    expect((await calc.saveMix.boundingBox())!.width).toBeCloseTo(widthBefore, 1)
    expect(await calc.saveSpinnerPrecedesTextInReadingOrder()).toBe(true)
    const textDuring = await calc.saveMix.innerText()
    expect(textDuring.trim()).not.toBe('')
    expect(textDuring).not.toBe(textBefore)
    // Never the raw key path: a key can typecheck (both locale files agree)
    // and still be unreachable at runtime, and i18next then renders
    // "savedMixes.saving" in the button.
    expect(textDuring).not.toContain('savedMixes.')
    await expect(calc.saveMix).toHaveAccessibleName(/\S/)

    releasePatch()
    await expect(calc.saveMixSaved).toBeVisible()
    // Saving rebaselines the mix, so the control settles back to "saved".
    await expect(calc.saveMixState).toBeVisible()
  })

  test('the action row lifts its buttons less than the standalone CTAs', async ({ calc }) => {
    // Up to three controls sit side by side in the action row, and a 2px lift
    // with a wide teal glow on each made the row feel jumpy: it is pinned to a
    // single pixel here. The saved-state control is not even a button, so it
    // stays completely flat.
    await calc.goto()
    await expect(calc.showPayments).toHaveCSS('transform', 'none')

    await calc.showPayments.hover()
    // Polled: the lift is a transition, so the value is caught mid-animation
    // otherwise.
    await expect
      .poll(() => calc.transformOf(calc.showPayments))
      .toBe('matrix(1, 0, 0, 1, 0, -1)')
    expect(await calc.transformOf(calc.saveMixSignIn)).toBe('none')
  })

  /**
   * A signed-in calculator whose saved mixes are `mixes` (GET), with the write
   * routes left to the caller. Shared by the tests below so each one states
   * only what it is about.
   */
  async function mockSignedInWithMixes(mockedPage: Page, mixes: unknown[]): Promise<void> {
    await mockGetSessionUser(mockedPage)
    await mockedPage.route('**/api/mixes', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes, max: 4 }),
        })
        : route.continue(),
    )
  }

  function savedMixFixture(id: string, label: string) {
    return {
      id,
      label,
      termYears: 27,
      tracks: [
        { type: 'fixed', amountText: '250,000', yearsText: '27', rateText: '4.8', method: 'spitzer' },
      ],
      scenario: {
        startingAmountText: '250,000',
        propertyValueText: '1,500,000',
        capitalText: '400,000',
        incomeText: '22,000',
        purpose: 'first',
        realtorPercentText: '',
        lawyerPercentText: '',
        appraiserFeeText: '',
        renovationAmountText: '',
        otherExpenses: [],
        ptiThresholdPercent: 33,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  test('the loaded mix is named in the calculator', async ({ mockedPage, calc }) => {
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
    ])
    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    await expect(calc.mixTitle).toBeVisible()
    await expect(calc.mixTitle).toContainText('First home')
  })

  test('a reset keeps editing the loaded mix instead of starting a new one', async ({
    mockedPage,
    calc,
  }) => {
    // Reported bug: after a reset the save control fell back to "new mix", so
    // saving created a second mix (with a default name) instead of updating the
    // one on screen.
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
    ])
    // `**/api/mixes/*` needs a path segment, so it never swallows the GET the
    // helper above mocks. Whether the save went out as an update is read from
    // the PATCH count and from the naming modal, which only a create opens.
    let patchCalls = 0
    await mockedPage.route('**/api/mixes/*', (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      patchCalls += 1
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })

    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    await calc.resetButton.click()
    await mockedPage.getByTestId('reset-confirm-yes').click()

    // The title survives the reset: the editor still belongs to that mix.
    await expect(calc.mixTitle).toBeVisible()
    await expect(calc.saveMix).toBeVisible()
    await expect(calc.saveMix).toBeDisabled()

    // The reset blanked the amounts, so there is nothing to save until one is
    // entered; then saving updates the loaded mix in place.
    await calc.track(1).setAmount('200,000')
    await expect(calc.saveMix).toBeEnabled()
    await calc.saveMix.click()
    await expect(calc.saveMixModal).toHaveCount(0)
    await expect.poll(() => patchCalls).toBe(1)
  })

  test('typing then clearing property value restores a savable loaded mix', async ({
    mockedPage,
    calc,
  }) => {
    const mix = savedMixFixture('507f1f77bcf86cd799439011', 'First home')
    mix.tracks[0].amountText = '1,100,000'
    mix.scenario.startingAmountText = '1,500,000'
    mix.scenario.propertyValueText = ''
    await mockSignedInWithMixes(mockedPage, [mix])
    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    await calc.propertyValue.fill('123,333')
    await calc.propertyValue.fill('')

    await expect(calc.track(1).amount()).toHaveValue('1,100,000')
    await expect(calc.saveMixState).toHaveCount(1)
  })

  test('a mix missing from the refreshed list is saved as a new mix', async ({ mockedPage, calc }) => {
    const original = savedMixFixture('507f1f77bcf86cd799439011', 'First home')
    const created = savedMixFixture('507f1f77bcf86cd799439012', 'First home')
    let listReads = 0
    let postCalls = 0
    let patchCalls = 0

    await mockGetSessionUser(mockedPage)
    await mockedPage.route('**/api/mixes', (route) => {
      if (route.request().method() === 'GET') {
        listReads += 1
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mixes: listReads === 1 ? [original] : [], max: 4 }),
        })
      }
      if (route.request().method() === 'POST') {
        postCalls += 1
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ mix: created }),
        })
      }
      return route.continue()
    })
    await mockedPage.route('**/api/mixes/*', (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalls += 1
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mix: original }),
        })
      }
      return route.continue()
    })

    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
    await expect(calc.mixTitle).toBeVisible()

    await calc.track(1).setAmount('300,000')
    await calc.saveMix.click()
    await expect(calc.saveMixSaved).toBeVisible()
    await expect.poll(() => listReads).toBe(2)

    await calc.saveMix.click()
    await expect(calc.saveMixModal).toBeVisible()
    await calc.saveMixConfirm.click()
    await expect(calc.saveMixSaved).toBeVisible()

    expect(patchCalls).toBe(1)
    expect(postCalls).toBe(1)
  })

  test('a duplicate mix name is refused in the dialog', async ({ mockedPage, calc }) => {
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
      savedMixFixture('507f1f77bcf86cd799439012', 'Second home'),
    ])
    await calc.goto()

    await calc.saveMix.click()
    await expect(calc.saveMixModal).toBeVisible()
    await expect(calc.saveMixModal).toHaveAttribute('dir', 'rtl')
    expect(
      await calc.modalActionVisualOrder('save-mix-modal', ['save-mix-confirm', 'save-mix-cancel']),
    ).toEqual(['save-mix-confirm', 'save-mix-cancel'])

    // Case and surrounding spaces are the same name, so the hint fires and the
    // confirm is blocked before the request is ever sent.
    await calc.saveMixLabel.fill('  first HOME  ')
    await expect(calc.saveMixDuplicate).toBeVisible()
    await expect(calc.saveMixConfirm).toBeDisabled()

    // A fresh name clears it.
    await calc.saveMixLabel.fill('Third home')
    await expect(calc.saveMixDuplicate).toHaveCount(0)
    await expect(calc.saveMixConfirm).toBeEnabled()

    // Closing and reopening starts clean: the stale hint must not describe the
    // name now in the field (the dialog reopens on the default name).
    await calc.saveMixLabel.fill('  first HOME  ')
    await expect(calc.saveMixDuplicate).toBeVisible()
    await mockedPage.getByTestId('save-mix-cancel').click()
    await calc.saveMix.click()
    await expect(calc.saveMixDuplicate).toHaveCount(0)
  })

  test('a server duplicate response is shown in the open save dialog', async ({ mockedPage, calc }) => {
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
    ])
    let postCalls = 0
    await mockedPage.route('**/api/mixes', (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      postCalls += 1
      if (postCalls === 1) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'duplicate' }),
        })
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ mix: savedMixFixture('507f1f77bcf86cd799439012', 'Fourth home') }),
      })
    })
    await calc.goto()

    await calc.saveMix.click()
    await calc.saveMixLabel.fill('Third home')
    await calc.saveMixConfirm.click()

    await expect(calc.saveMixModal).toBeVisible()
    await expect(calc.saveMixDuplicate).toBeVisible()
    await expect(calc.saveMixConfirm).toBeDisabled()

    await calc.saveMixLabel.fill('Fourth home')
    await expect(calc.saveMixDuplicate).toHaveCount(0)
    await expect(calc.saveMixConfirm).toBeEnabled()
    await calc.saveMixConfirm.click()
    await expect(calc.saveMixSaved).toBeVisible()
  })

  test('saving a deep-linked mix drops the stale ?mix= param', async ({ mockedPage, calc }) => {
    // The URL names the mix as it was when it was opened. After a save the
    // editor is newer than what a reload would fetch, so the param has to go or
    // a refresh would overwrite the newer state with the older one.
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
    ])
    await mockedPage.route('**/api/mixes/*', (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mix: savedMixFixture('507f1f77bcf86cd799439011', 'First home') }),
      })
    })

    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
    expect(mockedPage.url()).toContain('mix=')

    await calc.track(1).setAmount('200,000')
    await calc.saveMix.click()
    await expect(calc.saveMixSaved).toBeVisible()

    await expect.poll(() => mockedPage.url()).not.toContain('mix=')
    // The store still knows which mix it is editing, so a further save updates
    // the same document rather than creating another.
    await expect(calc.mixTitle).toBeVisible()
  })

  test('New mix detaches from the loaded mix, confirming first when edited', async ({
    mockedPage,
    calc,
  }) => {
    await mockSignedInWithMixes(mockedPage, [
      savedMixFixture('507f1f77bcf86cd799439011', 'First home'),
    ])
    await mockedPage.goto('/calculators?mix=507f1f77bcf86cd799439011')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    await expect(calc.newMix).toBeVisible()

    // Edited: confirm before clearing these values and starting over.
    await calc.termSlider.fill('29')
    await calc.newMix.click()
    await expect(calc.newMixDialog).toBeVisible()
    await calc.newMixConfirm.click()
    await expect(calc.newMixDialog).toBeHidden()

    // The link and all calculator values are cleared for a fresh mix.
    await expect(calc.mixTitle).toHaveCount(0)
    await expect(calc.newMix).toHaveCount(0)
    await expect.poll(() => mockedPage.url()).not.toContain('mix=')
    await expect(calc.termSlider).toHaveValue('15')
    await expect(calc.track(1).amount()).toHaveValue('')
    await calc.track(1).setAmount('200,000')
    await calc.saveMix.click()
    await expect(calc.saveMixModal).toBeVisible()
  })

  test('the mixes API refuses a caller with no session', async ({ mockedPage }) => {
    const read = await mockedPage.request.get('/api/mixes')
    expect(read.status()).toBe(401)

    const write = await mockedPage.request.post('/api/mixes', {
      data: { label: 'x', termYears: 30, tracks: [] },
    })
    expect(write.status()).toBe(401)

    const update = await mockedPage.request.patch('/api/mixes/507f1f77bcf86cd799439011', {
      data: { label: 'x', termYears: 30, tracks: [] },
    })
    expect(update.status()).toBe(401)

    const del = await mockedPage.request.delete('/api/mixes/507f1f77bcf86cd799439011')
    expect(del.status()).toBe(401)
  })
})
