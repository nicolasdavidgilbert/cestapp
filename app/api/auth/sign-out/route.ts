import {
  clearAuthCookies,
  clearOAuthCookies,
  createServerAuthActions,
} from '@/src/services/auth'
import { readTrustedWebAuthJson } from '@/src/services/authRequest'
import { authJson } from '@/src/services/authResponse'

export async function POST(request: Request) {
  const prepared = await readTrustedWebAuthJson(request)
  if (!prepared.ok) return prepared.response

  const auth = await createServerAuthActions()
  await auth.signOut()

  await Promise.all([clearAuthCookies(), clearOAuthCookies()])
  return authJson({ success: true })
}
