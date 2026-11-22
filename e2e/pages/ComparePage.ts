import { expect, type Locator, type Page } from '@playwright/test'

export class ComparePage {
  readonly page: Page
  readonly saveComparisonSignIn: Locator
  readonly saveComparison: Locator
  readonly saveComparisonSpinner: Locator
  readonly saveComparisonSavedState: Locator
  readonly saveComparisonCap: Locator
  readonly saveComparisonCapPanel: Locator
  readonly saveComparisonModal: Locator
  readonly saveComparisonLabel: Locator
  readonly saveComparisonConfirm: Locator
  readonly myComparisonsMenuTrigger: Locator
  readonly savedComparisonsMenu: Locator
  readonly myComparisonsProfileLink: Locator
  readonly loadComparisonDialog: Locator
  readonly loadComparisonConfirm: Locator
  readonly loadComparisonCancel: Locator
  readonly unsavedDialog: Locator
  readonly unsavedSave: Locator
  readonly unsavedSignIn: Locator
  readonly unsavedDiscard: Locator
  readonly unsavedStay: Locator
  readonly cashFlowSection: Locator
  readonly cashFlowFirstPayment: Locator
  readonly cashFlowBalance: Locator
  readonly cashFlowBreakEven: Locator

  constructor(page: Page) {
    this.page = page
    this.saveComparisonSignIn = page.getByTestId('save-comparison-sign-in')
    this.saveComparison = page.getByTestId('save-comparison')
    this.saveComparisonSpinner = page.getByTestId('save-comparison-spinner')
    this.saveComparisonSavedState = page.getByTestId('save-comparison-saved-state')
    this.saveComparisonCap = page.getByTestId('save-comparison-cap')
    this.saveComparisonCapPanel = page.getByTestId('save-comparison-cap-panel')
    this.saveComparisonModal = page.getByTestId('save-comparison-modal')
    this.saveComparisonLabel = page.getByTestId('save-comparison-label')
    this.saveComparisonConfirm = page.getByTestId('save-comparison-confirm')
    this.myComparisonsMenuTrigger = page.getByTestId('my-comparisons-menu-trigger')
    this.savedComparisonsMenu = page.getByTestId('saved-comparisons-menu')
    this.myComparisonsProfileLink = page.getByTestId('my-comparisons-link')
    this.loadComparisonDialog = page.getByTestId('load-comparison-confirm')
    this.loadComparisonConfirm = page.getByTestId('load-comparison-confirm-yes')
    this.loadComparisonCancel = page.getByTestId('load-comparison-confirm-cancel')
    this.unsavedDialog = page.getByTestId('unsaved-comparison-confirm')
    this.unsavedSave = page.getByTestId('unsaved-comparison-save')
    this.unsavedSignIn = page.getByTestId('unsaved-comparison-sign-in')
    this.unsavedDiscard = page.getByTestId('unsaved-comparison-discard')
    this.unsavedStay = page.getByTestId('unsaved-comparison-stay')
    this.cashFlowSection = page.getByTestId('compare-cashflow')
    this.cashFlowFirstPayment = page.getByTestId('compare-cashflow-firstPayment-2')
    this.cashFlowBalance = page.getByTestId('compare-cashflow-balance-2')
    this.cashFlowBreakEven = page.getByTestId('compare-cashflow-break-even-2')
  }

  async removeSavedComparison(id: string) {
    await this.page.getByTestId(`save-comparison-remove-${id}`).click()
  }

  savedComparisonMenuItem(id: string): Locator {
    return this.page.getByTestId(`saved-comparison-menu-item-${id}`)
  }

  /**
   * Opens the saved-comparison menu the way a visitor does - hover - after
   * parking the pointer, so the mouseenter is a real crossing even when a
   * previous edit shifted the trigger under a stationary pointer.
   */
  async openSavedComparisonsMenu() {
    await this.page.mouse.move(0, 0)
    await this.myComparisonsMenuTrigger.hover()
    await expect(this.savedComparisonsMenu).toBeVisible()
  }

  async expectScenarioCapRecovery() {
    const add = this.page.getByTestId('compare-add-scenario')
    if (await add.count()) await add.click()
    await expect(this.page.getByTestId('compare-add-scenario-cap')).toBeVisible()
    await expect(add).toHaveCount(0)
    await this.page.getByTestId('compare-scenario-remove-3').click()
    await expect(add).toBeVisible()
  }

