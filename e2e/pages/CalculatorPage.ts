import { expect, type Locator, type Page } from '@playwright/test'

/** Page Object for the mortgage calculator page (/calculators). */export class CalculatorPage {
  readonly page: Page
  /** The calculator panel's own heading (its scroll landing spot). */
  readonly panelHeading: Locator
  readonly avgMonthlyPayment: Locator
  readonly highestPayment: Locator
  readonly totalInterest: Locator
  readonly totalPayment: Locator
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
  /** אישור עקרוני approval date and the rate-validity chip it drives. */
  readonly approvalDate: Locator
  readonly rateValidityChip: Locator
  /** Advisor-metric extra: the total principal the payments give back. */
  readonly principalDecline: Locator
  /** The highest-payment card's caption (carries the peak year). */
  readonly highestCaption: Locator
  /** The starting-point row's primary action and its action cell. */
  readonly showPayments: Locator
  readonly startingActions: Locator
  /** Saved-mix menu trigger, menu and profile management link. */
  readonly myMixesMenuTrigger: Locator
  readonly savedMixesMenu: Locator
  readonly myMixesProfileLink: Locator
  /** Toggle that reveals the thirteen secondary result cards. */
  readonly resultsToggle: Locator
  /** The explanation dialog's "learn more" link. */
  readonly resultsCardModalLink: Locator
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
  /** The rate-reset and CPI forecast panel (may be absent for a fixed mix). */
  readonly forecast: ForecastPanel
  readonly unsavedSave: Locator
  readonly unsavedStay: Locator
  readonly unsavedLeave: Locator

  constructor(page: Page) {
    this.page = page
    this.panelHeading = page.getByTestId('panel-heading')
    this.avgMonthlyPayment = page.getByTestId('avg-monthly-payment')
    this.highestPayment = page.getByTestId('highest-payment')
    this.totalInterest = page.getByTestId('total-interest')
    this.totalPayment = page.getByTestId('total-payment')
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
    this.approvalDate = page.getByTestId('approval-date')
    this.rateValidityChip = page.getByTestId('rate-validity-chip')
    this.principalDecline = page.getByTestId('principal-decline')
    this.highestCaption = page.getByTestId('highest-caption')
    this.showPayments = page.getByTestId('show-payments')
    this.startingActions = page.getByTestId('starting-actions')
    this.myMixesMenuTrigger = page.getByTestId('my-mixes-menu-trigger')
    this.savedMixesMenu = page.getByTestId('saved-mixes-menu')
    this.myMixesProfileLink = page.getByTestId('my-mixes-link')
    this.resultsToggle = page.getByTestId('results-toggle')
    this.resultsCardModalLink = page.getByTestId('results-card-modal-link')
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
    this.forecast = new ForecastPanel(page)
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
    await expect(this.avgMonthlyPayment).toBeVisible()
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

  /** Sets the אישור עקרוני approval date (a date-only 'YYYY-MM-DD' value). */
  async setApprovalDate(value: string): Promise<void> {
    await this.approvalDate.fill(value)
  }

  /**
   * The rate-validity chip's status, or null when no chip is rendered. Read
   * from `data-status` rather than the text: the rendered date is
   * locale-dependent, the status is not.
   */
  async rateValidityStatus(): Promise<string | null> {
    if ((await this.rateValidityChip.count()) === 0) return null
    return this.rateValidityChip.getAttribute('data-status')
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

  /** Expand the results grid so the thirteen secondary cards are visible. */
  async showAllResults(): Promise<void> {
    await this.resultsToggle.click()
    await expect(this.page.getByTestId('total-payment')).toBeVisible()
  }

  /** Open one result card's explanation dialog by its value test id. */
  async openResultCard(testId: string): Promise<void> {
    await this.page.getByTestId(testId).click()
    await expect(this.page.getByTestId('results-card-modal')).toBeVisible()
  }

  /** The display-only market-margin line under a track's payback ratio. */
  marketMargin(index: number): Locator {
    return this.page.getByTestId(`track-market-margin-${index}`)
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
  margin(): Locator {
    return this.root(this.index).getByTestId(`track-margin-${this.index}`)
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

/**
 * The rate-reset step chart and the cumulative cost forecast. Its `<details>`
 * tables carry the exact figures the charts plot, so a spec asserts on those
 * rather than trying to read SVG geometry.
 */
export class ForecastPanel {
  readonly root: Locator
  readonly heading: Locator
  readonly cards: Locator
  readonly resetChart: Locator
  readonly costChart: Locator
  readonly resetPlot: Locator
  readonly costPlot: Locator
  readonly resetCaption: Locator
  readonly costCaption: Locator
  readonly noResetNote: Locator
  readonly noIndexationNote: Locator
  readonly resetTable: Locator
  readonly costTable: Locator
  readonly resetTableScroll: Locator
  readonly costTableScroll: Locator
  readonly resetRows: Locator
  readonly disclaimer: Locator

  constructor(page: Page) {
    this.root = page.getByTestId('forecast-section')
    this.heading = this.root.locator('h2')
    this.cards = this.root.locator('.forecast-card')
    this.resetChart = page.getByTestId('forecast-reset-chart')
    this.costChart = page.getByTestId('forecast-cost-chart')
    this.resetPlot = this.resetChart.locator('.forecast-plot')
    this.costPlot = this.costChart.locator('.forecast-plot')
    this.resetCaption = page.getByTestId('forecast-reset-caption')
    this.costCaption = page.getByTestId('forecast-cost-caption')
    this.noResetNote = page.getByTestId('forecast-no-reset')
    this.noIndexationNote = page.getByTestId('forecast-no-indexation')
    this.resetTable = page.getByTestId('forecast-reset-table')
    this.costTable = page.getByTestId('forecast-cost-table')
    this.resetTableScroll = this.resetTable.locator('.forecast-table-scroll')
    this.costTableScroll = this.costTable.locator('.forecast-table-scroll')
    this.resetRows = this.resetTable.locator('tr.is-reset')
    this.disclaimer = this.root.locator('.forecast-disclaimer')
  }

  async scrollTo(): Promise<void> {
    await this.root.scrollIntoViewIfNeeded()
  }

  /** The tables ship open; this only opens one the user has collapsed. */
  async openResetTable(): Promise<void> {
    await this.ensureOpen(this.resetTable)
  }

  async openCostTable(): Promise<void> {
    await this.ensureOpen(this.costTable)
  }

  private async ensureOpen(details: Locator): Promise<void> {
    if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await details.locator('summary').click()
    }
    await expect(details.locator('table')).toBeVisible()
  }

  /** The base / +1pp / -1pp payments at the start of `year` (1-based). */
  async resetPayments(year: number): Promise<{ base: number; up: number; down: number }> {
    const amounts = await this.rowAmounts(this.resetTable, year)
    return { base: amounts[0] ?? 0, up: amounts[1] ?? 0, down: amounts[2] ?? 0 }
  }

  /** The base path's cumulative interest (and indexation, when present). */
  async costTotals(year: number): Promise<{ interest: number; indexation: number }> {
    const amounts = await this.rowAmounts(this.costTable, year)
    return { interest: amounts[0] ?? 0, indexation: amounts[1] ?? 0 }
  }

  /**
   * Distance from the frame's inner bottom edge to the nearest row border
   * above it. Rows that fill the viewport leave this at zero; a partial row
   * leaves the gap you would otherwise see as a second line.
   */
  async bottomRowGap(scroll: Locator): Promise<number> {
    return scroll.evaluate((element) => {
      const border = Number.parseFloat(getComputedStyle(element).borderBottomWidth) || 0
      const innerBottom = element.getBoundingClientRect().bottom - border
      const edges = Array.from(element.querySelectorAll('tbody tr')).flatMap((row) => {
        const box = row.getBoundingClientRect()
        return [box.top, box.bottom]
      })
      const above = edges.filter((edge) => edge <= innerBottom + 0.5)
      return above.length === 0 ? Number.POSITIVE_INFINITY : innerBottom - Math.max(...above)
    })
  }

  private async rowAmounts(table: Locator, year: number): Promise<number[]> {
    const cells = await table.locator('tbody tr').nth(year - 1).locator('td').all()
    return Promise.all(cells.map((cell) => this.amountOf(cell)))
  }

  /** Reads a money cell as a number (₪, commas, RTL marks and all). */
  private async amountOf(cell: Locator): Promise<number> {
    const text = (await cell.innerText()).replace(/[^\d.]/g, '')
    return Number.parseFloat(text) || 0
  }
}
