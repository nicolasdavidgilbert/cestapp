import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'
import { isInvalidAuthSessionError } from '@/src/utils/authErrors'

export const ACCESS_TOKEN_COOKIE = 'insforge_client_access_token'
export const REFRESH_TOKEN_COOKIE = 'insforge_client_refresh_token'
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
export const SESSION_REFRESH_INTERVAL_MS = 8 * 60 * 1000

export function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(name + '='))

  if (!cookie) return null

  const value = cookie.slice(name.length + 1)
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === 'undefined') return

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + secure
}

export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax' + secure
}

export function isProtectedPath(pathname: string) {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/products') || pathname.startsWith('/invite')
}

export function redirectToLogin() {
  if (typeof window === 'undefined') return
  const pathname = window.location.pathname
  if (pathname.startsWith('/sign-in')) return

  const redirect = sanitizeRedirectPath(pathname + (window.location.search || '') + (window.location.hash || ''))
  const params = new URLSearchParams()
  params.set('redirect', redirect)
  params.set('session_expired', '1')
  window.location.replace('/sign-in?' + params.toString())
}

export function isAuthSessionError(error: unknown) {
  return isInvalidAuthSessionError(error)
}
