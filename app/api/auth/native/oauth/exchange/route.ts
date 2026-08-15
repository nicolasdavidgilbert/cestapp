import { createServerClient } from '@/src/services/auth'
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
import { parseOAuthExchangeInput } from '@/src/services/authInput'
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response
  const input = parseOAuthExchangeInput(prepared.body)
  if (!input.ok) return nativeJson({ error: input.error }, 400)
  const { code, codeVerifier } = input.value

  const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthExchangeIp)
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

  const { data, error } = await createServerClient().auth.exchangeOAuthCode(code, codeVerifier)
  if (error) return nativeProviderError(error, 'No se pudo completar OAuth.')

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
