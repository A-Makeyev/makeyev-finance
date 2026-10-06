import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// ---- hamburger tier test, at 1280 ----
await page.goto('http://localhost:3100/')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
await page.locator('[data-testid="hamburger"]').waitFor({ state: 'hidden' })
const navList = await page.locator('#nav-list').boundingBox()
const controls = await page.locator('[data-testid="nav-bar-controls"]').boundingBox()
const listOffset = navList.x + navList.width / 2 - 1280 / 2
console.log('HAMBURGER TIER @1280')
console.log('  navList:', JSON.stringify(navList))
console.log('  controls:', JSON.stringify(controls))
console.log('  listOffset:', listOffset, '=> |offset|:', Math.abs(listOffset))
const rightInset = 1280 - controls.x - controls.width
console.log('  rightInset:', rightInset)

// ---- theme spec, bar at top of / ----
await page.goto('http://localhost:3100/')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
const barAtTopRs = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const link = getComputedStyle(document.querySelector('#nav-list a'))
  const logos = [...document.querySelectorAll('[data-testid^="logo-"]')]
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => el.getAttribute('src'))
    .join(',')
  return [cs.backdropFilter, cs.backgroundColor, link.color, logos, cs.backgroundImage, cs.boxShadow].join('|')
})
console.log('BAR @ TOP OF /:', JSON.stringify(barAtTopRs))

// ---- theme spec, scroll on / ----
await page.evaluate('window.scrollTo(0, 400)')
const navClass = await page.evaluate(() => document.getElementById('navbar').classList.contains('navbar-scrolling'))
console.log('  navbar-scrolling on / after scroll to 400:', navClass)
await page.waitForTimeout(800)
const barAtScrolledRs = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const logos = [...document.querySelectorAll('[data-testid^="logo-"]')]
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => el.getAttribute('src'))
    .join(',')
  return [cs.backdropFilter, cs.backgroundColor, logos, cs.backgroundImage, cs.boxShadow].join('|')
})
console.log('  BAR @ SCROLLED ON /:', JSON.stringify(barAtScrolledRs))

// ---- theme spec, /login ----
await page.goto('http://localhost:3100/login')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
const loginBarRs = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const link = getComputedStyle(document.querySelector('#nav-list a'))
  const logos = [...document.querySelectorAll('[data-testid^="logo-"]')]
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => el.getAttribute('src'))
    .join(',')
  return [cs.backdropFilter, cs.backgroundColor, link.color, logos, cs.backgroundImage, cs.boxShadow].join('|')
})
console.log('BAR @ TOP OF /login:', JSON.stringify(loginBarRs))
const loginScrolled = await page.evaluate(() => document.getElementById('navbar').classList.contains('navbar-scrolling'))
console.log('  navbar-scrolling on /login:', loginScrolled)

// ---- theme spec, toggle theme on /articles ----
await page.goto('http://localhost:3100/articles')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
await page.click('[data-testid="nav-account-theme"]')
await page.waitForTimeout(800)
const darkBarRs = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const logos = [...document.querySelectorAll('[data-testid^="logo-"]')]
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => el.getAttribute('src'))
    .join(',')
  return [cs.backdropFilter, cs.backgroundColor, logos, cs.backgroundImage, cs.boxShadow].join('|')
})
console.log('BAR @ TOP OF /articles (dark):', JSON.stringify(darkBarRs))

// ---- saved-mix menu: do the trigger and menu exist at all on a real server? ----
await page.goto('http://localhost:3100/calculators')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
const calculatorTestIds = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid]')]
    .map((el) => el.getAttribute('data-testid'))
    .sort()
    .join('\n')
)
console.log('\nCALCULATOR TEST IDS (sorted):')
console.log(calculatorTestIds)

// ---- saved-mix: mock-signed-in path ----
// Use page.route to simulate what the spec's mockSignedInWithMixes does
await page.route('**/api/mixes', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      mixes: [
        { id: '507f1f77bcf86cd799439011', label: 'First home', termYears: 27,
          tracks: [{ type: 'fixed', amountText: '250,000', yearsText: '27', rateText: '4.8', method: 'spitzer' }],
          scenario: { startingAmountText: '250,000', propertyValueText: '1,500,000', capitalText: '400,000', incomeText: '22,000', purpose: 'first' },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '507f1f77bcf86cd799439012', label: 'Second home', termYears: 27,
          tracks: [{ type: 'fixed', amountText: '250,000', yearsText: '27', rateText: '4.8', method: 'spitzer' }],
          scenario: { startingAmountText: '250,000', propertyValueText: '1,500,000', capitalText: '400,000', incomeText: '22,000', purpose: 'first' },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      max: 4
    })
  })
})
// Trigger a fresh get of the mixes
await page.evaluate('window.location.reload()')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
const calcTestIds2 = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid]')]
    .map((el) => el.getAttribute('data-testid'))
    .filter((name) => name.includes('mix') || name.includes('menu') || name.includes('trigger') || name.includes('save') || name.includes('sign-in') || name.includes('profile'))
    .sort()
    .join('\n')
)
console.log('CALCULATOR TEST IDS (mix/menu/trigger related):')
console.log(calcTestIds2)

// ---- saved-mix: try the hover->click sequence ----
const triggerExists = await page.locator('[data-testid="my-mixes-menu-trigger"]').count()
console.log('my-mixes-menu-trigger count:', triggerExists)
if (triggerExists > 0) {
  await page.locator('[data-testid="my-mixes-menu-trigger"]').hover()
  await page.waitForTimeout(400)
  const menuCount = await page.locator('[data-testid="saved-mixes-menu"]').count()
  console.log('saved-mixes-menu count after hover:', menuCount)
  const itemCount = await page.locator('[data-testid^="saved-mix-menu-item-"]').count()
  console.log('saved-mix-menu-item count after hover:', itemCount)
  if (itemCount > 0) {
    const item = await page.locator('[data-testid^="saved-mix-menu-item-"]').first().isVisible()
    console.log('first item visible:', item)
  }
}

await browser.close()
console.log('\nDONE')
