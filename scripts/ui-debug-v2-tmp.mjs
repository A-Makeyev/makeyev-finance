import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// ---- login page ----
await page.goto('http://localhost:3100/login')
// poll until the script has tried to set data-theme
await page.waitForFunction('document.documentElement.dataset.theme === "light" || document.documentElement.dataset.theme === "dark"', { timeout: 10000 })
const htmlAfterScripts = await page.evaluate(() => document.documentElement.outerHTML.split('data-theme=')[1]?.slice(0, 60))
console.log('login page data-theme after scripts:', htmlAfterScripts)

// is navbar present in the snapshot?
const navbarCount = await page.locator('#navbar').count()
console.log('navbar count on /login:', navbarCount)
if (navbarCount === 0) {
  console.log('navbar NOT present on login page - the spec reads navbar state on a page that has no navbar')
  console.log('=> this is why scrollIntoScrolledState times out on /login')
}

// ---- what data-testids does /login actually serve? ----
const loginTestIds = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid]')]
    .map((el) => el.getAttribute('data-testid'))
    .sort()
    .join('\n')
)
console.log('LOGIN TEST IDS:')
console.log(loginTestIds)

// ---- the hidden hydrated flag ----
const hydratedCheck = await page.evaluate(() => {
  const value = document.documentElement.dataset.hydrated
  return String(value ?? '(not set)')
})
console.log('document.documentElement.dataset.hydrated on /login:', hydratedCheck)

await browser.close()
console.log('DONE')
