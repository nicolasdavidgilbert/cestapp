import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'
import {
  clearOAuthCookies,
  createServerClient,
  getErrorMessage,
  getErrorStatus,
  getOAuthCookies,
  isTrustedAuthRequest,
  setAuthCookies,
  toServerAuthSession,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
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
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const { codeVerifier, redirectPath } = await getOAuthCookies()

    if (!code || code.length > 4096 || !codeVerifier) {
      await clearOAuthCookies()
      return Response.json({ error: 'El intento OAuth ha caducado. Inténtalo de nuevo.' }, { status: 400 })
    }

    const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthExchangeIp)
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

    const client = createServerClient()
    const { data, error } = await client.auth.exchangeOAuthCode(code, codeVerifier)

    if (error) {
      await clearOAuthCookies()
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo completar OAuth.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    const session = toServerAuthSession(data)
    if (!session || !data?.refreshToken) {
      await clearOAuthCookies()
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    await setAuthCookies(session.accessToken, data.refreshToken)
    await clearOAuthCookies()

    return Response.json(
      { ...session, redirect: sanitizeRedirectPath(redirectPath) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    await clearOAuthCookies()
    return Response.json({ error: 'La respuesta OAuth no es válida.' }, { status: 400 })
  }
}
