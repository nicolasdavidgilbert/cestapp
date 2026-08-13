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
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const codeVerifier = typeof body?.codeVerifier === 'string' ? body.codeVerifier.trim() : ''

  if (!code || code.length > 4096 || !codeVerifier || codeVerifier.length > 256) {
    return nativeJson({ error: 'El código OAuth o el verificador PKCE no son válidos.' }, 400)
  }

  const { data, error } = await createServerClient().auth.exchangeOAuthCode(code, codeVerifier)
  if (error) return nativeProviderError(error, 'No se pudo completar OAuth.')

  const session = toNativeAuthSession(data)
  return session
    ? nativeJson(session)
    : nativeJson({ error: 'InsForge no devolvió una sesión renovable.' }, 502)
}
