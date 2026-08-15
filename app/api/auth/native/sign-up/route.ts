import { createServerClient } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIdentityRateLimit,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'
import { parseSignUpInput } from '@/src/services/authInput'
import { runPasswordSignUp } from '@/src/services/authProviderFlows'
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response
  const input = parseSignUpInput(prepared.body)
  if (!input.ok) return nativeJson({ error: input.error }, 400)
  const { email, password, name } = input.value

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.signUpIp),
    consumeIdentityRateLimit(email, AUTH_RATE_LIMITS.signUpIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await runPasswordSignUp(createServerClient().auth, {
    email,
    password,
    name,
    redirectTo: new URL('/sign-in', request.url).toString(),
  })

  if (error) return nativeProviderError(error, 'No se pudo crear la cuenta.')
  if (data?.requireEmailVerification) return nativeJson({ requireVerification: true })

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
