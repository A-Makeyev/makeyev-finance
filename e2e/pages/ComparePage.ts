import { expect, type Page } from '@playwright/test'

export class ComparePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/compare')
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
