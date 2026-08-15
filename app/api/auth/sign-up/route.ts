import {
  clearAuthCookies,
  createServerAuthActions,
  getErrorMessage,
  getErrorStatus,
  getRequestOrigin,
} from '@/src/services/auth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIdentityRateLimit,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'
import { parseSignUpInput } from '@/src/services/authInput'
import { runPasswordSignUp } from '@/src/services/authProviderFlows'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

export async function POST(request: Request) {
  try {
    const prepared = await readTrustedWebAuthJson(request)
    if (!prepared.ok) return prepared.response
    const input = parseSignUpInput(prepared.body)
    if (!input.ok) return authJson({ error: input.error }, 400)
    const { email, password, name } = input.value

    const [ipLimit, identityLimit] = await Promise.all([
      consumeIpRateLimit(request, AUTH_RATE_LIMITS.signUpIp),
      consumeIdentityRateLimit(email, AUTH_RATE_LIMITS.signUpIdentity),
    ])
    if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
    if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

    const auth = await createServerAuthActions()
    const { data, error } = await runPasswordSignUp(auth, {
      email,
      password,
      name,
      redirectTo: new URL('/sign-in', getRequestOrigin()).toString(),
    })

    if (error) {
      const status = getErrorStatus(error)
      return authJson(
        { error: getErrorMessage(error, 'No se pudo crear la cuenta.') },
        status >= 400 && status < 500 ? status : 502,
      )
    }

    if (data?.requireEmailVerification) {
      return authJson({ requireVerification: true })
    }

    if (!data?.user) {
      await clearAuthCookies()
      return authJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
    }

    return authJson({ user: data.user })
  } catch {
    return authJson({ error: 'La solicitud de registro no es válida.' }, 400)
  }
}
