import { useCallback, useSyncExternalStore } from 'react'
import {
  currentTheme,
  subscribeTheme,
  themePreference,
  toggleTheme,
  type Theme,
  type ThemePreference,
} from '@/theme'

export interface UseThemeResult {
  /** Theme actually shown (OS-aware when the preference is `system`). */
  theme: Theme
  /** Stored choice - `system` until the user toggles. */
  preference: ThemePreference
  isDark: boolean
  /** Flips light <-> dark and persists the explicit choice. */
  toggle: () => void
}

/**
 * Subscribes a component to the site theme. The snapshot is the preference
 * plus the effective theme, so the OS flipping while on `system` re-renders
 * the toggle icon too (the CSS itself already updates via `data-theme`).
 */
export function useTheme(): UseThemeResult {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    () => `${themePreference()}:${currentTheme()}`,
    () => `${themePreference()}:${currentTheme()}`,
  )
  const theme = snapshot.split(':')[1] as Theme

  const toggle = useCallback(() => {
    toggleTheme()
  }, [])

  return { theme, preference: themePreference(), isDark: theme === 'dark', toggle }
}
