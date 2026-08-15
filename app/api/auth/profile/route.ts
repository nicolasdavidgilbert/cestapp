import {
  createServerClient,
  getAuthCookies,
  getErrorMessage,
  getErrorStatus,
} from '@/src/services/auth'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

export async function PATCH(request: Request) {
  const prepared = await readTrustedWebAuthJson(request)
  if (!prepared.ok) return prepared.response

  const profile = prepared.body.profile
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return authJson({ error: 'El perfil no es válido.' }, 400)
  }

  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return authJson({ error: 'No hay una sesión activa.' }, 401)
  }

  const { data, error } = await createServerClient(accessToken).auth.setProfile(
    profile as Record<string, unknown>,
  )

  if (error) {
    const status = getErrorStatus(error)
    return authJson(
      { error: getErrorMessage(error, 'No se pudo actualizar el perfil.') },
      status >= 400 && status < 500 ? status : 502,
    )
  }

  return authJson(data)
}
