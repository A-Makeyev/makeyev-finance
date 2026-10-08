import { expect, type Locator, type Page } from '@playwright/test'

/** Page Object for the mortgage calculator page (/calculators). */export class CalculatorPage {
  readonly page: Page
  /** The calculator panel's own heading (its scroll landing spot). */
  readonly panelHeading: Locator
  readonly monthlyPayment: Locator
  readonly highestPayment: Locator
  readonly totalInterest: Locator
  readonly totalPayment: Locator
  readonly paymentNote: Locator
  readonly formError: Locator
  /** Merged good/bad/info summary notes (capital note + regulatory warnings). */
  readonly summaryNotes: Locator
  readonly autofixButton: Locator
  readonly addTrackButton: Locator
  readonly resetButton: Locator
  readonly startingAmount: Locator
  readonly propertyValue: Locator
  readonly initialCapital: Locator
  readonly monthlyIncome: Locator
  readonly termSlider: Locator
  /** The starting-point row's primary action and its action cell. */
  readonly showPayments: Locator
  readonly startingActions: Locator
  /** Saved-mix menu trigger, menu and profile management link. */
  readonly myMixesMenuTrigger: Locator
  readonly savedMixesMenu: Locator
  readonly myMixesProfileLink: Locator
  /** Toggle that reveals the twelve secondary result cards. */
  readonly resultsToggle: Locator
  /** Save-this-mix control, and its signed-out sign-in variant. */
  readonly saveMix: Locator
  readonly saveMixSignIn: Locator
  readonly saveMixLabel: Locator
  readonly saveMixConfirm: Locator
  readonly saveMixModal: Locator
  /** The "mix saved" toast shown after a successful save. */
  readonly saveMixSaved: Locator
  /** The saved-state affordance shown while the loaded mix has no edits. */
  readonly saveMixState: Locator
  /** The loaded mix's name, shown under the panel heading. */
  readonly mixTitle: Locator
  /** "New mix": drops the link to the loaded mix (with a confirm if edited). */
  readonly newMix: Locator
  readonly newMixDialog: Locator
  readonly newMixConfirm: Locator
  readonly loadMixDialog: Locator
  readonly loadMixConfirm: Locator
  readonly loadMixCancel: Locator
  /** The inline duplicate-name hint in the save dialog. */
  readonly saveMixDuplicate: Locator
  /** The "unsaved mix" confirm raised before leaving an edited calculator. */
  readonly unsavedDialog: Locator
  readonly unsavedSave: Locator
  readonly unsavedStay: Locator
  readonly unsavedLeave: Locator

  constructor(page: Page) {
    this.page = page
    this.panelHeading = page.getByTestId('panel-heading')
    this.monthlyPayment = page.getByTestId('monthly-payment')
    this.highestPayment = page.getByTestId('highest-payment')
    this.totalInterest = page.getByTestId('total-interest')
    this.totalPayment = page.getByTestId('total-payment')
    this.paymentNote = page.getByTestId('payment-note')
    this.formError = page.getByTestId('form-error')
    this.summaryNotes = page.getByTestId('summary-notes')
    this.autofixButton = page.getByTestId('autofix-mix')
    this.addTrackButton = page.getByTestId('add-track')
    this.resetButton = page.getByTestId('reset-calculator')
    this.startingAmount = page.getByTestId('starting-amount')
    this.propertyValue = page.getByTestId('property-value')
    this.initialCapital = page.getByTestId('initial-capital')
    this.monthlyIncome = page.getByTestId('monthly-income')
    this.termSlider = page.getByTestId('term-years')
    this.showPayments = page.getByTestId('show-payments')
    this.startingActions = page.getByTestId('starting-actions')
    this.myMixesMenuTrigger = page.getByTestId('my-mixes-menu-trigger')
    this.savedMixesMenu = page.getByTestId('saved-mixes-menu')
    this.myMixesProfileLink = page.getByTestId('my-mixes-link')
    this.resultsToggle = page.getByTestId('results-toggle')
    this.saveMix = page.getByTestId('save-mix')
    this.saveMixSignIn = page.getByTestId('save-mix-sign-in')
    this.saveMixLabel = page.getByTestId('save-mix-label')
    this.saveMixConfirm = page.getByTestId('save-mix-confirm')
    this.saveMixModal = page.getByTestId('save-mix-modal')
    this.saveMixSaved = page.getByTestId('save-mix-saved')
    this.saveMixState = page.getByTestId('save-mix-saved-state')
    this.mixTitle = page.getByTestId('mix-title')
    this.newMix = page.getByTestId('new-mix')
    this.newMixDialog = page.getByTestId('new-mix-confirm')
    this.newMixConfirm = page.getByTestId('new-mix-confirm-yes')
    this.loadMixDialog = page.getByTestId('load-mix-confirm')
    this.loadMixConfirm = page.getByTestId('load-mix-confirm-yes')
    this.loadMixCancel = page.getByTestId('load-mix-cancel')
    this.saveMixDuplicate = page.getByTestId('save-mix-duplicate')
    this.unsavedDialog = page.getByTestId('unsaved-mix-confirm')
    this.unsavedSave = page.getByTestId('unsaved-mix-save')
    this.unsavedStay = page.getByTestId('unsaved-mix-stay')
    this.unsavedLeave = page.getByTestId('unsaved-mix-leave')
  }

  /**
   * Acknowledges the unsaved-changes confirm if an edited mix raised it.
   * Editing the calculator puts a confirm in front of any navigation away
   * from it, so a spec that navigates after editing has to answer it.
   */
  async confirmLeaveIfPrompted(): Promise<void> {
    // The dialog is rendered by the click handler, so it lands a tick later:
    // wait briefly for it instead of sampling visibility once (which races and
    // silently skips the click).
    const appeared = await this.unsavedLeave
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false)
    if (!appeared) return

    await this.unsavedLeave.click()
    await expect(this.unsavedDialog).toBeHidden()
  }

  async goto(): Promise<void> {
    await this.page.goto('/calculators')
    await expect(this.monthlyPayment).toBeVisible()
    // The calculator is server-rendered and interactive only after hydration;
    // wait for the marker so controlled inputs are wired before we act.
    // String form: the e2e tsconfig has no DOM lib.
    await this.page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
  }

  track(index: number): TrackPanel {
    return new TrackPanel(this.page, index)
  }

  preset(id: string): Locator {
    return this.page.getByTestId(`preset-${id}`)
  }

  async selectPreset(id: string): Promise<void> {
    await this.preset(id).click()
  }

  async setPropertyValue(text: string): Promise<void> {
    await this.propertyValue.fill(text)
  }

  async setCapital(text: string): Promise<void> {
    await this.initialCapital.fill(text)
  }

  async setIncome(text: string): Promise<void> {
    await this.monthlyIncome.fill(text)
  }

  async selectPurpose(value: string): Promise<void> {
    await this.page.getByTestId('property-purpose').selectOption(value)
  }

  /**
   * The computed transform of a control, read as a string expression because
   * the e2e tsconfig has no DOM lib. Hover feedback is asserted through this,
   * since a lift is invisible to a text or visibility check.
   */
  async transformOf(locator: Locator): Promise<string> {
    const testId = await locator.getAttribute('data-testid')
    return this.page.evaluate(
      `(() => getComputedStyle(document.querySelector('[data-testid="${testId}"]')).transform)()`,
    )
  }

  /**
   * The action row's controls in READING order, as data-testids, skipping any
   * that are not rendered. This has to be direction-aware: the row is a flex
   * line whose visual order is DOM order, so "last in the row" is the rightmost
   * box in English and the leftmost in Hebrew. Sorting on x alone would assert
   * the wrong end of the row in one of the two.
   */
  async actionRowReadingOrder(): Promise<string[]> {
    return this.page.evaluate(`(() => {
      const rtl = document.documentElement.dir === 'rtl'
      return ['show-payments', 'my-mixes-menu-trigger', 'new-mix', 'save-mix']
        .map((id) => {
          const el = document.querySelector('[data-testid="' + id + '"]')
          return el ? { id, x: el.getBoundingClientRect().left } : null
        })
        .filter((entry) => entry !== null)
        .sort((a, b) => (rtl ? b.x - a.x : a.x - b.x))
        .map((entry) => entry.id)
    })()`)
  }

  /** Unsaved-dialog actions in the visual reading direction. */
  async unsavedDialogActionOrder(): Promise<string[]> {
    return this.page.evaluate(`(() => {
      const dialog = document.querySelector('[data-testid="unsaved-mix-confirm"]')
      const rtl = dialog?.getAttribute('dir') === 'rtl'
      return ['unsaved-mix-save', 'unsaved-mix-stay', 'unsaved-mix-leave']
        .map((id) => {
          const element = document.querySelector('[data-testid="' + id + '"]')
          return element ? { id, x: element.getBoundingClientRect().left } : null
        })
        .filter((item) => item !== null)
        .sort((first, second) => rtl ? second.x - first.x : first.x - second.x)
        .map((item) => item.id)
    })()`)
  }

  async modalActionVisualOrder(dialogTestId: string, actionIds: string[]): Promise<string[]> {
    const dialogSelector = JSON.stringify(`[data-testid="${dialogTestId}"]`)
    const serializedActionIds = JSON.stringify(actionIds)
    return this.page.evaluate(`(() => {
      const dialog = document.querySelector(${dialogSelector})
      const rtl = dialog?.getAttribute('dir') === 'rtl'
      const actionIds = ${serializedActionIds}
      const elements = Array.from(dialog?.querySelectorAll('[data-testid]') ?? [])
      return actionIds
        .map((id) => {
          const element = elements.find((candidate) => candidate.getAttribute('data-testid') === id)
          return element ? { id, x: element.getBoundingClientRect().left } : null
        })
        .filter((item) => item !== null)
        .sort((first, second) => rtl ? second.x - first.x : first.x - second.x)
        .map((item) => item.id)
    })()`)
  }

  async saveSpinnerPrecedesTextInReadingOrder(): Promise<boolean> {
    return this.page.evaluate(`(() => {
      const active = document.querySelector('.save-mix-label-swap-active')
      const spinner = active?.querySelector('svg')
      if (!active || !spinner) return false
      const walker = document.createTreeWalker(active, 4)
      const range = document.createRange()
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.textContent && node.textContent.trim()) {
          range.selectNodeContents(node)
          const spinnerBox = spinner.getBoundingClientRect()
          const textBox = range.getBoundingClientRect()
          return document.documentElement.dir === 'rtl'
            ? spinnerBox.left > textBox.left
            : spinnerBox.right < textBox.left
        }
      }
      return false
    })()`)
  }

  /**
   * Whether the saved-state pill's check mark sits at the END of its label, in
   * reading order. The label is a bare text node with no element to measure, so
   * its box comes from a Range over that node; the mark is the pill's only SVG.
   */
  async savedStateMarkIsAfterText(): Promise<boolean> {
    return this.page.evaluate(`(() => {
      const pill = document.querySelector('[data-testid="save-mix-saved-state"]')
      if (!pill) return false
      const mark = pill.querySelector('svg')
      if (!mark) return false
      const rtl = document.documentElement.dir === 'rtl'
      const walker = document.createTreeWalker(pill, 4)
      const range = document.createRange()
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.textContent && node.textContent.trim()) {
          range.selectNodeContents(node)
          const markX = mark.getBoundingClientRect().left
          const textX = range.getBoundingClientRect().left
          return rtl ? markX < textX : markX > textX
        }
      }
      return false
    })()`)
  }

  savedMixMenuItem(id: string): Locator {
    return this.page.getByTestId(`saved-mix-menu-item-${id}`)
  }

  /**
   * Opens the saved-mix menu the way a visitor does - hover - but first parks
   * the pointer away from the control. The menu opens on mouseenter, and a
   * mouseenter is only delivered when the pointer MOVES onto an element: after
   * an edit the layout shifts the trigger under a pointer that never moved,
   * the browser sees no crossing, and a plain hover() then walks within the
   * already-hovered element without reopening anything. Parking first makes
   * every open a real crossing, so the reopen after an edit is deterministic.
   */
  async openSavedMixesMenu(): Promise<void> {
    await this.page.mouse.move(0, 0)
    await this.myMixesMenuTrigger.hover()
    await expect(this.savedMixesMenu).toBeVisible()
  }

  async documentDirection(): Promise<string> {
    return this.page.evaluate('document.documentElement.dir')
  }

  async scrollPosition(): Promise<number> {
    return this.page.evaluate('window.scrollY')
  }

  /** Expand the results grid so the twelve secondary cards are visible. */
  async showAllResults(): Promise<void> {
    await this.resultsToggle.click()
    await expect(this.page.getByTestId('total-payment')).toBeVisible()
  }
}

export class TrackPanel {
  private readonly root: (index: number) => Locator

  constructor(
    page: Page,
    private readonly index: number,
  ) {
    this.root = (i) => page.getByTestId(`track-${i}`)
  }

  /** Track test ids are 1-based (track(1) is track-1 / track-amount-1). */
  amount(): Locator {
    return this.root(this.index).getByTestId(`track-amount-${this.index}`)
  }
  years(): Locator {
    return this.root(this.index).getByTestId(`track-years-${this.index}`)
  }
  rate(): Locator {
    return this.root(this.index).getByTestId(`track-rate-${this.index}`)
  }
  type(): Locator {
    return this.root(this.index).getByTestId(`track-type-${this.index}`)
  }
  method(): Locator {
    return this.root(this.index).getByTestId(`track-method-${this.index}`)
  }
  legend(): Locator {
    return this.root(this.index).locator('legend')
  }
  remove(): Locator {
    return this.root(this.index).getByTestId(`remove-track-${this.index}`)
  }

  async setAmount(text: string): Promise<void> {
    await this.amount().fill(text)
    await this.amount().blur()
  }

  async setType(value: string): Promise<void> {
    await this.type().selectOption(value)
  }

  async removeTrack(): Promise<void> {
    await this.remove().click()
  }
}
