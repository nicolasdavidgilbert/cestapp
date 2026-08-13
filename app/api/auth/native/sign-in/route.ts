import { createServerClient, getErrorStatus } from '@/src/services/auth'
import {
  nativeJson,
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
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || email.length > 320 || !password || password.length > 1024) {
    return nativeJson({ error: 'Correo y contraseña no son válidos.' }, 400)
  }

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.signInIp),
    checkIdentityRateLimit(email, AUTH_RATE_LIMITS.signInIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await createServerClient().auth.signInWithPassword({ email, password })
  if (error) {
    const status = getErrorStatus(error)
    if (status >= 400 && status < 500) {
      const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.signInIdentity)
      if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
    }

    return nativeJson(
      {
        error: status >= 400 && status < 500
          ? 'No se pudo iniciar sesión. Revisa las credenciales o verifica tu correo.'
          : 'No se pudo iniciar sesión.',
      },
      status >= 400 && status < 500 ? 401 : 502,
    )
  }

  await clearIdentityFailures(email, AUTH_RATE_LIMITS.signInIdentity)

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
