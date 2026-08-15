import { createServerClient, isInvalidSessionError } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'
import { parseRefreshInput } from '@/src/services/authInput'
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response
  const input = parseRefreshInput(prepared.body)
  if (!input.ok) return nativeJson({ error: input.error }, 401)
  const { refreshToken } = input.value

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
