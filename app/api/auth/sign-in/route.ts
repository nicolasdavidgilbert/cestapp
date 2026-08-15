import {
  clearAuthCookies,
  createServerAuthActions,
  getErrorMessage,
  getErrorStatus,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  checkIdentityRateLimit,
  clearIdentityFailures,
  consumeIpRateLimit,
  recordIdentityFailure,
} from '@/src/services/authSecurity'
import { parseSignInInput } from '@/src/services/authInput'
import { runPasswordSignIn } from '@/src/services/authProviderFlows'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

export async function POST(request: Request) {
  try {
    const prepared = await readTrustedWebAuthJson(request)
    if (!prepared.ok) return prepared.response
    const input = parseSignInInput(prepared.body)
    if (!input.ok) return authJson({ error: input.error }, 400)
    const { email, password } = input.value

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.signInIp),
      checkIdentityRateLimit(email, AUTH_RATE_LIMITS.signInIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await runPasswordSignIn(auth, email, password)

    if (error) {
      const status = getErrorStatus(error)
      if (status >= 400 && status < 500) {
        const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.signInIdentity)
        if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
      }

      return authJson(
        {
          error: status >= 400 && status < 500
            ? 'No se pudo iniciar sesión. Revisa las credenciales o verifica tu correo.'
            : getErrorMessage(error, 'No se pudo iniciar sesión.'),
        },
        status >= 400 && status < 500 ? 401 : 502,
      )
    }

    await clearIdentityFailures(email, AUTH_RATE_LIMITS.signInIdentity)

    if (!data?.user) {
      await clearAuthCookies()
      return authJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
    }

    return authJson({ user: data.user })
  } catch {
    return authJson({ error: 'La solicitud de inicio de sesión no es válida.' }, 400)
  }
}
