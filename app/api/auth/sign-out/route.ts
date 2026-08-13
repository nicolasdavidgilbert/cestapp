import {
  clearAuthCookies,
  clearOAuthCookies,
  createServerClient,
  getAuthCookies,
  isTrustedAuthRequest,
} from '@/src/services/auth'
import { readAuthJsonBody } from '@/src/services/authSecurity'

export async function POST(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) {
    return Response.json({ error: bodyResult.error }, { status: bodyResult.status })
  }

  const { accessToken } = await getAuthCookies()
  if (accessToken) {
    const client = createServerClient(accessToken)
    await client.auth.signOut()
  }

  await Promise.all([clearAuthCookies(), clearOAuthCookies()])
  return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
