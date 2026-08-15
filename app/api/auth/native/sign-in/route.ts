import { createServerClient, getErrorStatus } from '@/src/services/auth'
import {
  nativeJson,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
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
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response
  const input = parseSignInInput(prepared.body)
  if (!input.ok) return nativeJson({ error: input.error }, 400)
  const { email, password } = input.value

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.signInIp),
    checkIdentityRateLimit(email, AUTH_RATE_LIMITS.signInIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await runPasswordSignIn(createServerClient().auth, email, password)
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
