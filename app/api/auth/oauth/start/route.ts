import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'
import {
  createServerClient,
  getErrorMessage,
  getErrorStatus,
  getRequestOrigin,
  isTrustedAuthRequest,
  setOAuthCookies,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
  readAuthJsonBody,
} from '@/src/services/authSecurity'

const supportedProviders = new Set(['google', 'github'])

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
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const redirectPath = sanitizeRedirectPath(typeof body.redirect === 'string' ? body.redirect : null)

    if (!supportedProviders.has(provider)) {
      return Response.json({ error: 'Proveedor OAuth no permitido.' }, { status: 400 })
    }

    const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthStartIp)
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

    const client = createServerClient()
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      redirectTo: new URL('/sign-in', getRequestOrigin()).toString(),
      skipBrowserRedirect: true,
    })

    if (error) {
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo iniciar OAuth.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    if (!data?.url || !data.codeVerifier) {
      return Response.json({ error: 'InsForge no devolvió un desafío OAuth válido.' }, { status: 502 })
    }

    await setOAuthCookies(data.codeVerifier, redirectPath)
    return Response.json({ url: data.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'La solicitud OAuth no es válida.' }, { status: 400 })
  }
}
