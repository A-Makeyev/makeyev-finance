import { expect, type Locator, type Page } from '@playwright/test'

/** Page Object for the contact page form (/contact). */
export class ContactFormPage {
  readonly page: Page
  readonly submitButton: Locator
  readonly modal: Locator
  readonly modalTitle: Locator
  readonly modalBody: Locator
  readonly modalDetail: Locator
  readonly modalClose: Locator

  constructor(page: Page) {
    this.page = page
    this.submitButton = page.getByTestId('main-submit')
    this.modal = page.getByTestId('message-modal')
    this.modalTitle = page.getByTestId('modal-title')
    this.modalBody = page.getByTestId('modal-body')
    this.modalDetail = page.getByTestId('modal-detail')
    this.modalClose = page.getByTestId('message-modal-close')
  }

  async goto(): Promise<void> {
    await this.page.goto('/contact')
    await expect(this.submitButton).toBeVisible()
  }

  field(name: 'name' | 'phone' | 'email' | 'message'): Locator {
    return this.page.locator(`#main-${name}`)
  }

  fieldWrapper(name: 'name' | 'phone' | 'email' | 'message'): Locator {
    return this.page.locator(`#main-${name}`)
  }

  async fill(values: {
    name?: string
    phone?: string
    email?: string
    message?: string
  }): Promise<void> {
    if (values.name !== undefined) await this.field('name').fill(values.name)
    if (values.phone !== undefined) await this.field('phone').fill(values.phone)
    if (values.email !== undefined) await this.field('email').fill(values.email)
    if (values.message !== undefined) await this.field('message').fill(values.message)
  }

  /** Blurs the field to trigger validation feedback. */
  async blurField(name: 'name' | 'phone' | 'email'): Promise<void> {
    await this.field(name).blur()
  }

  /**
   * Computed text-align of a field, read as a string expression because the
   * e2e tsconfig has no DOM lib. Asserts which edge typed text starts from.
   */
  async textAlignOf(name: 'name' | 'phone' | 'email' | 'message'): Promise<string> {
    return this.page.evaluate(
      `(() => getComputedStyle(document.querySelector('#main-${name}')).textAlign)()`,
    )
  }
}

/** Page Object for the home-page action-form modal (short variant). */
export class ActionFormModalPage {
  readonly page: Page
  readonly heroTrigger: Locator
  readonly sectionTrigger: Locator
  readonly dialog: Locator
  readonly nameField: Locator
  readonly phoneField: Locator
  readonly messageField: Locator
  readonly submit: Locator

  constructor(page: Page) {
    this.page = page
    this.heroTrigger = page.getByTestId('hero-action-button')
    this.sectionTrigger = page.getByTestId('action-section-button')
    this.dialog = page.getByTestId('action-form-modal')
    this.nameField = page.locator('#action-name')
    this.phoneField = page.locator('#action-phone')
    this.messageField = page.locator('#action-message')
    this.submit = page.getByTestId('action-submit')
  }

  async openViaHero(): Promise<void> {
    await this.page.goto('/')
    await expect(this.heroTrigger).toBeVisible()
    await this.heroTrigger.click()
    await expect(this.dialog).toBeVisible()
  }
}

export { expect }
