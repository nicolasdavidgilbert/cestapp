import {
  createServerClient,
  getErrorMessage,
  getErrorStatus,
  getRequestOrigin,
  isTrustedAuthRequest,
  setAuthCookies,
  toServerAuthSession,
} from '@/src/services/auth'

export async function POST(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown; name?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!email || !password || !name) {
      return Response.json({ error: 'Nombre, correo y contraseña son obligatorios.' }, { status: 400 })
    }

    const client = createServerClient()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      name,
      redirectTo: new URL('/sign-in', getRequestOrigin(request)).toString(),
    })

    if (error) {
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo crear la cuenta.') },
        { status: status >= 400 && status < 500 ? status : 502 },
      )
    }

    if (data?.requireEmailVerification) {
      return Response.json({ requireVerification: true })
    }

    const session = toServerAuthSession(data)
    if (!session || !data?.refreshToken) {
      return Response.json({ error: 'InsForge no devolvió una sesión renovable.' }, { status: 502 })
    }

    await setAuthCookies(session.accessToken, data.refreshToken)
    return Response.json(session, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'La solicitud de registro no es válida.' }, { status: 400 })
  }
}
