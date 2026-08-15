import { sanitizeRedirectPath } from '@/src/features/auth/services/redirectService'
import {
  createServerAuthActions,
  getErrorMessage,
  getErrorStatus,
  getRequestOrigin,
  setOAuthCookies,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

const supportedProviders = new Set(['google', 'github'])

export async function POST(request: Request) {
  try {
    const prepared = await readTrustedWebAuthJson(request)
    if (!prepared.ok) return prepared.response

    const body = prepared.body
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const redirectPath = sanitizeRedirectPath(typeof body.redirect === 'string' ? body.redirect : null)

    if (!supportedProviders.has(provider)) {
      return authJson({ error: 'Proveedor OAuth no permitido.' }, 400)
    }

    const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.oauthStartIp)
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await auth.signInWithOAuth(provider, {
      redirectTo: new URL('/api/auth/oauth/callback', getRequestOrigin()).toString(),
      skipBrowserRedirect: true,
    })

    if (error) {
      const status = getErrorStatus(error)
      return authJson(
        { error: getErrorMessage(error, 'No se pudo iniciar OAuth.') },
        status >= 400 && status < 500 ? status : 502,
      )
    }

    if (!data?.url || !data.codeVerifier) {
      return authJson({ error: 'InsForge no devolvió un desafío OAuth válido.' }, 502)
    }

    await setOAuthCookies(data.codeVerifier, redirectPath)
    return authJson({ url: data.url })
  } catch {
    return authJson({ error: 'La solicitud OAuth no es válida.' }, 400)
  }
}
