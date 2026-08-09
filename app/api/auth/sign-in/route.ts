import {
  createServerClient,
  getErrorMessage,
  getErrorStatus,
  isTrustedAuthRequest,
  setAuthCookies,
  toServerAuthSession,
} from '@/src/services/auth'

export async function POST(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return Response.json({ error: 'Correo y contraseña son obligatorios.' }, { status: 400 })
    }

    const client = createServerClient()
    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error) {
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo iniciar sesión.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    const session = toServerAuthSession(data)
    if (!session || !data?.refreshToken) {
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    await setAuthCookies(session.accessToken, data.refreshToken)
    return Response.json(session, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'La solicitud de inicio de sesión no es válida.' }, { status: 400 })
  }
}
