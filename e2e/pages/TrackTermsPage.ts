import { expect, type Page } from '@playwright/test'

/** The same term workflow in the calculator or one Compare scenario. */
export class TrackTermsPage {
  constructor(readonly page: Page, readonly scenario?: number) {}

  private years(index: number) {
    return this.page.getByTestId(this.scenario
      ? `compare-track-years-${this.scenario}-${index}` : `track-years-${index}`)
  }

  private slider() {
    return this.page.getByTestId(this.scenario ? `compare-term-${this.scenario}` : 'term-years')
  }

  async verifyOverrides() {
    await this.slider().fill('20')
    await this.years(1).fill('30')
    await this.years(1).blur()
    await expect(this.slider()).toHaveValue('30')
    const prefix = this.scenario ? `compare-term-${this.scenario}-confirm` : 'term-years-confirm'
    const dialog = this.page.getByTestId(prefix)
    await this.slider().fill('25')
    await expect(dialog).toBeHidden()
    await expect(this.years(1)).toHaveValue('30')
    await expect(this.years(2)).toHaveValue('20')
    await this.slider().dispatchEvent('pointerup')
    await expect(dialog).toBeVisible()
    await this.page.getByTestId(`${prefix}-cancel`).click()
    await expect(dialog).toBeHidden()
    await expect(this.slider()).toHaveValue('30')
    await expect(this.years(1)).toHaveValue('30')
    await expect(this.years(2)).toHaveValue('20')

    // Keyboard edits use the same confirmation, including Escape cancellation.
    await this.slider().focus()
    await this.slider().press('Home')
    await expect(dialog).toBeVisible()
    await this.page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(this.slider()).toHaveValue('30')

    await this.slider().fill('25')
    await this.slider().blur()
    await expect(dialog).toBeVisible()
    await this.page.getByTestId(`${prefix}-apply`).focus()
    await this.page.getByTestId(`${prefix}-apply`).press('Enter')
    await expect(dialog).toBeHidden()
    await expect(this.years(1)).toHaveValue('25')
    await expect(this.years(2)).toHaveValue('25')
    await this.slider().fill('20')
    await expect(this.years(1)).toHaveValue('20')
    await expect(this.years(2)).toHaveValue('20')
    await expect(dialog).toBeHidden()
    await expect(this.page.locator('.term-action')).toHaveCount(0)
  }

  async expectNoOverflow() {
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
}
