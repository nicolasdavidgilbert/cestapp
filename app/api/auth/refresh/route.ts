import {
  clearAuthCookies,
  createServerClient,
  getAuthCookies,
  getErrorMessage,
  isInvalidSessionError,
  isTrustedAuthRequest,
  setAuthCookies,
  toServerAuthSession,
} from '@/src/services/auth'

export async function POST(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  const { accessToken, refreshToken } = await getAuthCookies()

  if (accessToken) {
    const currentClient = createServerClient(accessToken)
    const { data, error } = await currentClient.auth.getCurrentUser()

    if (!error && data?.user) {
      return Response.json(
        { user: data.user, accessToken },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (error && !isInvalidSessionError(error)) {
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo comprobar la sesión.') },
        { status: 503 },
      )
    }
  }

  if (!refreshToken) {
    await clearAuthCookies()
    return Response.json({ error: 'No hay una sesión renovable.' }, { status: 401 })
  }

  const refreshClient = createServerClient()
  const { data, error } = await refreshClient.auth.refreshSession({ refreshToken })

  if (error) {
    if (isInvalidSessionError(error)) {
      await clearAuthCookies()
      return Response.json({ error: 'La sesión ha caducado.' }, { status: 401 })
    }

    return Response.json(
      { error: getErrorMessage(error, 'No se pudo renovar la sesión.') },
      { status: 503 },
    )
  }

  const session = toServerAuthSession(data)
  if (!session || !data?.refreshToken) {
    return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
  }

  await setAuthCookies(session.accessToken, data.refreshToken)
  return Response.json(session, { headers: { 'Cache-Control': 'no-store' } })
}
