import 'server-only'

import { isTrustedAuthRequest } from '@/src/services/auth'
import { readAuthJsonBody } from '@/src/services/authSecurity'
import { isNativeAuthRequest } from '@/src/services/nativeAuth'
import { authJson } from '@/src/services/authResponse'

type PreparedAuthRequest =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }

async function readJson(request: Request): Promise<PreparedAuthRequest> {
  const result = await readAuthJsonBody(request)
  return result.ok
    ? { ok: true, body: result.body }
    : { ok: false, response: authJson({ error: result.error }, result.status) }
}

export function readTrustedWebAuthJson(request: Request): Promise<PreparedAuthRequest> {
  return isTrustedAuthRequest(request)
    ? readJson(request)
    : Promise.resolve({
        ok: false,
        response: authJson({ error: 'Origen de solicitud no permitido.' }, 403),
      })
}

export function readTrustedNativeAuthJson(request: Request): Promise<PreparedAuthRequest> {
  return isNativeAuthRequest(request)
    ? readJson(request)
    : Promise.resolve({
        ok: false,
        response: authJson({ error: 'Cliente nativo no permitido.' }, 403),
      })
}
