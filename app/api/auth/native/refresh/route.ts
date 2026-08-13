import { createServerClient, isInvalidSessionError } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  rejectNonNativeRequest,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
  readAuthJsonBody,
} from '@/src/services/authSecurity'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) return nativeJson({ error: bodyResult.error }, bodyResult.status)

  const body = bodyResult.body
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!refreshToken || refreshToken.length > 8192) {
    return nativeJson({ error: 'No hay una sesión renovable.' }, 401)
  }

  const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.refreshIp)
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

  const { data, error } = await createServerClient().auth.refreshSession({ refreshToken })
  if (error) {
    return isInvalidSessionError(error)
      ? nativeJson({ error: 'La sesión ha caducado.' }, 401)
      : nativeProviderError(error, 'No se pudo renovar la sesión.')
  }

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
