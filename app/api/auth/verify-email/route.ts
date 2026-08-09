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
    const body = (await request.json()) as { email?: unknown; code?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    if (!email || !/^\d{6}$/.test(code)) {
      return Response.json({ error: 'Correo y código de seis cifras son obligatorios.' }, { status: 400 })
    }

    const client = createServerClient()
    const { data, error } = await client.auth.verifyEmail({ email, otp: code })

    if (error) {
      const status = getErrorStatus(error)
      return Response.json(
        { error: getErrorMessage(error, 'No se pudo verificar el correo.') },
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
    return Response.json({ error: 'La solicitud de verificación no es válida.' }, { status: 400 })
  }
}
