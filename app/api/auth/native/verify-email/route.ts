import { createServerClient, getErrorStatus } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  rejectNonNativeRequest,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  checkIdentityRateLimit,
  clearIdentityFailures,
  consumeIpRateLimit,
  readAuthJsonBody,
  recordIdentityFailure,
} from '@/src/services/authSecurity'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) return nativeJson({ error: bodyResult.error }, bodyResult.status)

  const body = bodyResult.body
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!email || email.length > 320 || !/^\d{6}$/.test(code)) {
    return nativeJson({ error: 'Correo y código de seis cifras son obligatorios.' }, 400)
  }

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.verifyIp),
    checkIdentityRateLimit(email, AUTH_RATE_LIMITS.verifyIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await createServerClient().auth.verifyEmail({ email, otp: code })
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
