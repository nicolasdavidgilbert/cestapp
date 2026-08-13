import 'server-only'

import type { User } from '@/src/types/auth'
import { getErrorMessage, getErrorStatus } from '@/src/services/auth'

const NATIVE_AUTH_HEADER = 'x-cestapp-native'
const NATIVE_AUTH_HEADER_VALUE = 'android-v1'

export type NativeAuthSession = {
  user: User
  accessToken: string
  refreshToken: string
}

export function isNativeAuthRequest(request: Request) {
  return (
    request.headers.get(NATIVE_AUTH_HEADER) === NATIVE_AUTH_HEADER_VALUE &&
    !request.headers.has('origin') &&
    !request.headers.has('sec-fetch-site') &&
    !request.headers.has('sec-fetch-mode')
  )
}

export function toNativeAuthSession(data: unknown): NativeAuthSession | null {
  if (!data || typeof data !== 'object') return null

  const candidate = data as {
    user?: unknown
    accessToken?: unknown
    refreshToken?: unknown
  }

  if (
    !candidate.user ||
    typeof candidate.accessToken !== 'string' ||
    !candidate.accessToken ||
    typeof candidate.refreshToken !== 'string' ||
    !candidate.refreshToken
  ) {
    return null
  }

  return {
    user: candidate.user as User,
    accessToken: candidate.accessToken,
    refreshToken: candidate.refreshToken,
  }
}

export function nativeJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function rejectNonNativeRequest(request: Request) {
  return isNativeAuthRequest(request)
    ? null
    : nativeJson({ error: 'Cliente nativo no permitido.' }, 403)
}

export function nativeProviderError(error: unknown, fallback: string) {
  const providerStatus = getErrorStatus(error)
  const status = providerStatus >= 400 && providerStatus < 500 ? providerStatus : 502
  return nativeJson({ error: getErrorMessage(error, fallback) }, status)
}
