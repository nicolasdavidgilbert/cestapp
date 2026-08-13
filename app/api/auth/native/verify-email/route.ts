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
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  if (!email || email.length > 320 || !/^\d{6}$/.test(code)) {
    return nativeJson({ error: 'Correo y código de seis cifras son obligatorios.' }, 400)
  }

  const { data, error } = await createServerClient().auth.verifyEmail({ email, otp: code })
  if (error) return nativeProviderError(error, 'No se pudo verificar el correo.')

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
