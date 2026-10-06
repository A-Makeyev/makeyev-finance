const { chromium } = require('@playwright/test')
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto('http://localhost:3100/')
  await page.waitForFunction("document.documentElement.dataset.hydrated === 'true'")
  const navList = await page.locator('#nav-list').boundingBox()
  const desktopControls = await page.locator('[data-testid="nav-bar-controls"]').boundingBox()
  const listOffset = navList.x + navList.width / 2 - 1280 / 2
  console.log('listOffset:', listOffset)
  console.log('|listOffset|:', Math.abs(listOffset))
  console.log('controls right inset:', 1280 - desktopControls.x - desktopControls.width)
  await browser.close()
})()
