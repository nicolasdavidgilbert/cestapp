import {
  clearAuthCookies,
  createServerAuthActions,
  getErrorMessage,
  getErrorStatus,
  isTrustedAuthRequest,
} from '@/src/services/auth'
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
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  try {
    const bodyResult = await readAuthJsonBody(request)
    if (!bodyResult.ok) {
      return Response.json({ error: bodyResult.error }, { status: bodyResult.status })
    }

    const body = bodyResult.body
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    if (!email || email.length > 320 || !/^\d{6}$/.test(code)) {
      return Response.json({ error: 'Correo y código de seis cifras son obligatorios.' }, { status: 400 })
    }

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.verifyIp),
      checkIdentityRateLimit(email, AUTH_RATE_LIMITS.verifyIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await auth.verifyEmail({ email, otp: code })

    if (error) {
      const status = getErrorStatus(error)
      if (status >= 400 && status < 500) {
        const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.verifyIdentity)
        if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
      }

      return Response.json(
        { error: getErrorMessage(error, 'No se pudo verificar el correo.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    await clearIdentityFailures(email, AUTH_RATE_LIMITS.verifyIdentity)

    if (!data?.user) {
      await clearAuthCookies()
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    return Response.json(
      { user: data.user },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ error: 'La solicitud de verificación no es válida.' }, { status: 400 })
  }
}
