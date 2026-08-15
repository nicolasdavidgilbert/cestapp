import {
  createServerClient,
  getAuthCookies,
  getErrorMessage,
  getErrorStatus,
  isTrustedAuthRequest,
} from '@/src/services/auth'
import { readAuthJsonBody } from '@/src/services/authSecurity'

export async function PATCH(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) {
    return Response.json({ error: bodyResult.error }, { status: bodyResult.status })
  }

  const profile = bodyResult.body.profile
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return Response.json({ error: 'El perfil no es válido.' }, { status: 400 })
  }

  const { accessToken } = await getAuthCookies()
  if (!accessToken) {
    return Response.json({ error: 'No hay una sesión activa.' }, { status: 401 })
  }

  const { data, error } = await createServerClient(accessToken).auth.setProfile(
    profile as Record<string, unknown>,
  )

  if (error) {
    const status = getErrorStatus(error)
    return Response.json(
      { error: getErrorMessage(error, 'No se pudo actualizar el perfil.') },
      { status: status >= 400 && status < 500 ? status : 502 },
    )
  }

  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
