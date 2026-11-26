import { expect, type Locator, type Page } from '@playwright/test'

export class RefinancePage {
  readonly page: Page
  readonly heading: Locator
  readonly balance: Locator
  readonly rate: Locator
  readonly remaining: Locator
  readonly newTerm: Locator
  readonly newRate: Locator
  readonly fee: Locator
  readonly results: Locator
  readonly comparison: Locator
  readonly breakEven: Locator
  readonly incomplete: Locator
  readonly myRefinancesMenuTrigger: Locator
  readonly savedRefinancesMenu: Locator
  readonly myRefinancesProfileLink: Locator
  readonly loadRefinanceDialog: Locator
  readonly loadRefinanceConfirm: Locator
  readonly loadRefinanceCancel: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'מחזור משכנתא', level: 1 })
    this.balance = page.getByTestId('refinance-balance-1')
    this.rate = page.getByTestId('refinance-rate-1')
    this.remaining = page.getByTestId('refinance-remaining-1')
    this.newTerm = page.getByTestId('refinance-new-term')
    this.newRate = page.getByTestId('refinance-new-rate')
    this.fee = page.getByTestId('refinance-fee')
    this.results = page.getByTestId('refinance-results')
    this.comparison = page.getByTestId('refinance-comparison')
    this.breakEven = page.getByTestId('refinance-break-even')
    this.incomplete = page.getByTestId('refinance-incomplete')
    this.myRefinancesMenuTrigger = page.getByTestId('my-refinances-menu-trigger')
    this.savedRefinancesMenu = page.getByTestId('saved-refinances-menu')
    this.myRefinancesProfileLink = page.getByTestId('my-refinances-link')
    this.loadRefinanceDialog = page.getByTestId('load-refinance-confirm')
    this.loadRefinanceConfirm = page.getByTestId('load-refinance-confirm-yes')
    this.loadRefinanceCancel = page.getByTestId('load-refinance-confirm-cancel')
    this.unsavedDialog = page.getByTestId('unsaved-refinance-confirm')
    this.unsavedStay = page.getByTestId('unsaved-refinance-stay')
    this.unsavedLeave = page.getByTestId('unsaved-refinance-leave')
    this.removeOfferDialog = page.getByTestId('remove-refinance-offer-confirm')
    this.removeOfferCancel = page.getByTestId('remove-refinance-offer-cancel')
    this.removeOfferConfirm = page.getByTestId('remove-refinance-offer-delete')
  }

  async goto(path = '/refinance') {
    await this.page.goto(path)
    await this.page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
  }

  async fillExisting(balance: string, rate: string, remaining: string) {
    await this.balance.fill(balance)
    await this.rate.fill(rate)
    await this.remaining.fill(remaining)
  }

  async fillProposal(term: string, rate: string, fee: string) {
    await this.newTerm.fill(term)
    await this.newRate.fill(rate)
    await this.fee.fill(fee)
  }

  savedRefinanceMenuItem(id: string): Locator {
    return this.page.getByTestId(`saved-refinance-menu-item-${id}`)
  }

  /** Click-open works on touch and keeps focus while a narrow page scrolls. */
  async openSavedRefinancesMenu() {
    await this.page.mouse.move(0, 0)
    await this.myRefinancesMenuTrigger.click()
    await expect(this.savedRefinancesMenu).toBeVisible()
  }

  get loading() { return this.page.getByTestId('refinance-loading') }
  get save() { return this.page.getByTestId('save-refinance') }
  get loadRefinanceSave() { return this.page.getByTestId('load-refinance-confirm-save') }
  get saveError() { return this.page.getByTestId('save-refinance-error') }
  get saveCancel() { return this.page.getByTestId('save-refinance-cancel') }
  get saveNew() { return this.page.getByTestId('save-refinance-new') }
  get saveModal() { return this.page.getByTestId('save-refinance-modal') }
  get saveSignIn() { return this.page.getByTestId('save-refinance-sign-in') }
  readonly unsavedDialog: Locator
  readonly unsavedStay: Locator
  readonly unsavedLeave: Locator
  readonly removeOfferDialog: Locator
  readonly removeOfferCancel: Locator
  readonly removeOfferConfirm: Locator
  /** The save control's document position, unaffected by page scroll. */
  async saveDocumentBox() {
    return this.saveSignIn.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x + window.scrollX, y: rect.y + window.scrollY }
    })
  }
  get saveLabel() { return this.page.getByTestId('save-refinance-label') }
  get savePlanHint() { return this.page.getByTestId('save-refinance-plan-hint') }
  get saveConfirm() { return this.page.getByTestId('save-refinance-confirm') }
  get saveConfirmSpinner() { return this.page.getByTestId('save-refinance-confirm-spinner') }
  get saved() { return this.page.getByTestId('save-refinance-saved') }
  /** Saved mixes render as one button each, labelled with the mix name. */
  loadMixButton(id: string) { return this.page.getByTestId(`refinance-load-mix-${id}`) }
  get addExistingTrack() { return this.page.getByTestId('refinance-add-track') }
  get addProposed() { return this.page.getByTestId('refinance-add-proposed-track') }
  get addProposalPlan() { return this.page.getByTestId('refinance-add-proposal') }
  proposalTabName(index: number) { return this.page.getByTestId(`refinance-proposal-name-${index}`) }
  proposalTabDate(index: number) { return this.page.getByTestId(`refinance-proposal-date-${index}`) }
  get proposalTabs() { return this.page.getByTestId('refinance-proposal-tabs') }
  get feeLabel() { return this.page.getByTestId('refinance-fee-label') }
  get feeModeLabel() { return this.page.getByTestId('refinance-fee-mode-label') }
  /**
   * The proposal row's boxes in one synchronous read. Reading them with
   * separate boundingBox calls let a page scroll land between measurements and
   * made controls on one line look misaligned.
   */
  async proposalRowBoxes(index: number) {
    return this.page.evaluate((tabIndex) => {
      const rect = (testId: string) => {
        const box = document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }
      return {
        remove: rect(`refinance-remove-proposal-${tabIndex}`),
        tab: rect(`refinance-proposal-tab-${tabIndex}`),
        name: rect(`refinance-proposal-name-${tabIndex}`),
        date: rect(`refinance-proposal-date-${tabIndex}`),
      }
    }, index)
  }
  proposalTab(index: number) { return this.page.getByTestId(`refinance-proposal-tab-${index}`) }
  proposalResult(index: number) { return this.page.getByTestId(`refinance-proposal-result-${index}`) }
  removeProposal(index: number) { return this.page.getByTestId(`refinance-remove-proposal-${index}`) }
  get existingPayment() { return this.page.getByTestId('refinance-existing-payment') }
  get existingInterest() { return this.page.getByTestId('refinance-existing-interest') }
  get resetStep() { return this.page.getByTestId('refinance-reset-step') }
  get resetHint() { return this.page.getByTestId('refinance-reset-hint') }
  get feeModeOptions() { return this.page.getByTestId('refinance-fee-mode-options') }
  get existingType() { return this.page.getByTestId('refinance-type-1') }
  get nextReset() { return this.page.getByTestId('refinance-next-reset-1') }
  get existingBalloon() { return this.page.getByTestId('refinance-balloon-1') }
  get proposedBalloon() { return this.page.getByTestId('refinance-proposed-balloon-1') }
  get existingBalloonDue() { return this.page.getByTestId('refinance-existing-balloon') }
  get proposedBalloonDue() { return this.page.getByTestId('refinance-proposed-balloon-due') }
  get balloonNote() { return this.page.getByTestId('refinance-balloon-note') }
  /** Document-relative box of the existing add-track control, so a click that
   *  scrolls the page does not read as movement in a before/after comparison. */
  async addExistingTrackDocumentBox() {
    return this.addExistingTrack.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { y: rect.y + window.scrollY }
    })
  }
  async addExisting() {
    await this.page.getByTestId('refinance-track-1').locator('xpath=ancestor::section').getByRole('button', { name: /^(הוסף מסלול|Add track)$/ }).click()
  }
  async removeExisting(index: number) {
    await this.page.getByTestId(`refinance-track-${index}`).getByRole('button').click()
  }
  existingBalance(index: number) { return this.page.getByTestId(`refinance-balance-${index}`) }
  async expectAlignedTracks() {
    // The existing column reserves a row for the saved-mixes chips while they
    // load; measuring before it settles compared a loading column against a
    // loaded one and read as track misalignment.
    await expect(this.page.getByTestId('refinance-mix-skeleton')).toHaveCount(0)
    for (const index of [1, 2]) {
      const existing = await this.page.getByTestId(`refinance-track-${index}`).boundingBox()
      const proposed = await this.page.getByTestId(`refinance-proposed-track-${index}`).boundingBox()
      expect(Math.abs(existing!.y - proposed!.y)).toBeLessThanOrEqual(1)
    }
    await expect(this.page.getByTestId('refinance-load-mix-empty')).toHaveCount(0)
  }
  /** Both sides' track cards keep the column's full width even when one list is
   *  longer. A shorter list used to spawn an implicit second grid column, which
   *  narrowed its tracks and pushed its add control to the far edge. */
  async expectTrackCardWidthsMatch() {
    const existing = await this.page.getByTestId('refinance-track-1').boundingBox()
    const proposed = await this.page.getByTestId('refinance-proposed-track-1').boundingBox()
    expect(Math.abs(existing!.width - proposed!.width)).toBeLessThanOrEqual(1)
  }
  /** Each add-track control follows its own column's last track, not the
   *  other column's count. */
  async expectAddControlsUnderLists(existingCount: number, proposedCount: number) {
    const lastExisting = await this.page.getByTestId(`refinance-track-${existingCount}`).boundingBox()
    const lastProposed = await this.page
      .getByTestId(`refinance-proposed-track-${proposedCount}`)
      .boundingBox()
    const existing = await this.addExistingTrack.boundingBox()
    const proposed = await this.addProposed.boundingBox()

    expect(existing!.y).toBeGreaterThan(lastExisting!.y + lastExisting!.height - 1)
    // "Just below": one row gap, not a stack of empty shared rows.
    expect(existing!.y - (lastExisting!.y + lastExisting!.height)).toBeLessThanOrEqual(40)
    expect(proposed!.y).toBeGreaterThan(lastProposed!.y + lastProposed!.height - 1)
    // The longer column's button is the lower one; the shorter one does not move.
    expect(existing!.y).toBeLessThan(proposed!.y - 1)
  }
  /** The reset assumption and the payoff fee start on the same desktop line. */
  async expectFooterFieldsAligned() {
    const reset = await this.resetStep.boundingBox()
    const fee = await this.fee.boundingBox()
    expect(Math.abs(reset!.y - fee!.y)).toBeLessThanOrEqual(1)
  }
  /** Each offer card is a two-line block: name above, creation date below. */
  async expectOfferCard(index = 1) {
    const name = await this.proposalTabName(index).boundingBox()
    const date = await this.proposalTabDate(index).boundingBox()
    expect(date!.y).toBeGreaterThan(name!.y + name!.height - 1)
    await expect(this.proposalTabName(index)).not.toHaveText('')
    await expect(this.proposalTabDate(index)).not.toHaveText('')
    const card = await this.proposalTab(index).boundingBox()
    expect(card!.height).toBeGreaterThanOrEqual(60)
  }
  /** The reset hint fits on one line at the wide desktop breakpoint. */
  async expectResetHintSingleLine() {
    const hint = await this.resetHint.boundingBox()
    expect(hint!.height).toBeLessThanOrEqual(24)
  }
  /** The fee-mode question shares the fee label's line and type size, while
   *  the radio row is vertically centred on the fee amount field. */
  async expectFeeModeOptionsCenteredOnFeeInput() {
    const feeLabel = await this.feeLabel.boundingBox()
    const modeLabel = await this.feeModeLabel.boundingBox()
    expect(Math.abs(feeLabel!.y - modeLabel!.y)).toBeLessThanOrEqual(1)
    const centers = await this.page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect()
      const input = box('[data-testid="refinance-fee"]')
      const options = box('[data-testid="refinance-fee-mode-options"]')
      return {
        input: input.y + input.height / 2,
        options: options.y + options.height / 2,
      }
    })
    expect(Math.abs(centers.input - centers.options)).toBeLessThanOrEqual(1)
    const sizes = await this.page.evaluate(() => {
      const fee = document.querySelector('[data-testid="refinance-fee-label"]')!
      const mode = document.querySelector('[data-testid="refinance-fee-mode-label"]')!
      return [getComputedStyle(fee).fontSize, getComputedStyle(mode).fontSize]
    })
    expect(sizes[0]).toBe(sizes[1])
  }
  proposedShare(index: number) { return this.page.getByTestId(`refinance-proposed-share-${index}`) }
  proposedAmount(index: number) { return this.page.getByTestId(`refinance-proposed-amount-${index}`) }
  async removeProposed(index: number) {
    await this.page.getByTestId(`refinance-proposed-track-${index}`).getByRole('button').click()
  }
  async expectLayout(direction: string) {
    expect(await this.page.evaluate(() => document.documentElement.dir)).toBe(direction)
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  }

  async expectReady() {
    await expect(this.results).toBeVisible()
    await expect(this.comparison).toBeVisible()
  }
}
