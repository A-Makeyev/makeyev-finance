import { expect, type Page } from '@playwright/test'

export class CalculatorLayoutPage {
  constructor(readonly page: Page) {}

  async openSamples() {
    await this.page.getByTestId('sample-quotes').locator('summary').click()
  }

  async expectAlignedSamples() {
    const cards = this.page.locator('.sample-quote-button')
    await expect(cards).toHaveCount(6)
    const dimensions = await cards.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      const children = [...element.children].map((child) => child.getBoundingClientRect())
      return {
        width: rect.width,
        height: rect.height,
        centers: children.map((child) => child.y + child.height / 2),
        dateOffset: Math.abs(children[1].x + children[1].width / 2 - (rect.x + rect.width / 2)),
        ordered: getComputedStyle(element).direction === 'rtl'
          ? children[0].x > children[1].x && children[1].x > children[2].x
          : children[0].x < children[1].x && children[1].x < children[2].x,
        overflow: element.scrollWidth > element.clientWidth,
      }
    }))
    for (const card of dimensions) {
      expect(Math.abs(card.width - dimensions[0].width)).toBeLessThan(1)
      expect(card.height).toBe(dimensions[0].height)
      expect(Math.max(...card.centers) - Math.min(...card.centers)).toBeLessThan(4)
      expect(card.overflow).toBe(false)
      expect(card.dateOffset).toBeLessThan(1)
      expect(card.ordered).toBe(true)
    }
  }

  async expectMethodLastInFirstRow() {
    const fields = this.page.locator('.mortgage-track').first()
    const type = await fields.locator('.track-cell-type').boundingBox()
    const method = await fields.locator('.track-cell-method').boundingBox()
    expect(type).not.toBeNull()
    expect(method).not.toBeNull()
    expect(Math.abs(type!.y - method!.y)).toBeLessThan(3)
    const rtl = await fields.evaluate((element) => getComputedStyle(element).direction === 'rtl')
    expect(rtl ? method!.x < type!.x : method!.x > type!.x).toBe(true)
  }

  async expectNegativeMarginAccepted() {
    const margin = this.page.getByTestId('track-margin-1')
    await margin.fill('-0.70')
    expect(await margin.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(true)
    await expect(margin).toHaveValue('-0.70')
  }

  async expectNoPageOverflow() {
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }

  async expectMarginDirection() {
    const numbers = this.page.locator('.calculator-panel .input-wrap input[type="number"]')
    for (const input of await numbers.all()) {
      expect(await input.evaluate((element) =>
        getComputedStyle(element).direction === getComputedStyle(element.closest('.input-wrap')!).direction,
      )).toBe(true)
    }
    const margin = this.page.getByTestId('track-margin-1')
    expect(await margin.evaluate((element) => {
      const style = getComputedStyle(element)
      const direction = getComputedStyle(element.closest('fieldset')!).direction
      return style.direction === direction && style.textAlign === 'start'
    })).toBe(true)
    await expect(this.page.getByTestId('track-margin-2')).not.toHaveAttribute('placeholder')
  }

  async screenshot(path: string) {
    await this.page.getByTestId('sample-quotes').scrollIntoViewIfNeeded()
    return this.page.screenshot({ path })
  }
}
