import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:3100/login')
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(2000)

// read the bar state without waiting for hydrated, because this page has no navbar and no hydrated flag
const state = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  if (!nav) return 'NOSUCH: navbar element missing from the page'
  const cs = getComputedStyle(nav)
  const scrolling = nav.classList.contains('navbar-scrolling')
  const y = window.scrollY
  return [cs.backgroundColor, cs.backdropFilter, scrolling, y, cs.display, cs.opacity].join('|')
})
console.log('LOGIN BAR STATE (initial):', state)

// Now scroll like the spec does
await page.evaluate('window.scrollTo(0, 400)')
await page.waitForTimeout(600)
const stateAfter = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const scrolling = nav.classList.contains('navbar-scrolling')
  const y = window.scrollY
  return [cs.backgroundColor, cs.backdropFilter, scrolling, y, cs.display, cs.opacity].join('|')
})
console.log('LOGIN BAR STATE (after scroll 400):', stateAfter)

// Also try scrolling to bottom
await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
await page.waitForTimeout(600)
const stateBottom = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const scrolling = nav.classList.contains('navbar-scrolling')
  const y = window.scrollY
  const max = document.body.scrollHeight
  return [cs.backgroundColor, cs.backdropFilter, scrolling, y, max, cs.display, cs.opacity].join('|')
})
console.log('LOGIN BAR STATE (after scroll to bottom):', stateBottom)

// Also try the / route — does it gain navbar-scrolling at scroll 400?
await page.goto('http://localhost:3100/')
await page.waitForFunction('document.documentElement.dataset.hydrated === "true"')
const homeState = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const scrolling = nav.classList.contains('navbar-scrolling')
  const y = window.scrollY
  return [scrolling, y, cs.backgroundColor, cs.backdropFilter].join('|')
})
console.log('HOME BAR STATE (scrollY=0):', homeState)
await page.evaluate('window.scrollTo(0, 400)')
await page.waitForTimeout(600)
const homeStateAfter = await page.evaluate(() => {
  const nav = document.getElementById('navbar')
  const cs = getComputedStyle(nav)
  const scrolling = nav.classList.contains('navbar-scrolling')
  const y = window.scrollY
  return [scrolling, y, cs.backgroundColor, cs.backdropFilter].join('|')
})
console.log('HOME BAR STATE (after scroll 400):', homeStateAfter)

await browser.close()
console.log('DONE')
