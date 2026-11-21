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

  get save() { return this.page.getByTestId('save-refinance') }
  get saveLabel() { return this.page.getByTestId('save-refinance-label') }
  get saveConfirm() { return this.page.getByTestId('save-refinance-confirm') }
  get saveConfirmSpinner() { return this.page.getByTestId('save-refinance-confirm-spinner') }
  get saved() { return this.page.getByTestId('save-refinance-saved') }
  get loadMix() { return this.page.getByTestId('refinance-load-mix') }
  get addProposed() { return this.page.getByTestId('refinance-add-proposed-track') }
  async addExisting() {
    await this.page.getByTestId('refinance-track-1').locator('xpath=ancestor::section').getByRole('button', { name: /^(הוסף מסלול|Add track)$/ }).click()
  }
  async removeExisting(index: number) {
    await this.page.getByTestId(`refinance-track-${index}`).getByRole('button').click()
  }
  existingBalance(index: number) { return this.page.getByTestId(`refinance-balance-${index}`) }
  async expectAlignedTracks() {
    for (const index of [1, 2]) {
      const existing = await this.page.getByTestId(`refinance-track-${index}`).boundingBox()
      const proposed = await this.page.getByTestId(`refinance-proposed-track-${index}`).boundingBox()
      expect(Math.abs(existing!.y - proposed!.y)).toBeLessThanOrEqual(1)
    }
    await expect(this.page.getByTestId('refinance-load-mix-empty')).toHaveCount(0)
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
