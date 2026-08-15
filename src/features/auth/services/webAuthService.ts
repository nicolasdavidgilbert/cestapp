import type { User } from '@/src/types/auth'

export type WebAuthSession = {
  user: User
}

type WebAuthResponse<T> = {
  data: T | null
  error?: string
  status: number
}

async function requestAuth<T>(
  path: string,
  body?: Record<string, unknown>,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<WebAuthResponse<T>> {
  try {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null

    if (!response.ok) {
      return {
        data: null,
        error: payload?.error ?? 'No se pudo completar la solicitud.',
        status: response.status,
      }
    }

    return { data: payload, status: response.status }
  } catch {
    return {
      data: null,
      error: 'No se pudo conectar con Cesta++. Comprueba tu conexión.',
      status: 0,
    }
  }
}

export function signInWeb(email: string, password: string) {
  return requestAuth<WebAuthSession>('/api/auth/sign-in', { email, password })
}

export function signUpWeb(email: string, password: string, name: string) {
  return requestAuth<WebAuthSession & { requireVerification?: boolean }>('/api/auth/sign-up', {
    email,
    password,
    name,
  })
}

export function verifyEmailWeb(email: string, code: string) {
  return requestAuth<WebAuthSession>('/api/auth/verify-email', { email, code })
}

export function refreshSessionWeb() {
  return requestAuth<WebAuthSession>('/api/auth/refresh')
}

export function signOutWeb() {
  return requestAuth<{ success: boolean }>('/api/auth/sign-out')
}

export function startOAuthWeb(provider: string, redirect: string) {
  return requestAuth<{ url: string }>('/api/auth/oauth/start', { provider, redirect })
}

export function updateProfileWeb(profile: Record<string, unknown>) {
  return requestAuth<{ profile: Record<string, unknown> }>(
    '/api/auth/profile',
    { profile },
    'PATCH',
  )
}
