import { createServerClient } from '@/src/services/auth'
import { nativeJson, readNativeAuthBody, rejectNonNativeRequest } from '@/src/services/nativeAuth'

export async function POST(request: Request) {
  const rejection = rejectNonNativeRequest(request)
  if (rejection) return rejection

  const body = await readNativeAuthBody(request)
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''

  if (refreshToken && refreshToken.length <= 8192) {
    const { data } = await createServerClient().auth.refreshSession({ refreshToken })
    if (data?.accessToken) await createServerClient(data.accessToken).auth.signOut()
  }

  return nativeJson({ success: true })
}
