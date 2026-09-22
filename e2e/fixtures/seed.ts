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
  // The browser callback must only touch its arguments: Playwright runs it
  // by serializing its source, so Node-scope imports (STORAGE_KEYS) would be
  // a ReferenceError in the page. Resolve the keys here, pass plain strings.
  const entries: string[] = []
  if (state.language) entries.push(STORAGE_KEYS.language, state.language)
  if (state.theme) entries.push(STORAGE_KEYS.theme, state.theme)
  await page.addInitScript((pairs) => {
    for (let i = 0; i < pairs.length; i += 2) localStorage.setItem(pairs[i], pairs[i + 1])
  }, entries)
}
