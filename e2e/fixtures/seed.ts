import type { Page } from '@playwright/test'
import { LANGUAGE_VALUES, STORAGE_KEYS, type SiteLanguage } from '../data/site'

/**
 * Imperative seeding helpers for tests whose language/theme varies at
 * runtime (e.g. `for (const language of [...])` loops, where a static
 * `test.use({ language })` option cannot vary per iteration). Suites with
 * one fixed language should prefer the `languagePage` fixture instead.
 */
export async function seedLanguage(page: Page, language: SiteLanguage): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    STORAGE_KEYS.language,
    LANGUAGE_VALUES[language],
  ] as const)
}

export async function seedTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    STORAGE_KEYS.theme,
    theme,
  ] as const)
}

/** Seeds several site-state keys in one init script (language + theme...). */
export async function seedSiteState(
  page: Page,
  state: { language?: SiteLanguage; theme?: 'light' | 'dark' },
): Promise<void> {
  await page.addInitScript((seeds) => {
    if (seeds.language) localStorage.setItem(STORAGE_KEYS.language, seeds.language)
    if (seeds.theme) localStorage.setItem(STORAGE_KEYS.theme, seeds.theme)
  }, state)
}
