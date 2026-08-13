import 'server-only'

import { createHmac } from 'node:crypto'
import { createServerClient } from '@/src/services/auth'

const MAX_AUTH_BODY_BYTES = 16 * 1024

type RateLimitAction = 'check' | 'consume' | 'failure' | 'success'

type RateLimitPolicy = {
  scope: string
  limit: number
  windowSeconds: number
  baseBlockSeconds: number
  maxBlockSeconds: number
}

export type RateLimitDecision = {
  allowed: boolean
  retryAfter: number
  remaining: number
  unavailable?: boolean
}

export type AuthJsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: 400 | 413 | 415 }

export const AUTH_RATE_LIMITS = {
  signInIp: policy('sign-in-ip', 20, 10 * 60, 60, 15 * 60),
  signInIdentity: policy('sign-in-identity', 5, 30 * 60, 30, 30 * 60),
  signUpIp: policy('sign-up-ip', 5, 60 * 60, 60 * 60, 60 * 60),
  signUpIdentity: policy('sign-up-identity', 3, 60 * 60, 60 * 60, 60 * 60),
  verifyIp: policy('verify-ip', 20, 10 * 60, 60, 15 * 60),
  verifyIdentity: policy('verify-identity', 5, 30 * 60, 60, 60 * 60),
  oauthStartIp: policy('oauth-start-ip', 20, 10 * 60, 60, 10 * 60),
  oauthExchangeIp: policy('oauth-exchange-ip', 30, 10 * 60, 60, 10 * 60),
  refreshIp: policy('refresh-ip', 120, 10 * 60, 60, 10 * 60),
} as const

function policy(
  scope: string,
  limit: number,
  windowSeconds: number,
  baseBlockSeconds: number,
  maxBlockSeconds: number,
): RateLimitPolicy {
  return { scope, limit, windowSeconds, baseBlockSeconds, maxBlockSeconds }
}

function getRateLimitSecret() {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_RATE_LIMIT_SECRET is not configured with at least 32 characters.')
  }
  return secret
}

function hashRateLimitKey(kind: 'ip' | 'identity', value: string) {
  return createHmac('sha256', getRateLimitSecret())
    .update(`${kind}:${value}`)
    .digest('hex')
}

function getClientIp(request: Request) {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0]!.trim()

  const forwardedIp = request.headers.get('x-forwarded-for')
  if (forwardedIp) return forwardedIp.split(',')[0]!.trim()

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLocaleLowerCase('en-US')
}

function parseRateLimitData(data: unknown): RateLimitDecision | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null

  const result = row as { allowed?: unknown; retry_after?: unknown; remaining?: unknown }
  if (typeof result.allowed !== 'boolean') return null

  return {
    allowed: result.allowed,
    retryAfter: typeof result.retry_after === 'number' ? Math.max(0, result.retry_after) : 0,
    remaining: typeof result.remaining === 'number' ? Math.max(0, result.remaining) : 0,
  }
}

async function applyRateLimit(
  keyHash: string,
  selectedPolicy: RateLimitPolicy,
  action: RateLimitAction,
): Promise<RateLimitDecision> {
  try {
    const secret = getRateLimitSecret()
    const { data, error } = await createServerClient().database.rpc('enforce_auth_rate_limit', {
      p_secret: secret,
      p_scope: selectedPolicy.scope,
      p_key_hash: keyHash,
      p_action: action,
      p_limit: selectedPolicy.limit,
      p_window_seconds: selectedPolicy.windowSeconds,
      p_base_block_seconds: selectedPolicy.baseBlockSeconds,
      p_max_block_seconds: selectedPolicy.maxBlockSeconds,
    })

    if (error) throw error

    const decision = parseRateLimitData(data)
    if (!decision) throw new Error('The auth rate limiter returned an invalid response.')
    return decision
  } catch (error) {
    console.error('Auth rate limiter unavailable.', error instanceof Error ? error.name : 'Unknown error')
    return { allowed: false, retryAfter: 60, remaining: 0, unavailable: true }
  }
}

export function consumeIpRateLimit(request: Request, selectedPolicy: RateLimitPolicy) {
  return applyRateLimit(hashRateLimitKey('ip', getClientIp(request)), selectedPolicy, 'consume')
}

export function checkIdentityRateLimit(identifier: string, selectedPolicy: RateLimitPolicy) {
  return applyRateLimit(
    hashRateLimitKey('identity', normalizeIdentifier(identifier)),
    selectedPolicy,
    'check',
  )
}

export function recordIdentityFailure(identifier: string, selectedPolicy: RateLimitPolicy) {
  return applyRateLimit(
    hashRateLimitKey('identity', normalizeIdentifier(identifier)),
    selectedPolicy,
    'failure',
  )
}

export function clearIdentityFailures(identifier: string, selectedPolicy: RateLimitPolicy) {
  return applyRateLimit(
    hashRateLimitKey('identity', normalizeIdentifier(identifier)),
    selectedPolicy,
    'success',
  )
}

export function consumeIdentityRateLimit(identifier: string, selectedPolicy: RateLimitPolicy) {
  return applyRateLimit(
    hashRateLimitKey('identity', normalizeIdentifier(identifier)),
    selectedPolicy,
    'consume',
  )
}

export function authRateLimitResponse(decision: RateLimitDecision) {
  const status = decision.unavailable ? 503 : 429
  const retryAfter = Math.max(1, decision.retryAfter || 60)
  return Response.json(
    {
      error: decision.unavailable
        ? 'La protección de autenticación no está disponible temporalmente.'
        : 'Demasiados intentos. Espera antes de volver a intentarlo.',
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, private',
        Pragma: 'no-cache',
        'Retry-After': String(retryAfter),
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

export async function readAuthJsonBody(request: Request): Promise<AuthJsonBodyResult> {
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return { ok: false, error: 'El contenido debe enviarse como JSON.', status: 415 }
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    const declaredLength = Number(contentLength)
    if (!Number.isInteger(declaredLength) || declaredLength < 0) {
      return { ok: false, error: 'La longitud de la solicitud no es válida.', status: 400 }
    }
    if (declaredLength > MAX_AUTH_BODY_BYTES) {
      return { ok: false, error: 'La solicitud es demasiado grande.', status: 413 }
    }
  }

  if (!request.body) {
    return { ok: false, error: 'La solicitud JSON está vacía.', status: 400 }
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let rawBody = ''
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      byteLength += value.byteLength
      if (byteLength > MAX_AUTH_BODY_BYTES) {
        await reader.cancel()
        return { ok: false, error: 'La solicitud es demasiado grande.', status: 413 }
      }

      rawBody += decoder.decode(value, { stream: true })
    }
    rawBody += decoder.decode()
  } catch {
    return { ok: false, error: 'No se pudo leer la solicitud.', status: 400 }
  }

  if (!rawBody) return { ok: false, error: 'La solicitud JSON está vacía.', status: 400 }

  try {
    const parsed = JSON.parse(rawBody) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ok: true, body: parsed as Record<string, unknown> }
      : { ok: false, error: 'La solicitud JSON no es válida.', status: 400 }
  } catch {
    return { ok: false, error: 'La solicitud JSON no es válida.', status: 400 }
  }
}
