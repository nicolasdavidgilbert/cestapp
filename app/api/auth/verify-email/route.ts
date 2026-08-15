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
import { parseVerifyEmailInput } from '@/src/services/authInput'
import { runEmailVerification } from '@/src/services/authProviderFlows'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

export async function POST(request: Request) {
  try {
    const prepared = await readTrustedWebAuthJson(request)
    if (!prepared.ok) return prepared.response
    const input = parseVerifyEmailInput(prepared.body)
    if (!input.ok) return authJson({ error: input.error }, 400)
    const { email, code } = input.value

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.verifyIp),
      checkIdentityRateLimit(email, AUTH_RATE_LIMITS.verifyIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await runEmailVerification(auth, email, code)

    if (error) {
      const status = getErrorStatus(error)
      if (status >= 400 && status < 500) {
        const failureLimit = await recordIdentityFailure(email, AUTH_RATE_LIMITS.verifyIdentity)
        if (!failureLimit.allowed) return authRateLimitResponse(failureLimit)
      }

      return authJson(
        { error: getErrorMessage(error, 'No se pudo verificar el correo.') },
        status >= 400 && status < 500 ? status : 502,
      )
    }

    await clearIdentityFailures(email, AUTH_RATE_LIMITS.verifyIdentity)

    if (!data?.user) {
      await clearAuthCookies()
      return authJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
    }

    return authJson({ user: data.user })
  } catch {
    return authJson({ error: 'La solicitud de verificación no es válida.' }, 400)
  }
}
