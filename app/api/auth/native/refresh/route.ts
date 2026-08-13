import { createServerClient, isInvalidSessionError } from '@/src/services/auth'
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
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!refreshToken || refreshToken.length > 8192) {
    return nativeJson({ error: 'No hay una sesión renovable.' }, 401)
  }

  const { data, error } = await createServerClient().auth.refreshSession({ refreshToken })
  if (error) {
    return isInvalidSessionError(error)
      ? nativeJson({ error: 'La sesión ha caducado.' }, 401)
      : nativeProviderError(error, 'No se pudo renovar la sesión.')
  }

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
