import { test as base, expect, type Page } from '@playwright/test'
import { CalculatorPage } from '../pages/CalculatorPage'
import { ContactFormPage, ActionFormModalPage } from '../pages/ContactPages'
import type { SiteLanguage } from '../data/site'
import { installExternalMocks, type InstallExternalMocksOptions } from '../support/mocks'
import { seedLanguage, seedTheme } from './seed'

/**
 * The one fixtures entry point specs import from:
 *
 *   import { test, expect } from '../../fixtures'
 *
 * Composes every fixture into a single extended `test`. A spec uses what it
 * needs: a suite that must NOT mock the external feeds (marketTracker,
 * qa-visual) imports `test` and never destructures `mockedPage`/`calc`/
 * `contact`, so the mocks never install and its behavior stays as before.
 *
 * Fixtures:
 * - externalMocks: per-suite opt-in { boiKeyRate, cpi } + `mockedPage` with
 *   the intercepts installed + `emailjsRequests` recorder + page objects
 *   (`calc`, `contact`, `actionModal`) wired to the mocked page.
 * - locale/theme: pre-boot localStorage seeding (`localePage`, `themedPage`).
 * - seed: imperative helpers for tests whose language varies per iteration.
 */
export type { InstallExternalMocksOptions }

/** Suite-level defaults for the external mocks; override per test or suite. */
export type ExternalMocksOptions = InstallExternalMocksOptions

export interface ExternalMocksFixtures {
  externalMocks: ExternalMocksOptions
  /** The default `page` with the external intercepts installed before use. */
  mockedPage: Page
  /**
   * URLs of every EmailJS POST that the mocks observed. Fresh per test, so a
   * spec can assert on submissions without wiring its own onRequest.
   */
  emailjsRequests: URL[]
  /** Calculator page object wired to the mocked page (not yet navigated). */
  calc: CalculatorPage
  /** Contact form page object wired to the mocked page (navigate it yourself). */
  contact: ContactFormPage
  /** Home-page action-form modal page object wired to the mocked page. */
  actionModal: ActionFormModalPage
}

export interface LocaleFixtures {
  /** UI language, seeded into localStorage before the app boots. */
  language: SiteLanguage
  /** A page with the chosen language pre-seeded; navigate it yourself. */
  languagePage: Page
  /** languagePage + the calculator page object. */
  localizedCalc: CalculatorPage
}

export interface ThemeFixtures {
  theme: 'light' | 'dark'
  /** A page with the theme choice pre-seeded; navigate it yourself. */
  themedPage: Page
}

export type AppFixtures = ExternalMocksFixtures & LocaleFixtures & ThemeFixtures

export const test = base.extend<AppFixtures>({
  externalMocks: [{ boiKeyRate: 4.5 }, { option: true }],

  mockedPage: async ({ page, externalMocks, emailjsRequests }, use) => {
    const options: ExternalMocksOptions = {
      ...externalMocks,
      onRequest: (url: URL) => {
        if (url.host.includes('emailjs')) emailjsRequests.push(url)
        externalMocks.onRequest?.(url)
      },
    }
    await installExternalMocks(page, options)
    await use(page)
  },

  // A function fixture, NOT a bare value: a literal [] is evaluated once per
  // worker and shared by every test in it, so submissions from earlier tests
  // leak into later count assertions (the contact-count flakes). The wrapper
  // function gives each test its own fresh array.
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured first arg even when the fixture reads nothing
  emailjsRequests: async ({}, use) => {
    await use([])
  },

  calc: async ({ mockedPage }, use) => {
    await use(new CalculatorPage(mockedPage))
  },

  contact: async ({ mockedPage }, use) => {
    await use(new ContactFormPage(mockedPage))
  },

  actionModal: async ({ mockedPage }, use) => {
    await use(new ActionFormModalPage(mockedPage))
  },

  language: ['hebrew', { option: true }],

  languagePage: async ({ page, language }, use) => {
    await seedLanguage(page, language)
    await use(page)
  },

  localizedCalc: async ({ languagePage }, use) => {
    await use(new CalculatorPage(languagePage))
  },

  theme: ['light', { option: true }],

  themedPage: async ({ page, theme }, use) => {
    await seedTheme(page, theme)
    await use(page)
  },
})

export { expect }
export { seedLanguage, seedTheme, seedSiteState } from './seed'
export { serveQuotes, mockMarketQuotes } from '../support/marketMocks'
