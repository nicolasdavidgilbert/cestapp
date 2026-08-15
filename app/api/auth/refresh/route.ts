import { refreshAuth } from '@insforge/sdk/ssr'
import { isTrustedAuthRequest } from '@/src/services/auth'
import { INSFORGE_SSR_CONFIG } from '@/src/services/insforgeConfig'
import {
  AUTH_RATE_LIMITS,
  authRateLimitResponse,
  consumeIpRateLimit,
} from '@/src/services/authSecurity'

export async function POST(request: Request) {
  if (!isTrustedAuthRequest(request)) {
    return Response.json({ error: 'Origen de solicitud no permitido.' }, { status: 403 })
  }

  const ipLimit = await consumeIpRateLimit(request, AUTH_RATE_LIMITS.refreshIp)
  if (!ipLimit.allowed) return authRateLimitResponse(ipLimit)

  const result = await refreshAuth({ ...INSFORGE_SSR_CONFIG, request })
  result.response.headers.set('Cache-Control', 'no-store, private')
  result.response.headers.set('Pragma', 'no-cache')
  return result.response
}
