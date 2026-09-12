/**
 * Site-wide color theme - same contract as `@/i18n`: a tiny DOM-facing module
 * (resolve -> apply -> persist) that owns the stored choice, the OS fallback
 * and the `data-theme` attribute every CSS token hangs off. Pages added later
 * get dark mode for free by using the `soft-*`/surface tokens instead of
 * hardcoded colors; nothing here is mortgage-specific.
 *
 * Kept dependency-free and importable from plain Node (the unit tests load it
 * without a DOM), so the pure decisions are split from the DOM writes.
 */

export type Theme = 'light' | 'dark'

/**
 * What the user picked. `system` is the pre-choice default, so a first visit
 * follows the OS instead of forcing light; the toggle writes an explicit
 * `light`/`dark` from then on. `system` is never written by the UI, but stays
 * valid so a future "system" control (or a hand-set value) keeps working.
 */
export type ThemePreference = Theme | 'system'

export const DEFAULT_THEME: ThemePreference = 'system'

/** Persisted choice key - a site-wide setting, not tied to the mortgage domain. */
export const THEME_STORAGE_KEY = 'site_theme'

/** Mirrors the pre-paint script in client/index.html - keep the two in sync. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system']

function canUseDom(): boolean {
  return typeof document !== 'undefined'
}

/**
 * Parses a raw stored value. Anything unknown (or absent) means "no choice
 * yet" -> the caller falls back to `system`. Pure, so it is unit-tested with
 * the values localStorage can actually hand back.
 */
export function parseStoredTheme(raw: string | null | undefined): ThemePreference | null {
  return raw != null && (PREFERENCES as readonly string[]).includes(raw)
    ? (raw as ThemePreference)
    : null
}

/** The OS preference, as a two-state value. */
export function systemTheme(): Theme {
  if (!canUseDom()) return 'light'
  try {
    return window.matchMedia?.(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
  } catch {
    // matchMedia unavailable - light is the safe, always-legible default.
    return 'light'
  }
}

/** Resolves a preference to the theme actually shown. Pure. */
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): Theme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light'
  return preference
}

function readStoredTheme(): ThemePreference {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function persistTheme(preference: ThemePreference): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Unavailable/quota storage - the session keeps the chosen theme.
  }
}

let preference: ThemePreference = readStoredTheme()
const listeners = new Set<() => void>()

/** Current effective theme (OS-aware). */
export function currentTheme(): Theme {
  return resolveTheme(preference, systemTheme() === 'dark')
}

/** Current stored preference - the snapshot `useTheme` subscribes to. */
export function themePreference(): ThemePreference {
  return preference
}

/** Applies the effective theme to the document. Idempotent. */
export function applyTheme(): void {
  if (!canUseDom()) return
  const theme = currentTheme()
  document.documentElement.dataset.theme = theme
  // Native widgets/scrollbars follow: keeps form controls readable in dark.
  document.documentElement.style.colorScheme = theme
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Explicit user choice: persists and applies (never `system` from the UI). */
export function changeTheme(next: ThemePreference): void {
  preference = next
  persistTheme(next)
  applyTheme()
  notify()
}

/** Flips light <-> dark from the current effective theme. */
export function toggleTheme(): void {
  changeTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}

if (canUseDom()) {
  // Follow the OS live while the user has not made an explicit choice.
  try {
    window.matchMedia?.(DARK_MEDIA_QUERY).addEventListener('change', () => {
      if (preference !== 'system') return
      applyTheme()
      notify()
    })
  } catch {
    // Older/limited matchMedia - the theme simply does not follow live.
  }
  applyTheme()
}
