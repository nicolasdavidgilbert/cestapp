'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getInsforgeClient, replaceInsforgeClient } from '@/src/services/insforge'
import type { RefreshResult, ThemePreference, User, UserContextType, UserProfile, UserProviderProps } from '@/src/types/auth'
import type { NativeSessionResult } from '@/src/features/auth/types'
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SESSION_REFRESH_INTERVAL_MS,
  deleteCookie,
  getAppOrigin,
  isAuthSessionError,
  isProtectedPath,
  readCookie,
  redirectToLogin,
  writeCookie,
} from '@/src/features/auth/services/tokenStorage'
import { isNativeCapacitorApp } from '@/src/features/auth/services/oauthService'
import {
  canUseSecureNativeSession,
  clearNativeSecureSession,
  exchangeOAuthCodeNative,
  migrateLegacyNativeSession,
  refreshNativeSessionSecurely,
  signInNative,
  signOutNative,
  signUpNative,
  verifyEmailNative,
} from '@/src/features/auth/services/nativeSessionService'
import {
  refreshSessionWeb,
  signInWeb,
  signOutWeb,
  signUpWeb,
  verifyEmailWeb,
  type WebAuthSession,
} from '@/src/features/auth/services/webAuthService'
import { THEME_PREFERENCE_STORAGE_KEY, applyThemePreference, resolveThemePreference } from '@/src/features/auth/services/themePreference'

const UserContext = createContext<UserContextType | null>(null)

function getNativeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

function SessionUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-3xl border border-border bg-background/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <h1 className="text-xl font-bold text-foreground">No podemos comprobar tu sesión</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Tu sesión sigue guardada. Comprueba la conexión y vuelve a intentarlo.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground transition-transform active:scale-95"
        >
          Reintentar
        </button>
      </section>
    </main>
  )
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionUnavailable, setSessionUnavailable] = useState(false)
  const redirectedAfterRefreshFailureRef = useRef(false)
  const refreshPromiseRef = useRef<Promise<RefreshResult> | null>(null)

  const normalizeUser = useCallback((raw: unknown): User => {
    const userData = raw as User
    const profileName = userData.profile?.name
    return {
      ...userData,
      name: typeof profileName === 'string' && profileName.trim() ? profileName.trim() : userData.name,
    }
  }, [])

  const applyWebSession = useCallback((session: WebAuthSession) => {
    replaceInsforgeClient(session.accessToken)
    setUser(normalizeUser(session.user))
    setSessionUnavailable(false)
  }, [normalizeUser])

  const applySecureNativeSession = useCallback((session: NativeSessionResult) => {
    replaceInsforgeClient(session.accessToken)
    setUser(normalizeUser(session.user))
    setSessionUnavailable(false)
  }, [normalizeUser])

  // Compatibility path for APKs installed before NativeSession existed.
  // New APKs migrate these cookies natively and never execute this path.
  const persistLegacyNativeTokens = useCallback((accessToken?: string | null, refreshToken?: string | null) => {
    const client = getInsforgeClient()
    if (accessToken) {
      writeCookie(ACCESS_TOKEN_COOKIE, accessToken, ACCESS_TOKEN_MAX_AGE_SECONDS)
      client.getHttpClient().setAuthToken(accessToken)
    }
    if (refreshToken) {
      writeCookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS)
      client.getHttpClient().setRefreshToken(refreshToken)
    }
  }, [])

  const hydrateLegacyNativeTokens = useCallback(() => {
    const accessToken = readCookie(ACCESS_TOKEN_COOKIE)
    const refreshToken = readCookie(REFRESH_TOKEN_COOKIE)
    const client = getInsforgeClient()
    if (accessToken) client.getHttpClient().setAuthToken(accessToken)
    if (refreshToken) client.getHttpClient().setRefreshToken(refreshToken)
  }, [])

  const clearLegacyNativeSession = useCallback(async () => {
    await getInsforgeClient().auth.signOut()
    deleteCookie(ACCESS_TOKEN_COOKIE)
    deleteCookie(REFRESH_TOKEN_COOKIE)
    replaceInsforgeClient()
  }, [])

  const handleRefreshFailure = useCallback(async () => {
    if (isNativeCapacitorApp()) {
      if (canUseSecureNativeSession()) {
        await clearNativeSecureSession().catch(() => undefined)
        replaceInsforgeClient()
      } else {
        await clearLegacyNativeSession()
      }
    } else {
      replaceInsforgeClient()
    }

    setUser(null)
    setSessionUnavailable(false)

    if (typeof window !== 'undefined' && isProtectedPath(window.location.pathname) && !redirectedAfterRefreshFailureRef.current) {
      redirectedAfterRefreshFailureRef.current = true
      redirectToLogin()
    }
  }, [clearLegacyNativeSession])

  const refreshSecureNativeSession = useCallback(async (): Promise<RefreshResult> => {
    try {
      const session = await refreshNativeSessionSecurely()
      if (!session.accessToken || !session.user) {
        await handleRefreshFailure()
        return { ok: false, reason: 'auth' }
      }

      applySecureNativeSession(session)
      return { ok: true }
    } catch (error) {
      if (isAuthSessionError(error)) {
        await handleRefreshFailure()
        return { ok: false, reason: 'auth' }
      }
      setSessionUnavailable(true)
      return { ok: false, reason: 'transient' }
    }
  }, [applySecureNativeSession, handleRefreshFailure])

  const refreshLegacyNativeSession = useCallback(async (): Promise<RefreshResult> => {
    try {
      const client = getInsforgeClient()
      const { data: refreshResponse, error } = await client.auth.refreshSession()
      if (error || !refreshResponse?.accessToken) {
        if (isAuthSessionError(error)) {
          await handleRefreshFailure()
          return { ok: false, reason: 'auth' }
        }
        setSessionUnavailable(true)
        return { ok: false, reason: 'transient' }
      }

      persistLegacyNativeTokens(
        refreshResponse.accessToken,
        refreshResponse.refreshToken ?? readCookie(REFRESH_TOKEN_COOKIE),
      )
      if (refreshResponse.user) setUser(normalizeUser(refreshResponse.user))
      setSessionUnavailable(false)
      return { ok: true }
    } catch (error) {
      if (isAuthSessionError(error)) {
        await handleRefreshFailure()
        return { ok: false, reason: 'auth' }
      }
      setSessionUnavailable(true)
      return { ok: false, reason: 'transient' }
    }
  }, [handleRefreshFailure, normalizeUser, persistLegacyNativeTokens])

  const refreshWebSession = useCallback(async (): Promise<RefreshResult> => {
    const result = await refreshSessionWeb()
    if (result.data) {
      applyWebSession(result.data)
      return { ok: true }
    }
    if (result.status === 401 || result.status === 403) {
      await handleRefreshFailure()
      return { ok: false, reason: 'auth' }
    }
    setSessionUnavailable(true)
    return { ok: false, reason: 'transient' }
  }, [applyWebSession, handleRefreshFailure])

  const refreshSession = useCallback((): Promise<RefreshResult> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current

    const operation = (
      isNativeCapacitorApp()
        ? canUseSecureNativeSession()
          ? refreshSecureNativeSession()
          : refreshLegacyNativeSession()
        : refreshWebSession()
    ).finally(() => {
      refreshPromiseRef.current = null
    })

    refreshPromiseRef.current = operation
    return operation
  }, [refreshLegacyNativeSession, refreshSecureNativeSession, refreshWebSession])

  const checkUser = useCallback(async () => {
    redirectedAfterRefreshFailureRef.current = false

    if (!isNativeCapacitorApp()) {
      await refreshSession()
      setLoading(false)
      return
    }

    if (canUseSecureNativeSession()) {
      try {
        await migrateLegacyNativeSession()
      } catch {
        // A failed migration is followed by a normal secure-session check.
      }
      await refreshSession()
      setLoading(false)
      return
    }

    hydrateLegacyNativeTokens()
    const client = getInsforgeClient()
    const { data, error } = await client.auth.getCurrentUser()

    if (!error && data?.user) {
      setUser(normalizeUser(data.user))
      setLoading(false)
      return
    }

    if (error) {
      await refreshSession()
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [hydrateLegacyNativeTokens, normalizeUser, refreshSession])

  useEffect(() => {
    if (!isNativeCapacitorApp() || canUseSecureNativeSession()) return

    const httpClient = getInsforgeClient().getHttpClient() as {
      setAuthToken: (token: string | null) => void
      setRefreshToken: (token: string | null) => void
    }
    const originalSetAuthToken = httpClient.setAuthToken.bind(httpClient)
    const originalSetRefreshToken = httpClient.setRefreshToken.bind(httpClient)

    httpClient.setAuthToken = (token: string | null) => {
      originalSetAuthToken(token)
      if (token) writeCookie(ACCESS_TOKEN_COOKIE, token, ACCESS_TOKEN_MAX_AGE_SECONDS)
      else deleteCookie(ACCESS_TOKEN_COOKIE)
    }
    httpClient.setRefreshToken = (token: string | null) => {
      originalSetRefreshToken(token)
      if (token) writeCookie(REFRESH_TOKEN_COOKIE, token, REFRESH_TOKEN_MAX_AGE_SECONDS)
      else deleteCookie(REFRESH_TOKEN_COOKIE)
    }

    return () => {
      httpClient.setAuthToken = originalSetAuthToken
      httpClient.setRefreshToken = originalSetRefreshToken
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void checkUser())
  }, [checkUser])

  useEffect(() => {
    const nextTheme = resolveThemePreference(user?.profile?.theme)
    applyThemePreference(nextTheme)
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextTheme)
  }, [user?.profile?.theme])

  useEffect(() => {
    if (!user) return

    const refreshNow = () => void refreshSession()
    const intervalId = window.setInterval(refreshNow, SESSION_REFRESH_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshNow()
    }
    const onOnline = () => refreshNow()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    }
  }, [user, refreshSession])

  async function signIn(email: string, password: string) {
    if (isNativeCapacitorApp()) {
      if (canUseSecureNativeSession()) {
        try {
          applySecureNativeSession(await signInNative(email, password))
          return {}
        } catch (error) {
          return { error: getNativeErrorMessage(error, 'No se pudo iniciar sesión.') }
        }
      }

      const { data, error } = await getInsforgeClient().auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      if (data?.user) {
        persistLegacyNativeTokens(data.accessToken ?? null, data.refreshToken ?? null)
        setUser(normalizeUser(data.user))
      }
      return {}
    }

    const result = await signInWeb(email, password)
    if (!result.data) return { error: result.error }
    applyWebSession(result.data)
    return {}
  }

  async function signUp(email: string, password: string, name: string) {
    if (isNativeCapacitorApp()) {
      if (canUseSecureNativeSession()) {
        try {
          const result = await signUpNative(email, password, name)
          if (result.requireVerification) return { requireVerification: true }
          if (result.accessToken && result.user) {
            applySecureNativeSession({ accessToken: result.accessToken, user: result.user })
          }
          return {}
        } catch (error) {
          return { error: getNativeErrorMessage(error, 'No se pudo crear la cuenta.') }
        }
      }

      const redirectTo = new URL('/sign-in', getAppOrigin()).toString()
      const { data, error } = await getInsforgeClient().auth.signUp({ email, password, name, redirectTo })
      if (error) return { error: error.message }
      if (data?.requireEmailVerification) return { requireVerification: true }
      if (data?.user) {
        persistLegacyNativeTokens(data.accessToken ?? null, data.refreshToken ?? null)
        setUser(normalizeUser(data.user))
      }
      return {}
    }

    const result = await signUpWeb(email, password, name)
    if (!result.data) return { error: result.error }
    if (result.data.requireVerification) return { requireVerification: true }
    applyWebSession(result.data)
    return {}
  }

  async function verifyEmail(email: string, code: string) {
    if (isNativeCapacitorApp()) {
      if (canUseSecureNativeSession()) {
        try {
          applySecureNativeSession(await verifyEmailNative(email, code))
          return {}
        } catch (error) {
          return { error: getNativeErrorMessage(error, 'No se pudo verificar el correo.') }
        }
      }

      const { data, error } = await getInsforgeClient().auth.verifyEmail({ email, otp: code })
      if (error) return { error: error.message }
      if (data?.user) {
        persistLegacyNativeTokens(data.accessToken ?? null, data.refreshToken ?? null)
        setUser(normalizeUser(data.user))
      }
      return {}
    }

    const result = await verifyEmailWeb(email, code)
    if (!result.data) return { error: result.error }
    applyWebSession(result.data)
    return {}
  }

  async function completeNativeOAuth(code: string, codeVerifier: string) {
    if (canUseSecureNativeSession()) {
      try {
        applySecureNativeSession(await exchangeOAuthCodeNative(code, codeVerifier))
        return {}
      } catch (error) {
        return { error: getNativeErrorMessage(error, 'No se pudo completar OAuth.') }
      }
    }

    const { data, error } = await getInsforgeClient().auth.exchangeOAuthCode(code, codeVerifier)
    if (error) return { error: error.message }
    if (data?.user) {
      persistLegacyNativeTokens(data.accessToken ?? null, data.refreshToken ?? null)
      setUser(normalizeUser(data.user))
    }
    return {}
  }

  async function refreshUser() {
    await checkUser()
  }

  async function updateProfile(profile: Record<string, unknown>) {
    const { error } = await getInsforgeClient().auth.setProfile(profile)
    if (error) return { error: error.message }
    await checkUser()
    return {}
  }

  const themePreference = resolveThemePreference(user?.profile?.theme)

  const setThemePreference = useCallback(async (nextTheme: ThemePreference) => {
    const previousTheme = resolveThemePreference(user?.profile?.theme)
    applyThemePreference(nextTheme)
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextTheme)

    if (!user) return {}

    const currentProfile = (user.profile ?? {}) as Record<string, unknown>
    const payload: Record<string, unknown> = { ...currentProfile, theme: nextTheme }
    const { error } = await getInsforgeClient().auth.setProfile(payload)

    if (error) {
      applyThemePreference(previousTheme)
      window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, previousTheme)
      return { error: error.message }
    }

    setUser((current) => {
      if (!current) return current
      const currentProfile = (current.profile ?? {}) as UserProfile
      return { ...current, profile: { ...currentProfile, theme: nextTheme } }
    })

    await checkUser()
    return {}
  }, [checkUser, user])

  async function signOut() {
    if (isNativeCapacitorApp()) {
      if (canUseSecureNativeSession()) {
        await signOutNative().catch(() => clearNativeSecureSession())
        replaceInsforgeClient()
      } else {
        await clearLegacyNativeSession()
      }
    } else {
      await signOutWeb()
      replaceInsforgeClient()
    }

    setUser(null)
    setSessionUnavailable(false)
  }

  const retrySession = () => {
    setLoading(true)
    setSessionUnavailable(false)
    void checkUser()
  }

  const showUnavailableState =
    sessionUnavailable &&
    !user &&
    typeof window !== 'undefined' &&
    isProtectedPath(window.location.pathname)

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        verifyEmail,
        completeNativeOAuth,
        refreshUser,
        updateProfile,
        themePreference,
        setThemePreference,
      }}
    >
      {showUnavailableState ? <SessionUnavailable onRetry={retrySession} /> : children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within UserProvider')
  return context
}
