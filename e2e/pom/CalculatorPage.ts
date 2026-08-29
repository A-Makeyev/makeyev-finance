import { expect, type Locator, type Page } from '@playwright/test'

/** Page Object for the mortgage calculator page (/calculators). */
export class CalculatorPage {
  readonly page: Page
  readonly monthlyPayment: Locator
  readonly highestPayment: Locator
  readonly totalInterest: Locator
  readonly totalPayment: Locator
  readonly paymentNote: Locator
  readonly formError: Locator
  readonly limitsWarning: Locator
  readonly equityNote: Locator
  readonly autofixButton: Locator
  readonly addTrackButton: Locator
  readonly resetButton: Locator
  readonly startingAmount: Locator
  readonly propertyValue: Locator
  readonly initialCapital: Locator
  readonly monthlyIncome: Locator
  readonly termSlider: Locator

  constructor(page: Page) {
    this.page = page
    this.monthlyPayment = page.getByTestId('monthly-payment')
    this.highestPayment = page.getByTestId('highest-payment')
    this.totalInterest = page.getByTestId('total-interest')
    this.totalPayment = page.getByTestId('total-payment')
    this.paymentNote = page.getByTestId('payment-note')
    this.formError = page.getByTestId('form-error')
    this.limitsWarning = page.getByTestId('limits-warning')
    this.equityNote = page.getByTestId('equity-note')
    this.autofixButton = page.getByTestId('autofix-mix')
    this.addTrackButton = page.getByTestId('add-track')
    this.resetButton = page.getByTestId('reset-calculator')
    this.startingAmount = page.getByTestId('starting-amount')
    this.propertyValue = page.getByTestId('property-value')
    this.initialCapital = page.getByTestId('initial-capital')
    this.monthlyIncome = page.getByTestId('monthly-income')
    this.termSlider = page.getByTestId('term-years')
  }

  async goto(): Promise<void> {
    await this.page.goto('/calculators')
    await expect(this.monthlyPayment).toBeVisible()
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
}

export class TrackPanel {
  private readonly root: (index: number) => Locator

  constructor(
    private readonly page: Page,
    private readonly index: number,
  ) {
    this.root = (i) => page.getByTestId(`track-${i}`)
  }

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
