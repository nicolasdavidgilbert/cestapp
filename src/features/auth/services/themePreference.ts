import type { ThemePreference } from '@/src/types/auth'

export const THEME_PREFERENCE_STORAGE_KEY = 'cesta_theme_preference'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark'
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function getStoredThemePreference() {
  if (typeof window === 'undefined') return null
  const rawStoredTheme = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
  return isThemePreference(rawStoredTheme) ? rawStoredTheme : null
}

export function resolveThemePreference(profileTheme: unknown): ThemePreference {
  if (isThemePreference(profileTheme)) return profileTheme
  return getStoredThemePreference() ?? 'dark'
}
