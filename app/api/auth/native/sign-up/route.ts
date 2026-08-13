import { createServerClient } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  rejectNonNativeRequest,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIdentityRateLimit,
  consumeIpRateLimit,
  readAuthJsonBody,
} from '@/src/services/authSecurity'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) return nativeJson({ error: bodyResult.error }, bodyResult.status)

  const body = bodyResult.body
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (
    !email || email.length > 320 ||
    !password || password.length > 1024 ||
    !name || name.length > 120
  ) {
    return nativeJson({ error: 'Nombre, correo y contraseña no son válidos.' }, 400)
  }

  const [ipLimit, identityLimit] = await Promise.all([
    consumeIpRateLimit(request, AUTH_RATE_LIMITS.signUpIp),
    consumeIdentityRateLimit(email, AUTH_RATE_LIMITS.signUpIdentity),
  ])
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)
  if (!identityLimit.allowed) return authRateLimitResponse(identityLimit)

  const { data, error } = await createServerClient().auth.signUp({
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
