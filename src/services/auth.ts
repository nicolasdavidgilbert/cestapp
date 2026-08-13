import 'server-only'

import { createClient } from '@insforge/sdk'
import { cookies } from 'next/headers'
import type { AuthErrorLike, User } from '@/src/types/auth'

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
const isProduction = process.env.NODE_ENV === 'production'
const cookiePrefix = isProduction ? '__Host-' : ''

function getConfiguredAppOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (!configuredOrigin) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for authentication redirects.')
  }

  const url = new URL(configuredOrigin)
  const isDevelopmentLoopback =
    !isProduction &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)

  if (
    (url.protocol !== 'https:' && !isDevelopmentLoopback) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('NEXT_PUBLIC_APP_URL must be a trusted HTTPS origin without a path.')
  }

  return url.origin
}

const configuredAppOrigin = getConfiguredAppOrigin()

export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10

export const AUTH_COOKIE_NAMES = {
  access: `${cookiePrefix}cestapp_access`,
  refresh: `${cookiePrefix}cestapp_refresh`,
  oauthVerifier: `${cookiePrefix}cestapp_oauth_verifier`,
  oauthRedirect: `${cookiePrefix}cestapp_oauth_redirect`,
} as const

const legacyCookieNames = [
  'insforge_access_token',
  'insforge_refresh_token',
  'insforge_client_access_token',
  'insforge_client_refresh_token',
]

const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  priority: 'high' as const,
}

export type ServerAuthSession = {
  user: User
  accessToken: string
}

export function createServerClient(accessToken?: string) {
  return createClient({
    baseUrl,
    anonKey,
    isServerMode: true,
    autoRefreshToken: false,
    edgeFunctionToken: accessToken,
  })
}

export async function getAuthCookies() {
  const cookieStore = await cookies()
  return {
    accessToken: cookieStore.get(AUTH_COOKIE_NAMES.access)?.value,
    refreshToken: cookieStore.get(AUTH_COOKIE_NAMES.refresh)?.value,
  }
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAMES.access, accessToken, {
    ...authCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  })
  cookieStore.set(AUTH_COOKIE_NAMES.refresh, refreshToken, {
    ...authCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  })

  for (const name of legacyCookieNames) {
    cookieStore.delete(name)
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAMES.access, '', { ...authCookieOptions, maxAge: 0 })
  cookieStore.set(AUTH_COOKIE_NAMES.refresh, '', { ...authCookieOptions, maxAge: 0 })
  for (const name of legacyCookieNames) {
    cookieStore.delete(name)
  }
}

export async function setOAuthCookies(codeVerifier: string, redirectPath: string) {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAMES.oauthVerifier, codeVerifier, {
    ...authCookieOptions,
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  })
  cookieStore.set(AUTH_COOKIE_NAMES.oauthRedirect, redirectPath, {
    ...authCookieOptions,
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  })
}

export async function getOAuthCookies() {
  const cookieStore = await cookies()
  return {
    codeVerifier: cookieStore.get(AUTH_COOKIE_NAMES.oauthVerifier)?.value,
    redirectPath: cookieStore.get(AUTH_COOKIE_NAMES.oauthRedirect)?.value,
  }
}

export async function clearOAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAMES.oauthVerifier, '', { ...authCookieOptions, maxAge: 0 })
  cookieStore.set(AUTH_COOKIE_NAMES.oauthRedirect, '', { ...authCookieOptions, maxAge: 0 })
}

export function getRequestOrigin() {
  return configuredAppOrigin
}

export function isTrustedAuthRequest(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return !isProduction

  try {
    return new URL(origin).origin === configuredAppOrigin
  } catch {
    return false
  }
}

export function getErrorStatus(error: unknown) {
  const details = (error ?? {}) as AuthErrorLike
  return typeof details.statusCode === 'number'
    ? details.statusCode
    : typeof details.status === 'number'
      ? details.status
      : 500
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error
    ? error.message
    : typeof (error as AuthErrorLike | null)?.message === 'string'
      ? (error as AuthErrorLike).message!
      : fallback
}

export function isInvalidSessionError(error: unknown) {
  const details = (error ?? {}) as AuthErrorLike
  const status = getErrorStatus(error)
  const code = typeof details.error === 'string' ? details.error.toLowerCase() : ''
  const message = (details.message ?? '').toLowerCase()

  return (
    status === 401 ||
    status === 403 ||
    code.includes('invalid_token') ||
    code.includes('token_expired') ||
    code.includes('refresh_token') ||
    message.includes('invalid token') ||
    message.includes('token expired') ||
    message.includes('session invalid') ||
    (message.includes('refresh token') && message.includes('invalid'))
  )
}

export function toServerAuthSession(data: unknown): ServerAuthSession | null {
  if (!data || typeof data !== 'object') return null

  const candidate = data as { user?: unknown; accessToken?: unknown }
  if (!candidate.user || typeof candidate.accessToken !== 'string') return null

  return {
    user: candidate.user as User,
    accessToken: candidate.accessToken,
  }
}
