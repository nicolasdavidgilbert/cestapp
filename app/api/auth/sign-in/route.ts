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
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || email.length > 320 || !password || password.length > 1024) {
      return Response.json({ error: 'Correo y contraseña no son válidos.' }, { status: 400 })
    }

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.signInIp),
      checkIdentityRateLimit(email, AUTH_RATE_LIMITS.signInIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await auth.signInWithPassword({ email, password })

    if (error) {
      const status = getErrorStatus(error)
      if (status >= 400 && status < 500) {
        const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.signInIdentity)
        if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
      }

      return Response.json(
        {
          error: status >= 400 && status < 500
            ? 'No se pudo iniciar sesión. Revisa las credenciales o verifica tu correo.'
            : getErrorMessage(error, 'No se pudo iniciar sesión.'),
        },
        { status: status >= 400 && status < 500 ? 401 : 502 },
      )
    }

    await clearIdentityFailures(email, AUTH_RATE_LIMITS.signInIdentity)

    if (!data?.user) {
      await clearAuthCookies()
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    return Response.json(
      { user: data.user },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ error: 'La solicitud de inicio de sesión no es válida.' }, { status: 400 })
  }
}
