import { createServerClient } from '@/src/services/auth'
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
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const codeVerifier = typeof body?.codeVerifier === 'string' ? body.codeVerifier.trim() : ''

  if (!code || code.length > 4096 || !codeVerifier || codeVerifier.length > 256) {
    return nativeJson({ error: 'El código OAuth o el verificador PKCE no son válidos.' }, 400)
  }

  const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthExchangeIp)
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

  const { data, error } = await createServerClient().auth.exchangeOAuthCode(code, codeVerifier)
  if (error) return nativeProviderError(error, 'No se pudo completar OAuth.')

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
