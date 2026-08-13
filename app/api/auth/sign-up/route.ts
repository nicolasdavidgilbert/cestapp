import {
  createServerClient,
  getErrorMessage,
  getErrorStatus,
  getRequestOrigin,
  isTrustedAuthRequest,
  setAuthCookies,
  toServerAuthSession,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIdentityRateLimit,
  consumeIpRateLimit,
  readAuthJsonBody,
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
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (
      !email || email.length > 320 ||
      !password || password.length > 1024 ||
      !name || name.length > 120
    ) {
      return Response.json({ error: 'Nombre, correo y contraseña no son válidos.' }, { status: 400 })
    }

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.signUpIp),
      consumeIdentityRateLimit(email, AUTH_RATE_LIMITS.signUpIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const client = createServerClient()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      name,
      redirectTo: new URL('/sign-in', getRequestOrigin()).toString(),
    })

    if (error) {
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo crear la cuenta.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    if (data?.requireEmailVerification) {
      return Response.json({ requireVerification: true })
    }

    const session = toServerAuthSession(data)
    if (!session || !data?.refreshToken) {
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    await setAuthCookies(session.accessToken, data.refreshToken)
    return Response.json(session, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'La solicitud de registro no es válida.' }, { status: 400 })
  }
}
