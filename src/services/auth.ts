import 'server-only'

import {
  clearAuthCookies as clearInsforgeAuthCookies,
  createAuthActions as createInsforgeAuthActions,
  createServerClient as createInsforgeServerClient,
} from '@insforge/sdk/ssr'
import { cookies } from 'next/headers'
import type { AuthErrorLike } from '@/src/types/auth'
import {
  INSFORGE_AUTH_COOKIE_SETTINGS,
  INSFORGE_SSR_CONFIG,
} from '@/src/services/insforgeConfig'

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

export const OAUTH_COOKIE_MAX_AGE_SECONDS = 60 * 10

export const AUTH_COOKIE_NAMES = {
  access: INSFORGE_AUTH_COOKIE_SETTINGS.names.accessToken,
  refresh: INSFORGE_AUTH_COOKIE_SETTINGS.names.refreshToken,
  oauthVerifier: `${cookiePrefix}cestapp_oauth_verifier`,
  oauthRedirect: `${cookiePrefix}cestapp_oauth_redirect`,
} as const

const legacyCookieNames = [
  'insforge_access_token',
  'insforge_refresh_token',
  'insforge_client_access_token',
  'insforge_client_refresh_token',
]

const oauthCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  priority: 'high' as const,
}

export function createServerClient(accessToken?: string) {
  return createInsforgeServerClient({
    ...INSFORGE_SSR_CONFIG,
    ...(accessToken ? { accessToken } : {}),
  })
}

export async function createServerAuthActions() {
  return createInsforgeAuthActions({
    ...INSFORGE_SSR_CONFIG,
    cookies: await cookies(),
  })
}

export async function getAuthCookies() {
  const cookieStore = await cookies()
  return {
    accessToken: cookieStore.get(AUTH_COOKIE_NAMES.access)?.value,
    refreshToken: cookieStore.get(AUTH_COOKIE_NAMES.refresh)?.value,
  }
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  clearInsforgeAuthCookies(cookieStore, INSFORGE_AUTH_COOKIE_SETTINGS)
  for (const name of legacyCookieNames) {
    cookieStore.delete(name)
  }
}

export async function setOAuthCookies(codeVerifier: string, redirectPath: string) {
  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE_NAMES.oauthVerifier, codeVerifier, {
    ...oauthCookieOptions,
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
  })
  cookieStore.set(AUTH_COOKIE_NAMES.oauthRedirect, redirectPath, {
    ...oauthCookieOptions,
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
  cookieStore.set(AUTH_COOKIE_NAMES.oauthVerifier, '', { ...oauthCookieOptions, maxAge: 0 })
  cookieStore.set(AUTH_COOKIE_NAMES.oauthRedirect, '', { ...oauthCookieOptions, maxAge: 0 })
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
