'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { insforge } from '@/src/services/insforge'
import type { RefreshResult, ThemePreference, User, UserContextType, UserProfile, UserProviderProps } from '@/src/types/auth'
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE_SECONDS, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS, SESSION_REFRESH_INTERVAL_MS, deleteCookie, getAppOrigin, isAuthSessionError, isProtectedPath, readCookie, redirectToLogin, writeCookie } from '@/src/features/auth/services/tokenStorage'
import { THEME_PREFERENCE_STORAGE_KEY, applyThemePreference, resolveThemePreference } from '@/src/features/auth/services/themePreference'

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const redirectedAfterRefreshFailureRef = useRef(false)

  function normalizeUser(raw: unknown): User {
    const userData = raw as User
    const profileName = userData.profile?.name
    return {
      ...userData,
      name: typeof profileName === 'string' && profileName.trim() ? profileName.trim() : userData.name,
    }
  }

  const persistTokens = useCallback((accessToken?: string | null, refreshToken?: string | null) => {
    if (accessToken) {
      writeCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_MAX_AGE_SECONDS)
      insforge.getHttpClient().setAuthToken(accessToken)
    }

    if (refreshToken) {
      writeCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS)
      insforge.getHttpClient().setRefreshToken(refreshToken)
    }
  }, [])

  const hydrateTokensFromCookies = useCallback(() => {
    const accessToken = readCookie(ACCESS_TOKEN_COOKIE)
    const refreshToken = readCookie(REFRESH_TOKEN_COOKIE)

    // Do not clobber an in-memory OAuth session with null when cookies are not yet written.
    if (accessToken) {
      insforge.getHttpClient().setAuthToken(accessToken)
    }
    if (refreshToken) {
      insforge.getHttpClient().setRefreshToken(refreshToken)
    }

    return { accessToken, refreshToken }
  }, [])

  const clearTokenCookies = useCallback(() => {
    deleteCookie(ACCESS_TOKEN_COOKIE)
    deleteCookie(REFRESH_TOKEN_COOKIE)
    insforge.getHttpClient().setAuthToken(null)
    insforge.getHttpClient().setRefreshToken(null)
  }, [])

  const handleRefreshFailure = useCallback(async () => {
    clearTokenCookies()
    setUser(null)

    if (typeof window !== 'undefined' && isProtectedPath(window.location.pathname) && !redirectedAfterRefreshFailureRef.current) {
      redirectedAfterRefreshFailureRef.current = true
      redirectToLogin()
    }
  }, [clearTokenCookies])

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    try {
      const { data: refreshResponse, error } = await insforge.auth.refreshSession()

      if (error || !refreshResponse?.accessToken) {
        if (isAuthSessionError(error)) {
          await handleRefreshFailure()
          return { ok: false, reason: 'auth' }
        }

        return { ok: false, reason: 'transient' }
      }

      persistTokens(
        refreshResponse.accessToken ?? null,
        refreshResponse.refreshToken ?? readCookie(REFRESH_TOKEN_COOKIE)
      )

      if (refreshResponse.user) {
        setUser(normalizeUser(refreshResponse.user))
      }

      return { ok: true }
    } catch (error) {
      if (isAuthSessionError(error)) {
        await handleRefreshFailure()
        return { ok: false, reason: 'auth' }
      }

      return { ok: false, reason: 'transient' }
    }
  }, [handleRefreshFailure, persistTokens])

  const checkUser = useCallback(async () => {
    redirectedAfterRefreshFailureRef.current = false
    hydrateTokensFromCookies()

    const { data, error } = await insforge.auth.getCurrentUser()

    if (!error && data?.user) {
      setUser(normalizeUser(data.user))
      setLoading(false)
      return
    }

    if (error) {
      const refreshed = await refreshSession()
      if (!refreshed.ok) {
        if (refreshed.reason === 'transient') {
          const { data: retryData, error: retryError } = await insforge.auth.getCurrentUser()
          if (!retryError && retryData?.user) {
            setUser(normalizeUser(retryData.user))
          }
        }
        setLoading(false)
        return
      }

      const { data: refreshedUserData, error: refreshedUserError } = await insforge.auth.getCurrentUser()
      if (!refreshedUserError && refreshedUserData?.user) {
        setUser(normalizeUser(refreshedUserData.user))
      } else {
        setUser(null)
      }
    } else {
      setUser(null)
    }

    setLoading(false)
  }, [hydrateTokensFromCookies, refreshSession])

  useEffect(() => {
    const httpClient = insforge.getHttpClient() as {
      setAuthToken: (token: string | null) => void
      setRefreshToken: (token: string | null) => void
    }

    const originalSetAuthToken = httpClient.setAuthToken.bind(httpClient)
    const originalSetRefreshToken = httpClient.setRefreshToken.bind(httpClient)

    httpClient.setAuthToken = (token: string | null) => {
      originalSetAuthToken(token)
      if (token) {
        writeCookie(ACCESS_TOKEN_COOKIE, token, ACCESS_TOKEN_MAX_AGE_SECONDS)
      } else {
        deleteCookie(ACCESS_TOKEN_COOKIE)
      }
    }

    httpClient.setRefreshToken = (token: string | null) => {
      originalSetRefreshToken(token)
      if (token) {
        writeCookie(REFRESH_TOKEN_COOKIE, token, REFRESH_TOKEN_MAX_AGE_SECONDS)
      } else {
        deleteCookie(REFRESH_TOKEN_COOKIE)
      }
    }

    return () => {
      httpClient.setAuthToken = originalSetAuthToken
      httpClient.setRefreshToken = originalSetRefreshToken
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void checkUser()
    })
  }, [checkUser])

  useEffect(() => {
    const nextTheme = resolveThemePreference(user?.profile?.theme)
    applyThemePreference(nextTheme)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextTheme)
    }
  }, [user?.profile?.theme])

  useEffect(() => {
    if (!user) return

    const refreshNow = () => {
      void refreshSession()
    }

    const intervalId = window.setInterval(refreshNow, SESSION_REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [user, refreshSession])

  async function signIn(email: string, password: string) {
    const { data, error } = await insforge.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function signUp(email: string, password: string, name: string) {
    const redirectTo = new URL('/sign-in', getAppOrigin()).toString()
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo
    })
    if (error) return { error: error.message }
    if (data?.requireEmailVerification) {
      return { requireVerification: true }
    }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function verifyEmail(email: string, code: string) {
    const { data, error } = await insforge.auth.verifyEmail({ email, otp: code })
    if (error) return { error: error.message }
    if (data?.user) {
      persistTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function refreshUser() {
    await checkUser()
  }

  async function updateProfile(profile: Record<string, unknown>) {
    const { error } = await insforge.auth.setProfile(profile)
    if (error) return { error: error.message }
    await checkUser()
    return {}
  }

  const themePreference = resolveThemePreference(user?.profile?.theme)

  const setThemePreference = useCallback(async (nextTheme: ThemePreference) => {
    const previousTheme = resolveThemePreference(user?.profile?.theme)
    applyThemePreference(nextTheme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextTheme)
    }

    if (!user) return {}

    const currentProfile = (user.profile ?? {}) as Record<string, unknown>
    const payload: Record<string, unknown> = {
      ...currentProfile,
      theme: nextTheme,
    }

    const { error } = await insforge.auth.setProfile(payload)
    if (error) {
      applyThemePreference(previousTheme)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, previousTheme)
      }
      return { error: error.message }
    }

    setUser((current) => {
      if (!current) return current
      const currentProfile = (current.profile ?? {}) as UserProfile
      return {
        ...current,
        profile: {
          ...currentProfile,
          theme: nextTheme,
        },
      }
    })

    await checkUser()
    return {}
  }, [checkUser, user])

  async function signOut() {
    await insforge.auth.signOut()
    clearTokenCookies()
    setUser(null)
  }

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        verifyEmail,
        refreshUser,
        updateProfile,
        themePreference,
        setThemePreference,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
