import { createServerClient } from '@/src/services/auth'
import {
  nativeJson,
  nativeProviderError,
  readNativeAuthBody,
  rejectNonNativeRequest,
  toNativeAuthSession,
} from '@/src/services/nativeAuth'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const body = await readNativeAuthBody(request)
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
