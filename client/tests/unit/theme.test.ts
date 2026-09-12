import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changeTheme,
  currentTheme,
  DEFAULT_THEME,
  parseStoredTheme,
  resolveTheme,
  subscribeTheme,
  themePreference,
  THEME_STORAGE_KEY,
  toggleTheme,
} from '@/theme'

describe('parseStoredTheme', () => {
  it.each(['light', 'dark', 'system'] as const)('accepts %s', (value) => {
    expect(parseStoredTheme(value)).toBe(value)
  })

  it.each([[null], [undefined], [''], ['Light'], ['DARK'], ['auto'], ['null']])(
    'rejects %o as "no choice yet"',
    (value) => {
      expect(parseStoredTheme(value as string | null | undefined)).toBeNull()
    },
  )
})

describe('resolveTheme', () => {
  it('follows the OS only while the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('honours an explicit choice over the OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('defaults to system, so a first visit follows the OS', () => {
    expect(DEFAULT_THEME).toBe('system')
  })
})

describe('theme module (no DOM)', () => {
  beforeEach(() => {
    changeTheme('system')
  })

  it('starts on the persisted default in a DOM-less environment', () => {
    // Node test env has no document, so applying is a no-op and the theme
    // simply falls back to light rather than throwing.
    expect(currentTheme()).toBe('light')
  })

  it('toggle flips from the effective theme and never stores system', () => {
    toggleTheme()
    expect(themePreference()).toBe('dark')
    expect(currentTheme()).toBe('dark')
    toggleTheme()
    expect(themePreference()).toBe('light')
  })

  it('notifies subscribers on change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    changeTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    changeTheme('light')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

/**
 * The pre-paint script in client/index.html duplicates the resolution logic
 * (it must run before the bundle). These tests execute the REAL script text
 * against fake globals, so a drift between the two shows up as a failure
 * instead of a flash of the wrong theme on every load.
 */
describe('index.html pre-paint script', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  const script = match?.[1] ?? ''

  function runScript(stored: string | null, systemIsDark: boolean, storageThrows = false) {
    const documentElement = {
      dataset: {} as Record<string, string>,
      style: {} as Record<string, string>,
    }
    const document = { documentElement }
    const readKeys: string[] = []
    const localStorage = {
      getItem(key: string) {
        readKeys.push(key)
        if (storageThrows) throw new Error('storage disabled')
        return stored
      },
    }
    const window = {
      matchMedia: (query: string) => {
        expect(query).toBe('(prefers-color-scheme: dark)')
        return { matches: systemIsDark }
      },
    }
    new Function('document', 'window', 'localStorage', script)(document, window, localStorage)
    return {
      theme: documentElement.dataset.theme,
      colorScheme: documentElement.style.colorScheme,
      readKeys,
    }
  }

  it('finds exactly one inline script and it sets data-theme', () => {
    expect(script).toContain('dataset.theme')
  })

  it('reads the same storage key as src/theme', () => {
    expect(runScript(null, false).readKeys).toContain(THEME_STORAGE_KEY)
  })

  it.each<[string | null, boolean, 'light' | 'dark']>([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
    [null, true, 'dark'],
    [null, false, 'light'],
    ['bogus', true, 'dark'],
    ['bogus', false, 'light'],
  ])('stored %o with OS dark=%s paints %s before the bundle', (stored, systemIsDark, expected) => {
    const { theme, colorScheme } = runScript(stored, systemIsDark)
    expect(theme).toBe(expected)
    // color-scheme keeps native controls/scrollbars in step with the paint.
    expect(colorScheme).toBe(expected)
    // It must agree with the module's own resolution.
    expect(resolveTheme(parseStoredTheme(stored) ?? DEFAULT_THEME, systemIsDark)).toBe(expected)
  })

  it('keeps the storage key in sync with the module', () => {
    expect(THEME_STORAGE_KEY).toBe('site_theme')
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('falls back to following the OS when storage is unavailable', () => {
    expect(runScript(null, true, true).theme).toBe('dark')
    expect(runScript(null, false, true).theme).toBe('light')
  })
})
