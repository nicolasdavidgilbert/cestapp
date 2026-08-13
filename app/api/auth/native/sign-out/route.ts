import { createServerClient } from '@/src/services/auth'
import { nativeJson, rejectNonNativeRequest } from '@/src/services/nativeAuth'
import { readAuthJsonBody } from '@/src/services/authSecurity'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const bodyResult = await readAuthJsonBody(request)
  if (!bodyResult.ok) return nativeJson({ error: bodyResult.error }, bodyResult.status)

  const body = bodyResult.body
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''

  if (refreshToken && refreshToken.length <= 8192) {
    const { data } = await createServerClient().auth.refreshSession({ refreshToken })
    if (data?.accessToken) await createServerClient(data.accessToken).auth.signOut()
  }

  return nativeJson({ success: true })
}
