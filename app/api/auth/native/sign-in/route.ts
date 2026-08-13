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

  if (!email || email.length > 320 || !password || password.length > 1024) {
    return nativeJson({ error: 'Correo y contraseña no son válidos.' }, 400)
  }

  const { data, error } = await createServerClient().auth.signInWithPassword({ email, password })
  if (error) return nativeProviderError(error, 'No se pudo iniciar sesión.')

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
