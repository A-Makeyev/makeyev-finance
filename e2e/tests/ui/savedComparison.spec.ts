import { test, expect } from '../../fixtures'
import { ComparePage } from '../../pages/ComparePage'
import { mockGetSessionUser } from '../../support/authMocks'

/**
 * Saved comparisons from the outside: the signed-out prompt, the compare
 * page's unsaved-changes guard, and the snapshot payload a save sends.
 *
 * The persistence round trip itself is covered by the unit tests against the
 * store and schema; this suite checks the wiring a user actually touches.
 */

test.describe('saved comparisons', () => {
  test('explains the scenario cap and restores adding after removal', async ({ mockedPage }) => {
    const compare = new ComparePage(mockedPage)
    await compare.goto()
    await compare.expectScenarioCapRecovery()
  })

  test('matches the refinance button height to its calculator neighbors', async ({ mockedPage }) => {
    await new ComparePage(mockedPage).expectRefinanceActionHeight()
  })
  test('a signed-out visitor gets the sign-in prompt, not a save button', async ({
    mockedPage,
  }) => {
    const compare = new ComparePage(mockedPage)
    await compare.goto()

    await expect(compare.saveComparisonSignIn).toBeVisible()
    await expect(compare.saveComparison).toHaveCount(0)
  })

  test('an edited comparison warns before leaving, and discard restores the baseline', async ({
    mockedPage,
  }) => {
    const compare = new ComparePage(mockedPage)
    await compare.goto()
    const income = mockedPage.getByTestId('compare-income')

    await income.fill('30,000')
    await mockedPage.getByTestId('nav-link-services').click()
    await expect(compare.unsavedDialog).toBeVisible()
    await expect(compare.unsavedDialog).toHaveAttribute('dir', 'rtl')
    // Signed out, the dialog offers sign-in instead of a dead-end Save.
    await expect(compare.unsavedSave).toHaveCount(0)
    await expect(compare.unsavedSignIn).toBeVisible()

    // Staying keeps the edit and the page.
    await compare.unsavedStay.click()
    await expect(compare.unsavedDialog).toBeHidden()
    await expect(mockedPage).toHaveURL(/\/compare$/)
    await expect(income).toHaveValue('30,000')

    // Discarding abandons the edit and continues to the destination.
    await mockedPage.getByTestId('nav-link-services').click()
    await expect(compare.unsavedDialog).toBeVisible()
    await compare.unsavedDiscard.click()
    await expect(mockedPage).toHaveURL(/\/services$/)

    // Returning shows the baseline, not the abandoned edit.
    await compare.goto()
    await expect(income).toHaveValue('')
  })

  test('the header sign-in action is not blocked by the unsaved guard', async ({ mockedPage }) => {
    const compare = new ComparePage(mockedPage)
    await compare.goto()
    await mockedPage.getByTestId('compare-income').fill('30,000')

    // This used to open the unsaved dialog instead of reaching login, leaving
    // a signed-out visitor with no way to save their edits.
    await compare.saveComparisonSignIn.click()
    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)compare$/)
    await expect(compare.unsavedDialog).toHaveCount(0)
  })

  test('the unsaved dialog can send a signed-out visitor to sign in and save', async ({
    mockedPage,
  }) => {
    const compare = new ComparePage(mockedPage)
    await compare.goto()
    await mockedPage.getByTestId('compare-income').fill('30,000')

    await mockedPage.getByTestId('nav-link-services').click()
    await expect(compare.unsavedDialog).toBeVisible()
    await compare.unsavedSignIn.click()

    await expect(mockedPage).toHaveURL(/\/login\?next=(%2F|\/)compare$/)
    await expect(compare.unsavedDialog).toHaveCount(0)
  })

  test('the save prompt renders in English LTR with translated copy', async ({ mockedPage }) => {
    await mockedPage.goto('/en/compare')
    await mockedPage.waitForFunction("document.documentElement.dataset.hydrated === 'true'")

    expect(await mockedPage.evaluate(() => document.documentElement.dir)).toBe('ltr')
    await expect(new ComparePage(mockedPage).saveComparisonSignIn).toHaveText('Sign in to save')
  })

  test('states the four-comparison limit when the cap is reached', async ({ mockedPage }) => {
    await mockGetSessionUser(mockedPage)
    const now = new Date().toISOString()
    let removed = false
    await mockedPage.route('**/api/comparisons/*', route => {
      removed = true
      return route.fulfill({ json: { ok: true } })
    })
    await mockedPage.route('**/api/comparisons', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          comparisons: Array.from({ length: removed ? 3 : 4 }, (_, index) => ({
            id: `507f1f77bcf86cd79943900${index}`,
            label: `Comparison ${index + 1}`,
            snapshot: {},
            createdAt: now,
            updatedAt: now,
          })),
          max: 4,
        }),
      }),
    )

    const compare = new ComparePage(mockedPage)
    await compare.goto()

    await expect(compare.saveComparison).toBeEnabled()
    await compare.saveComparison.click()
    await expect(compare.saveComparisonCapPanel).toContainText('4')
    await expect(compare.saveComparisonCapPanel).toContainText('יש להסיר השוואה')
    await expect(compare.saveComparisonConfirm).toBeDisabled()
    await compare.removeSavedComparison('507f1f77bcf86cd799439003')
    await expect(compare.saveComparisonCapPanel).toHaveCount(0)
    await expect(compare.saveComparisonConfirm).toBeEnabled()
  })

  test('the saving control keeps exactly the saved-state width', async ({ mockedPage }) => {
    await mockGetSessionUser(mockedPage)
    const stored = {
      id: '507f1f77bcf86cd799439011',
      label: 'My plan',
      snapshot: null as Record<string, unknown> | null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await mockedPage.route('**/api/comparisons', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comparisons: stored.snapshot ? [stored] : [], max: 4 }),
        })
      }
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { snapshot?: Record<string, unknown> }
        stored.snapshot = body.snapshot ?? {}
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ comparison: stored }),
        })
      }
      return route.continue()
    })
    // Hold the update long enough to measure the pending box.
    await mockedPage.route('**/api/comparisons/*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      await new Promise((resolve) => setTimeout(resolve, 1200))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comparison: stored }),
      })
    })

    const compare = new ComparePage(mockedPage)
    await compare.goto()
    await compare.saveComparison.click()
    await compare.saveComparisonLabel.fill('My plan')
    await compare.saveComparisonConfirm.click()
    await expect(compare.saveComparisonSavedState).toBeVisible()
    const savedWidth = (await compare.saveComparisonSavedState.boundingBox())!.width

    await mockedPage.getByTestId('compare-income').fill('31,000')
    await expect(compare.saveComparison).toBeVisible()
    await compare.saveComparison.click()
    await expect(compare.saveComparisonSpinner).toBeVisible()
    const pendingWidth = (await compare.saveComparison.boundingBox())!.width

    expect(Math.abs(pendingWidth - savedWidth)).toBeLessThan(0.6)
  })

  test('saving posts one versioned input snapshot and settles into the saved state', async ({
    mockedPage,
  }) => {
    await mockGetSessionUser(mockedPage)
    const captured: {
      body: {
        label?: string
        snapshot?: { version?: number; scenarios?: unknown[]; shared?: unknown }
      } | null
    } = { body: null }

    await mockedPage.route('**/api/comparisons', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comparisons: [], max: 4 }),
        })
      }
      if (route.request().method() === 'POST') {
        captured.body = route.request().postDataJSON()
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            comparison: {
              id: '507f1f77bcf86cd799439011',
              label: captured.body?.label ?? '',
              snapshot: captured.body?.snapshot ?? {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        })
      }
      return route.continue()
    })

    const compare = new ComparePage(mockedPage)
    await compare.goto()
    await expect(compare.saveComparison).toBeVisible()

    await compare.saveComparison.click()
    await expect(compare.saveComparisonModal).toBeVisible()
    await compare.saveComparisonLabel.fill('My plan')
    await compare.saveComparisonConfirm.click()

    await expect(compare.saveComparisonSavedState).toBeVisible()
    await expect.poll(() => captured.body?.label).toBe('My plan')
    expect(captured.body?.snapshot?.version).toBe(1)
    expect(captured.body?.snapshot?.scenarios).toHaveLength(2)
    expect(captured.body?.snapshot?.shared).not.toHaveProperty('realtorAmountText')
  })
})
