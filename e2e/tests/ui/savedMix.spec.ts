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

  test('the calculator links to the saved mixes on the profile, signed in only', async ({
    mockedPage,
    calc,
  }) => {
    // Signed out the profile is gated and would bounce to login, so the link is
    // a dead end there: it belongs to a signed-in visitor only.
    await calc.goto()
    await expect(calc.myMixesLink).toHaveCount(0)

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
    await expect(calc.myMixesLink).toBeVisible()
    await expect(calc.myMixesLink).toHaveAttribute('href', '/profile#saved-mixes')
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
    await expect(calc.myMixesLink).toBeVisible()
    for (const control of [calc.showPayments, calc.saveMix, calc.myMixesLink]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(361)
    }

    // On a desktop width all three share ONE line: the row is compact enough
    // that the third control no longer wraps onto a line of its own.
    await mockedPage.setViewportSize({ width: 1280, height: 900 })
    await calc.goto()
    await expect(calc.myMixesLink).toBeVisible()
    const row = await Promise.all(
      [calc.showPayments, calc.saveMix, calc.myMixesLink].map((c) => c.boundingBox()),
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
      'my-mixes-link',
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
    let releasePatch: () => void = () => {}
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
