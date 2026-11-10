import { test } from '../../fixtures'
import { ComparePage } from '../../pages/ComparePage'

for (const language of ['hebrew', 'english']) {
  test(`compare keeps paired cards and an inline header: ${language}`, async ({ page }) => {
    await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
    const compare = new ComparePage(page)
    await compare.goto()
    for (const width of [1600, 1160, 1024, 1001]) {
      await page.setViewportSize({ width, height: 1000 })
      await compare.expectPairedCards()
      await compare.expectHeaderRow()
    }
    for (const width of [1000, 960, 900, 800, 768, 420, 360]) {
      await page.setViewportSize({ width, height: 1000 })
      await compare.expectHeaderRow()
      await compare.expectMixSwitcher()
    }
  })
}

for (const language of ['hebrew', 'english']) {
  test(`approval expiry stays centered beside the date: ${language}`, async ({ page }) => {
    await page.addInitScript((lang) => localStorage.setItem('site_language', lang), language)
    const compare = new ComparePage(page)
    await compare.goto()
    await compare.setExpiredApprovalDate()
    for (const width of [1160, 1060, 1040, 900, 801, 800, 768, 767, 420, 360]) {
      await page.setViewportSize({ width, height: 1000 })
      await compare.expectApprovalMessageAligned()
    }
  })
}