  async expectRefinanceActionHeight() {
    await this.page.goto('/calculators')
    await this.page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
    const heights = await Promise.all(['open-comparison', 'open-refinance', 'reset-calculator'].map(async id => {
      const box = await this.page.getByTestId(id).boundingBox()
      return box!.height
    }))
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
    const styles = await Promise.all(['open-comparison', 'open-refinance', 'reset-calculator'].map(id =>
      this.page.getByTestId(id).evaluate(element => {
        const style = getComputedStyle(element)
        return ['backgroundColor', 'color', 'borderBottom', 'borderRadius', 'padding', 'fontSize', 'fontWeight']
          .map(property => style[property as keyof CSSStyleDeclaration])
      }),
    ))
    expect(styles[1]).toEqual(styles[0])
    expect(styles[2]).toEqual(styles[0])
  }

  async goto() {
    await this.page.goto('/compare')
    await expect(this.page.getByTestId('compare-scenario-editor-1')).toBeVisible()
    // The editor is server-rendered: wait for hydration so the forms are
    // controlled before a spec types into them (an early fill is silently
    // overwritten by React's first render).
    await this.page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
  }

  async expectMixSwitcher() {
    await expect(this.page.getByTestId('compare-switcher')).toBeVisible()
    await this.page.getByTestId('compare-switch-tab-2').click()
    await expect(this.page.getByTestId('compare-scenario-editor-2')).toBeVisible()
    await expect(this.page.getByTestId('compare-scenario-editor-1')).toBeHidden()
    await expect(this.page.getByTestId('compare-card')).toBeVisible()
    await this.page.getByTestId('compare-switch-tab-1').click()
    await expect(this.page.getByTestId('compare-scenario-editor-1')).toBeVisible()
  }

  async expectPairedCards() {
    await expect(async () => {
      for (const prefix of ['compare-scenario-editor', 'compare-result-card']) {
        const first = await this.page.getByTestId(`${prefix}-1`).boundingBox()
        const second = await this.page.getByTestId(`${prefix}-2`).boundingBox()
        expect(first).not.toBeNull()
        expect(second).not.toBeNull()
        expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1)
        expect(Math.abs(first!.width - second!.width)).toBeLessThanOrEqual(1)
        expect(Math.abs(first!.x - second!.x)).toBeGreaterThan(first!.width)
      }
    }).toPass()
  }

  async setExpiredApprovalDate() {
    await this.page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true')
    await this.page.getByTestId('compare-approval-date-1').fill('01/01/2024')
    await expect(this.page.getByTestId('compare-approval-chip-1')).toBeVisible()
  }

  async expectApprovalMessageAligned() {
    await expect(async () => {
      const input = await this.page.getByTestId('compare-approval-date-1').locator('..').boundingBox()
      const chip = await this.page.getByTestId('compare-approval-chip-1').boundingBox()
      const card = await this.page.getByTestId('compare-scenario-editor-1').boundingBox()
      expect(input).not.toBeNull()
      expect(chip).not.toBeNull()
      expect(card).not.toBeNull()
      expect(Math.abs(input!.y + input!.height / 2 - chip!.y - chip!.height / 2))
        .toBeLessThanOrEqual(1)
      const gap = Math.max(chip!.x - input!.x - input!.width, input!.x - chip!.x - chip!.width)
      expect(gap).toBeGreaterThanOrEqual(7)
      expect(gap).toBeLessThanOrEqual(9)
      expect(chip!.x).toBeGreaterThanOrEqual(card!.x)
      expect(chip!.x + chip!.width).toBeLessThanOrEqual(card!.x + card!.width)
    }).toPass({ timeout: 3000 })
  }

  async expectHeaderRow() {
    const name = await this.page.getByTestId('compare-scenario-name-1').boundingBox()
    const slider = await this.page.getByTestId('compare-term-1').boundingBox()
    expect(name).not.toBeNull()
    expect(slider).not.toBeNull()
    expect(Math.min(name!.y + name!.height, slider!.y + slider!.height))
      .toBeGreaterThan(Math.max(name!.y, slider!.y))
  }
}
