import { createClient, InsForgeClient } from '@insforge/sdk'
import { cookies, headers } from 'next/headers'
import type { AuthErrorLike } from '@/src/types/auth'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!

// We keep server cookies separate and httpOnly for security (XSS protection)
const accessCookie = 'insforge_access_token'
const refreshCookie = 'insforge_refresh_token'

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7
}


/**
 * Basic client factory for server-side use
 */
export function createServerClient(accessToken?: string) {
  return createClient({
    baseUrl,
    anonKey,
    isServerMode: true,
    autoRefreshToken: false,
    edgeFunctionToken: accessToken
  })
}

/**
 * Cookie management helpers
 */
export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(accessCookie, accessToken, { ...authCookieOptions, maxAge: 60 * 15 })
  cookieStore.set(refreshCookie, refreshToken, authCookieOptions)
}

export async function getAuthCookies() {
  const cookieStore = await cookies()
  return {
    accessToken: cookieStore.get(accessCookie)?.value,
    refreshToken: cookieStore.get(refreshCookie)?.value
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(accessCookie)
  cookieStore.delete(refreshCookie)
}

/**
 * Logic to detect if an error is due to an expired/invalid session
 */
export function isAuthError(error: AuthErrorLike | null | undefined) {
  if (!error) return false
  const status = error.status || error.statusCode
  const message = error.message?.toLowerCase() || ''
  return (
    status === 401 ||
    status === 403 ||
    message.includes('invalid token') ||
    message.includes('session invalid') ||
    message.includes('unauthorized')
  )
}

function getSdkError(result: unknown): AuthErrorLike | null {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    return null
  }

  const error = result.error
  return error && typeof error === 'object' ? (error as AuthErrorLike) : null
}

/**
 * Manual session refresh for server mode
 */
export async function refreshSession() {
  const { refreshToken } = await getAuthCookies()
  if (!refreshToken) return null

  const insforge = createServerClient()
  const { data, error } = await insforge.auth.refreshSession({ refreshToken })

  if (error || !data?.accessToken || !data?.refreshToken) {
    await clearAuthCookies()
    return null
  }

  await setAuthCookies(data.accessToken, data.refreshToken)
  return data.accessToken
}

/**
 * THE SOLUTION: A unified authenticated client getter.
 * Use this for all server-side database or auth calls.
 * 
 * Usage:
 * const insforge = await getInsforge();
 * const { data, error } = await insforge.safeExecute(c => c.database.from('items').select('*'));
 */
export async function getInsforge() {
  const { accessToken } = await getAuthCookies()
  const client = createServerClient(accessToken)

  return {
    ...client,
    /**
     * Executes any SDK call and retries once if it fails with an auth error
     */
    async safeExecute<T>(call: (client: InsForgeClient) => Promise<T>): Promise<T> {
      const result = await call(client)
      const error = getSdkError(result)

      if (isAuthError(error)) {
        const newAccessToken = await refreshSession()
        if (newAccessToken) {
          const retryClient = createServerClient(newAccessToken)
          return await call(retryClient)
        }
      }
      return result
    }
  }
}

/**
 * Auth Actions
 */
export async function getCurrentUser() {
  const insforge = await getInsforge()
  const { data } = await insforge.safeExecute((c) => c.auth.getCurrentUser())
  return data?.user ?? null
}

export async function signIn(formData: FormData) {
  const insforge = createServerClient()
  const { data, error } = await insforge.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? '')
  })

  if (error || !data?.accessToken || !data?.refreshToken) {
    return { success: false, error: error?.message ?? 'Sign in failed.' }
  }

  await setAuthCookies(data.accessToken, data.refreshToken)
  return { success: true }
}

export async function signUp(formData: FormData) {
  const insforge = createServerClient()
  const redirectTo = new URL('/sign-in', await getServerAppOrigin()).toString()
  const { data, error } = await insforge.auth.signUp({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    name: String(formData.get('name') ?? '').trim(),
    redirectTo
  })

  if (error) return { success: false, error: error.message }

  if (data?.requireEmailVerification) {
    return { success: true, requireEmailVerification: true, verifyEmailMethod: 'code' }
  }

  if (data?.accessToken && data?.refreshToken) {
    await setAuthCookies(data.accessToken, data.refreshToken)
    return { success: true }
  }

  return { success: false, error: 'Registration failed.' }
}

export async function signOut() {
  const { accessToken } = await getAuthCookies()
  if (accessToken) {
    const insforge = createServerClient(accessToken)
    await insforge.auth.signOut()
  }
  await clearAuthCookies()
}

export async function signInWithOAuth(provider: string, redirectTo: string) {
  const insforge = createServerClient()
  const { data, error } = await insforge.auth.signInWithOAuth({
    provider: provider as "google",
    redirectTo,
    skipBrowserRedirect: true
  })

  if (error) throw error
  return data?.url // The caller (Server Action) should redirect to this URL
}

/**
 * Helpers
 */
async function getServerAppOrigin() {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const proto = headerStore.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http')

  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}
