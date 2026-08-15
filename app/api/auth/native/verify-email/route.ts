import { createServerClient, getErrorStatus } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  checkIdentityRateLimit,
  clearIdentityFailures,
  consumeIpRateLimit,
  recordIdentityFailure,
} from '@/src/services/authSecurity'
import { parseVerifyEmailInput } from '@/src/services/authInput'
import { runEmailVerification } from '@/src/services/authProviderFlows'
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response
  const input = parseVerifyEmailInput(prepared.body)
  if (!input.ok) return nativeJson({ error: input.error }, 400)
  const { email, code } = input.value

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.verifyIp),
    checkIdentityRateLimit(email, AUTH_RATE_LIMITS.verifyIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await runEmailVerification(createServerClient().auth, email, code)
  if (error) {
    const status = getErrorStatus(error)
    if (status >= 400 && status < 500) {
      const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.verifyIdentity)
      if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
    }
    return nativeProviderError(error, 'No se pudo verificar el correo.')
  }

  await clearIdentityFailures(email, AUTH_RATE_LIMITS.verifyIdentity)

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
