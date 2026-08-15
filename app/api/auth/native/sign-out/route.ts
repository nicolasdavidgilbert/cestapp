import { createServerClient } from '@/src/services/auth'
import { nativeJson } from '@/src/services/nativeAuth'
import { readTrustedNativeAuthJson } from '@/src/services/authRequest'

export async function POST(request: Request) {
  const prepared = await readTrustedNativeAuthJson(request)
  if (!prepared.ok) return prepared.response

  const refreshToken = typeof prepared.body.refreshToken === 'string' ? prepared.body.refreshToken : ''

  if (refreshToken && refreshToken.length <= 8192) {
    const { data } = await createServerClient().auth.refreshSession({ refreshToken })
    if (data?.accessToken) await createServerClient(data.accessToken).auth.signOut()
  }

  return nativeJson({ success: true })
}
