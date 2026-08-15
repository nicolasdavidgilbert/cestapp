import { createAuthActions } from '@insforge/sdk/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'
import {
  AUTH_COOKIE_NAMES,
  getErrorStatus,
  getRequestOrigin,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'
import { INSFORGE_SSR_CONFIG } from '@/src/services/insforgeConfig'

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(AUTH_COOKIE_NAMES.oauthVerifier)
  response.cookies.delete(AUTH_COOKIE_NAMES.oauthRedirect)
}

function oauthErrorResponse(redirectPath: string) {
  const url = new URL('/sign-in', getRequestOrigin())
  url.searchParams.set('insforge_status', 'error')
  url.searchParams.set('insforge_type', 'oauth')
  url.searchParams.set('insforge_error', 'No se pudo completar Google OAuth. Inténtalo de nuevo.')
  url.searchParams.set('redirect', redirectPath)

  const response = NextResponse.redirect(url)
  clearOAuthCookies(response)
  return response
}

export async function GET(request: NextRequest) {
  const code =
    request.nextUrl.searchParams.get('insforge_code') ??
    request.nextUrl.searchParams.get('code')
  const verifier = request.cookies.get(AUTH_COOKIE_NAMES.oauthVerifier)?.value
  const redirectPath = sanitizeRedirectPath(
    request.cookies.get(AUTH_COOKIE_NAMES.oauthRedirect)?.value,
  )

  if (!code || code.length > 4096 || !verifier) {
    return oauthErrorResponse(redirectPath)
  }

  const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthExchangeIp)
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

  const response = NextResponse.redirect(new URL(redirectPath, getRequestOrigin()))
  const auth = createAuthActions({
    ...INSFORGE_SSR_CONFIG,
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  })
  const { data, error } = await auth.exchangeOAuthCode(code, verifier)

  if (error || !data?.user) {
    const status = getErrorStatus(error)
    if (status >= 500) {
      console.error('InsForge OAuth exchange failed.', { status })
    }
    return oauthErrorResponse(redirectPath)
  }

  clearOAuthCookies(response)
  response.headers.set('Cache-Control', 'no-store, private')
  return response
}
